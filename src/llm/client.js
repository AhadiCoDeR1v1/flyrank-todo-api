const OpenAI = require('openai');

function getLLMClient() {
    const baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
    const apiKey = process.env.LLM_API_KEY || 'ollama';
    const timeout = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 30000; // 30s explicit timeout

    return new OpenAI({
        baseURL,
        apiKey,
        timeout,
        maxRetries: 0 // Disable SDK hidden retries so our explicit retry policy governs execution
    });
}

module.exports = {
    getLLMClient
};
