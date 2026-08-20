/**
 * AI-Generated Background Job Implementation (Quarantined in ai-version/)
 * Generated from Initial Specification Prompt
 */

const express = require('express');
const { Inngest } = require('inngest');
const { serve } = require('inngest/express');

const app = express();
app.use(express.json());

const inngest = new Inngest({ id: 'my-reports-app' });

// In-memory reports store
const reports = {};

// 1. Fast acceptance endpoint
app.post('/reports', async (req, res) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        return res.status(400).json({ error: 'topic is required' });
    }

    const id = `report_${Date.now()}`;
    reports[id] = { id, topic, status: 'pending' };

    await inngest.send({
        name: 'report/requested',
        data: { id, topic }
    });

    res.status(202).json({ id, status: 'pending' });
});

// 2. Status endpoint
app.get('/reports/:id', (req, res) => {
    const report = reports[req.params.id];
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
});

// 3. Background report function
const makeReport = inngest.createFunction(
    { id: 'make-report', retries: 2, triggers: [{ event: 'report/requested' }] },
    async ({ event, step }) => {
        const { id, topic } = event.data;

        await step.sleep('do-the-slow-work', '8s');

        await step.run('build-report', async () => {
            if (topic === 'fail') {
                throw new Error('The report oven is broken!');
            }
            if (reports[id]) {
                reports[id].status = 'done';
                reports[id].result = `Generated analytical report for topic: ${topic}`;
            }
        });
    }
);

// 4. Cron heartbeat function
const heartbeat = inngest.createFunction(
    { id: 'heartbeat', triggers: [{ cron: '* * * * *' }] },
    async ({ step }) => {
        await step.run('log-counts', async () => {
            const all = Object.values(reports);
            const pending = all.filter(r => r.status === 'pending').length;
            const done = all.filter(r => r.status === 'done').length;
            const failed = all.filter(r => r.status === 'failed').length;
            console.log(`Cron Heartbeat: ${pending} pending, ${done} done, ${failed} failed`);
        });
    }
);

app.use('/api/inngest', serve({
    client: inngest,
    functions: [makeReport, heartbeat]
}));

if (require.main === module) {
    const PORT = 3001;
    app.listen(PORT, () => console.log(`AI version running on http://localhost:${PORT}`));
}

module.exports = { app, reports, makeReport, heartbeat };
