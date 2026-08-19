const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
});

// AI generated naive implementation
router.post('/', async (req, res) => {
    try {
        const userText = req.body.text;
        
        // Naive prompt concatenated directly in system prompt
        const prompt = `Classify this message into category (billing, bug, feature, other): ${userText}`;

        // Default OpenAI call without explicit timeout, without maxRetries override
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }]
        });

        // Direct return of model text or unvalidated JSON
        const rawContent = response.choices[0].message.content;
        res.json({ result: rawContent });
    } catch (err) {
        // Generic error handler without distinction for 401, 429, or 504
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
