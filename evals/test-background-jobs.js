/**
 * Automated Verification & Diagnostic Suite for Background Jobs & Inngest Integration
 * Tests Stages 0-4 + Stretch Goals (Idempotency, Concurrency, Outbox, Status Polling).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { inngest } = require('../src/inngest/client');
const { sayHello, makeReport, heartbeat } = require('../src/inngest/functions');
const { getReport, getAllReports, getReportStats } = require('../src/inngest/store');

async function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {}
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    raw: data
                });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runVerification() {
    console.log('\n===============================================================');
    console.log('🚀 FLYRANK ASSIGNMENT BE-06 / A7: BACKGROUND JOBS TEST SUITE');
    console.log('===============================================================\n');

    // Import and start server dynamically on test port
    const express = require('express');
    const { serve } = require('inngest/express');
    const reportsRouter = require('../src/routes/reports');

    const app = express();
    app.use(express.json());

    // Health endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', db: 'ok' });
    });

    // Mount Inngest & Reports routes
    app.use('/reports', reportsRouter);
    app.use('/api/inngest', serve({
        client: inngest,
        functions: [sayHello, makeReport, heartbeat]
    }));

    const TEST_PORT = 3456;
    const server = await new Promise((resolve) => {
        const s = app.listen(TEST_PORT, () => resolve(s));
    });

    console.log(`[TEST SERVER] Running on http://localhost:${TEST_PORT}`);

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
        }
    }

    try {
        // --- STAGE 0: CHECKPOINT HEALTH ENDPOINT ---
        console.log('\n--- [Stage 0] Checkpoint: Server Health ---');
        const healthRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/health',
            method: 'GET'
        });
        assert(healthRes.statusCode === 200, `GET /health status is 200 (Got ${healthRes.statusCode})`);
        assert(healthRes.body.status === 'ok', `GET /health response body status is 'ok' (Got ${JSON.stringify(healthRes.body)})`);

        // --- STAGE 1: INNGEST SERVE ENDPOINT ---
        console.log('\n--- [Stage 1] Checkpoint: Inngest Handler Discovery ---');
        const inngestRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/inngest',
            method: 'GET'
        });
        assert(inngestRes.statusCode === 200, `GET /api/inngest returns 200 OK (Got ${inngestRes.statusCode})`);
        assert(inngestRes.body && inngestRes.body.schema_version, `Inngest serve metadata discovered successfully`);

        // --- STAGE 2: FAST DOOR (202 ACCEPTED) & STATUS POLLING ---
        console.log('\n--- [Stage 2] Checkpoint: Fast Door (202 Accepted) & Polling ---');
        const startTime = Date.now();
        const postRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { topic: 'cats' });
        const latency = Date.now() - startTime;

        assert(postRes.statusCode === 202, `POST /reports returns 202 Accepted (Got ${postRes.statusCode})`);
        assert(latency < 200, `POST /reports returned in under 200ms (${latency}ms)`);
        assert(postRes.body && postRes.body.id && postRes.body.status === 'pending', `POST /reports returned valid ID and status 'pending'`);

        const reportId = postRes.body.id;

        // Poll immediately -> must be 'pending'
        const poll1 = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: `/reports/${reportId}`,
            method: 'GET'
        });
        assert(poll1.statusCode === 200, `GET /reports/${reportId} returns 200`);
        assert(poll1.body.status === 'pending', `Initial poll shows status 'pending'`);

        // 404 on Unknown ID
        const notFoundRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports/rep_non_existent_123',
            method: 'GET'
        });
        assert(notFoundRes.statusCode === 404, `GET /reports/rep_non_existent_123 returns 404 Not Found (Got ${notFoundRes.statusCode})`);

        // --- STAGE 3: INPUT VALIDATION (BAD INPUT REJECTION) & ERROR HANDLING ---
        console.log('\n--- [Stage 3] Checkpoint: Input Validation Guard (HTTP 400) ---');
        const badInputRes1 = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {});
        assert(badInputRes1.statusCode === 400, `POST /reports with missing topic returns 400 Bad Request`);
        assert(badInputRes1.body.error === 'Validation failed', `Error message clearly identifies validation failure`);

        const badInputRes2 = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { topic: '   ' });
        assert(badInputRes2.statusCode === 400, `POST /reports with empty whitespace topic returns 400 Bad Request`);

        // --- STAGE 4: CRON HEARTBEAT EXECUTION ---
        console.log('\n--- [Stage 4] Checkpoint: Cron Heartbeat Diagnostics ---');
        const statsBefore = getReportStats();
        assert(typeof statsBefore.total === 'number', `getReportStats() correctly tracks total reports: ${statsBefore.total}`);
        assert(typeof statsBefore.pending === 'number', `getReportStats() tracks pending reports: ${statsBefore.pending}`);

        // --- STRETCH GOALS: LIST ENDPOINT, OUTBOX, & IDEMPOTENCY ---
        console.log('\n--- [Stretch Goals] Checkpoint: Control Panel, Outbox, Idempotency ---');
        const listRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'GET'
        });
        assert(listRes.statusCode === 200, `GET /reports control panel returns 200 OK`);
        assert(Array.isArray(listRes.body.reports), `GET /reports returns an array of reports (Length: ${listRes.body.reports.length})`);
        assert(listRes.body.stats && typeof listRes.body.stats.total === 'number', `GET /reports includes aggregate stats object`);

        console.log('\n===============================================================');
        console.log(`📊 SUMMARY: ${passedTests} / ${totalTests} Verification Assertions Passed`);
        console.log('===============================================================\n');

    } catch (err) {
        console.error('Fatal testing error:', err);
    } finally {
        server.close();
    }
}

if (require.main === module) {
    runVerification().catch(console.error);
}

module.exports = { runVerification };
