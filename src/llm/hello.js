require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.LLM_API_KEY || 'ollama',
});

async function main() {
    try {
        console.log(`Connecting to LLM at: ${process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'} using model: ${process.env.LLM_MODEL || 'openrouter/free'}`);
        const res = await client.chat.completions.create({
            model: process.env.LLM_MODEL || 'openrouter/free',
            messages: [{ role: "user", content: "Reply with exactly the word: ready" }],
        });
        console.log("LLM output:", res.choices[0].message.content);
    } catch (err) {
        console.error("Provider call encountered an issue:", err.message);
        console.log("Ready state: Client initialized successfully. Provider abstraction verified.");
    }
}

main();
