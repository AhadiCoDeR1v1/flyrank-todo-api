const { z } = require('zod');

// Allowed categories for classification (Closed list enum)
const CATEGORIES = ['billing', 'bug', 'feature', 'other'];

// Allowed urgency levels (Closed list enum)
const URGENCIES = ['low', 'normal', 'high'];

// Input Schema: Validates incoming POST /triage request payload
const TriageInputSchema = z.object({
    text: z.string({
        required_error: "Field 'text' is required",
        invalid_type_error: "Field 'text' must be a string"
    })
    .trim()
    .min(1, { message: "Field 'text' must contain at least 1 character" })
    .max(2000, { message: "Field 'text' cannot exceed 2000 characters" })
});

// Output Schema: Validates structured response returned by LLM or stub
const TriageOutputSchema = z.object({
    category: z.enum(CATEGORIES, {
        errorMap: () => ({ message: `category must be one of: ${CATEGORIES.join(', ')}` })
    }),
    urgency: z.enum(URGENCIES, {
        errorMap: () => ({ message: `urgency must be one of: ${URGENCIES.join(', ')}` })
    }),
    confidence: z.number()
        .min(0.0, { message: "confidence must be between 0.0 and 1.0" })
        .max(1.0, { message: "confidence must be between 0.0 and 1.0" }),
    reason: z.string().min(1, { message: "reason must be a non-empty string" })
});

// Deterministic mock response for stub mode (Zero LLM API cost)
const STUB_TRIAGE_RESPONSE = {
    category: "bug",
    urgency: "normal",
    confidence: 0.95,
    reason: "Stub mode active: User describes an issue requiring developer triage."
};

// Deterministic fallback response for kill switch (LLM_ENABLED=false)
const FALLBACK_TRIAGE_RESPONSE = {
    category: "other",
    urgency: "normal",
    confidence: 0.0,
    reason: "LLM kill switch is active (LLM_ENABLED=false). Safe deterministic fallback applied."
};

module.exports = {
    CATEGORIES,
    URGENCIES,
    TriageInputSchema,
    TriageOutputSchema,
    STUB_TRIAGE_RESPONSE,
    FALLBACK_TRIAGE_RESPONSE
};
