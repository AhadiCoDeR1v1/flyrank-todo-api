const fs = require('fs');
const path = require('path');
const { getLLMClient } = require('./client');
const { TriageOutputSchema, STUB_TRIAGE_RESPONSE, FALLBACK_TRIAGE_RESPONSE } = require('./schema');
const { executeWithRetry } = require('./retry');
const { getCached, setCache } = require('./cache');

const PROMPT_VERSION = 'v1';
const PROMPT_FILE_PATH = path.join(__dirname, `../../prompts/triage-${PROMPT_VERSION}.md`);
const QUARANTINE_LOG_PATH = path.join(__dirname, '../../logs/quarantine.jsonl');

/**
 * Load system prompt from markdown specification file
 */
function loadSystemPrompt() {
    try {
        return fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');
    } catch (err) {
        console.error(`Failed to load prompt file at ${PROMPT_FILE_PATH}:`, err.message);
        return "You classify customer support tickets into JSON: {category, urgency, confidence, reason}.";
    }
}

/**
 * Strip markdown formatting code fences and extract clean JSON
 */
function extractJSONString(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let cleaned = rawText.trim();

    // Strip ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
        const firstNewline = cleaned.indexOf('\n');
        if (firstNewline !== -1) {
            cleaned = cleaned.substring(firstNewline + 1);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3).trim();
        }
    }

    // Locate first '{' and last '}'
    const startIndex = cleaned.indexOf('{');
    const endIndex = cleaned.lastIndexOf('}');

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return cleaned.substring(startIndex, endIndex + 1);
    }

    return cleaned;
}

/**
 * Record failed model output into quarantine log file
 */
function logQuarantine(input, rawOutput, errorMessage) {
    try {
        const logDir = path.dirname(QUARANTINE_LOG_PATH);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const entry = {
            timestamp: new Date().toISOString(),
            prompt_version: PROMPT_VERSION,
            input_text: input,
            raw_output: rawOutput,
            error: errorMessage
        };

        fs.appendFileSync(QUARANTINE_LOG_PATH, JSON.stringify(entry) + '\n');
    } catch (err) {
        console.error("Failed to write to quarantine log:", err.message);
    }
}

/**
 * Log structured observability & cost metrics
 */
function logCostMetrics({ model, inputTokens, outputTokens, totalTokens, durationMs, repairsNeeded, status }) {
    // OpenRouter / standard pricing estimate ~$0.15/1M input, ~$0.60/1M output for small models
    const costEstimateUSD = ((inputTokens * 0.00000015) + (outputTokens * 0.00000060)).toFixed(7);

    const logEntry = {
        timestamp: new Date().toISOString(),
        event: "llm_triage_call",
        prompt_version: PROMPT_VERSION,
        model: model,
        tokens: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens
        },
        duration_ms: durationMs,
        repairs_needed: repairsNeeded,
        estimated_cost_usd: parseFloat(costEstimateUSD),
        status: status
    };

    console.log(JSON.stringify(logEntry));
}

/**
 * Core LLM Triage Function with Repair Retry & Schema Enforcement
 */
async function triageMessage(text) {
    // 1. Check Kill Switch
    if (process.env.LLM_ENABLED === 'false' || process.env.LLM_ENABLED === '0') {
        return { status: 200, data: FALLBACK_TRIAGE_RESPONSE };
    }

    // 2. Check Stub Mode
    if (process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true') {
        return { status: 200, data: STUB_TRIAGE_RESPONSE };
    }

    // 3. Check Cache
    const cachedResponse = getCached(text, PROMPT_VERSION);
    if (cachedResponse) {
        return { status: 200, data: cachedResponse, cached: true };
    }

    const client = getLLMClient();
    const systemPrompt = loadSystemPrompt();
    const model = process.env.LLM_MODEL || 'openrouter/free';
    const startTime = Date.now();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let repairsNeeded = 0;

    // Defense in depth: Untrusted user input is passed as JSON-encoded content
    const userPayload = JSON.stringify({ user_input: text });

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please classify the following message:\n${userPayload}` }
    ];

    try {
        // First LLM Attempt (wrapped in network retry policy for 429/5xx/timeout)
        const response1 = await executeWithRetry(() => client.chat.completions.create({
            model: model,
            temperature: 0.1,
            messages: messages
        }));

        if (response1.usage) {
            totalInputTokens += response1.usage.prompt_tokens || 0;
            totalOutputTokens += response1.usage.completion_tokens || 0;
        }

        const rawText1 = response1.choices[0]?.message?.content || '';
        const jsonStr1 = extractJSONString(rawText1);

        let parsed1;
        let parseError1 = null;

        try {
            parsed1 = JSON.parse(jsonStr1);
        } catch (e) {
            parseError1 = `JSON parse failed: ${e.message}`;
        }

        if (!parseError1) {
            const validation1 = TriageOutputSchema.safeParse(parsed1);
            if (validation1.success) {
                const durationMs = Date.now() - startTime;
                logCostMetrics({
                    model,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    durationMs,
                    repairsNeeded: 0,
                    status: 200
                });

                setCache(text, PROMPT_VERSION, validation1.data);
                return { status: 200, data: validation1.data };
            } else {
                parseError1 = `Schema validation failed: ${validation1.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
            }
        }

        // Schema validation failed - Execute REPAIR RETRY (exactly once)
        repairsNeeded = 1;
        console.warn(`[RepairRetry] Attempt 1 failed (${parseError1}). Triggering single repair retry...`);

        const repairMessages = [
            ...messages,
            { role: 'assistant', content: rawText1 },
            {
                role: 'user',
                content: `Your previous answer was rejected for this reason:\n${parseError1}\n\nReturn ONLY a corrected, valid JSON object matching the required schema.`
            }
        ];

        const response2 = await executeWithRetry(() => client.chat.completions.create({
            model: model,
            temperature: 0.0,
            messages: repairMessages
        }));

        if (response2.usage) {
            totalInputTokens += response2.usage.prompt_tokens || 0;
            totalOutputTokens += response2.usage.completion_tokens || 0;
        }

        const rawText2 = response2.choices[0]?.message?.content || '';
        const jsonStr2 = extractJSONString(rawText2);

        let parsed2;
        let parseError2 = null;

        try {
            parsed2 = JSON.parse(jsonStr2);
        } catch (e) {
            parseError2 = `Repair JSON parse failed: ${e.message}`;
        }

        if (!parseError2) {
            const validation2 = TriageOutputSchema.safeParse(parsed2);
            if (validation2.success) {
                const durationMs = Date.now() - startTime;
                logCostMetrics({
                    model,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    durationMs,
                    repairsNeeded: 1,
                    status: 200
                });

                setCache(text, PROMPT_VERSION, validation2.data);
                return { status: 200, data: validation2.data };
            } else {
                parseError2 = `Repair schema validation failed: ${validation2.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
            }
        }

        // Repair attempt also failed -> Quarantine and return 422
        logQuarantine(text, rawText2 || rawText1, parseError2 || parseError1);

        const durationMs = Date.now() - startTime;
        logCostMetrics({
            model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            durationMs,
            repairsNeeded: 1,
            status: 422
        });

        return {
            status: 422,
            data: {
                error: "Unprocessable Entity",
                message: "Model response failed schema validation after repair attempt.",
                details: parseError2 || parseError1
            }
        };

    } catch (err) {
        const durationMs = Date.now() - startTime;
        const isTimeout = err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT';
        const httpStatus = isTimeout ? 504 : (err.status || 500);

        logCostMetrics({
            model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            durationMs,
            repairsNeeded,
            status: httpStatus
        });

        if (isTimeout) {
            return {
                status: 504,
                data: {
                    error: "Gateway Timeout",
                    message: "The AI provider did not respond within the 30-second timeout limit."
                }
            };
        }

        if (err.status === 401) {
            return {
                status: 500,
                data: {
                    error: "Authentication Error",
                    message: "Invalid or unauthorized LLM API key. Check server configuration."
                }
            };
        }

        return {
            status: 500,
            data: {
                error: "Internal Server Error",
                message: err.message || "An unexpected error occurred while communicating with the AI model."
            }
        };
    }
}

module.exports = {
    triageMessage,
    extractJSONString,
    loadSystemPrompt,
    PROMPT_VERSION
};
