const express = require('express');
const router = express.Router();
const { TriageInputSchema, STUB_TRIAGE_RESPONSE, FALLBACK_TRIAGE_RESPONSE } = require('../llm/schema');

// POST /triage - Classify message / task with structured output
router.post('/', async (req, res) => {
    // 1. Validate input before spending any LLM calls
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

    // 2. Kill switch check (Stage 4)
    if (process.env.LLM_ENABLED === 'false' || process.env.LLM_ENABLED === '0') {
        return res.json(FALLBACK_TRIAGE_RESPONSE);
    }

    // 3. Stub mode check (Stage 1)
    if (process.env.LLM_STUB === '1' || process.env.LLM_STUB === 'true') {
        return res.json(STUB_TRIAGE_RESPONSE);
    }

    // In Stage 1, fallback to stub mode response if triage engine isn't wired yet
    try {
        const triageEngine = require('../llm/triage');
        if (triageEngine && typeof triageEngine.triageMessage === 'function') {
            const result = await triageEngine.triageMessage(text);
            return res.status(result.status || 200).json(result.data);
        }
    } catch (e) {
        // Triage engine not implemented yet in Stage 1
    }

    return res.json(STUB_TRIAGE_RESPONSE);
});

module.exports = router;
