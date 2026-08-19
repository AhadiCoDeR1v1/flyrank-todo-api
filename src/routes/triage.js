const express = require('express');
const router = express.Router();
const { TriageInputSchema, STUB_TRIAGE_RESPONSE, FALLBACK_TRIAGE_RESPONSE } = require('../llm/schema');
const { triageMessage } = require('../llm/triage');

// POST /triage - Classify message / task with structured output
router.post('/', async (req, res) => {
    // 1. Validate input before spending any LLM calls (Reject early with 400)
    const inputResult = TriageInputSchema.safeParse(req.body);
    if (!inputResult.success) {
        const firstIssue = inputResult.error.issues[0];
        const fieldName = firstIssue?.path[0] || 'text';
        return res.status(400).json({
            error: "Validation failed",
            field: fieldName,
            message: firstIssue?.message || "Invalid input payload"
        });
    }

    const { text } = inputResult.data;

    // 2. Kill switch check (LLM_ENABLED=false)
    if (process.env.LLM_ENABLED === 'false' || process.env.LLM_ENABLED === '0') {
        return res.status(200).json(FALLBACK_TRIAGE_RESPONSE);
    }

    // 3. Stub mode check (LLM_STUB=1)
    if (process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true') {
        return res.status(200).json(STUB_TRIAGE_RESPONSE);
    }

    // 4. Delegate to LLM triage engine (with timeout, retry, repair retry & quarantine)
    try {
        const result = await triageMessage(text);
        return res.status(result.status || 200).json(result.data);
    } catch (err) {
        console.error("Unexpected error in /triage handler:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "An unexpected error occurred while processing triage request."
        });
    }
});

module.exports = router;
