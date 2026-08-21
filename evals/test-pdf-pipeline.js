/**
 * Comprehensive Automated Verification Suite for PDF Report Generator (BE-08 / A8)
 * Tests SQL Aggregations, Playwright PDF Rendering, "Store and Link" Serving, and Idempotency.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => { chunks.push(chunk); });
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const rawString = buffer.toString('utf-8');
                let parsed = null;
                try {
                    parsed = JSON.parse(rawString);
                } catch (_) {}
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed,
                    buffer,
                    raw: rawString
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

async function runPdfPipelineVerification() {
    console.log('\n===============================================================');
    console.log('🚀 FLYRANK ASSIGNMENT BE-08 / A8: PDF REPORT GENERATOR TEST SUITE');
    console.log('===============================================================\n');

    // Import Express app from server.js
    const express = require('express');
    const reportsRouter = require('../src/routes/reports');

    const app = express();
    app.use(express.json());
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    app.use('/reports', reportsRouter);

    const TEST_PORT = 3567;
    const server = await new Promise((resolve) => {
        const s = app.listen(TEST_PORT, () => resolve(s));
    });

    console.log(`[TEST SERVER] Running on http://localhost:${TEST_PORT}`);

    let passed = 0;
    let total = 0;

    function assert(cond, msg) {
        total++;
        if (cond) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
        }
    }

    try {
        // --- 1. HEALTH CHECKPOINT ---
        console.log('\n--- [Stage 0] Checkpoint: Server Health ---');
        const healthRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/health',
            method: 'GET'
        });
        assert(healthRes.statusCode === 200, `GET /health status is 200 (Got ${healthRes.statusCode})`);

        // --- 2. GENERATE PDF REPORT (POST /reports) ---
        console.log('\n--- [Stage 4] Checkpoint: Generate PDF Report (POST /reports) ---');
        const startTime = Date.now();
        const genRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { force: true });
        const latency = Date.now() - startTime;

        assert(genRes.statusCode === 201, `POST /reports returned 201 Created (Got ${genRes.statusCode})`);
        assert(genRes.body && genRes.body.id && genRes.body.file, `Response includes report ID and file link: ${JSON.stringify(genRes.body)}`);
        console.log(`  ⏱️ PDF Generation Latency: ${latency}ms`);

        const reportId = genRes.body.id;
        const fileUrl = genRes.body.file;

        // --- 3. GET REPORT METADATA (GET /reports/:id) ---
        console.log('\n--- [Stage 4] Checkpoint: Get Report Metadata (GET /reports/:id) ---');
        const metaRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: `/reports/${reportId}`,
            method: 'GET'
        });
        assert(metaRes.statusCode === 200, `GET /reports/${reportId} returns 200 OK`);
        assert(metaRes.body.id === reportId, `Report metadata matches requested ID`);
        assert(metaRes.body.file === `/reports/${reportId}/file`, `Report metadata contains download link`);

        // --- 4. DOWNLOAD BINARY PDF BY LINK (GET /reports/:id/file) ---
        console.log('\n--- [Stage 4] Checkpoint: Download Binary PDF (GET /reports/:id/file) ---');
        const fileRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: fileUrl,
            method: 'GET'
        });
        assert(fileRes.statusCode === 200, `GET ${fileUrl} returns 200 OK`);
        assert(fileRes.headers['content-type'] === 'application/pdf', `Content-Type header is 'application/pdf' (Got ${fileRes.headers['content-type']})`);
        assert(fileRes.buffer.length > 50000, `Downloaded PDF size is valid (${(fileRes.buffer.length / 1024).toFixed(2)} KB)`);

        // Check PDF header signature (%PDF-)
        const pdfHeader = fileRes.buffer.subarray(0, 5).toString('ascii');
        assert(pdfHeader.startsWith('%PDF-'), `File content is a verified PDF document (Header: ${pdfHeader})`);

        // Save a sample copy for submission proof
        const sampleOut = path.join(__dirname, '../reports/downloaded-sample.pdf');
        fs.writeFileSync(sampleOut, fileRes.buffer);
        assert(fs.existsSync(sampleOut), `Sample verified PDF saved to reports/downloaded-sample.pdf`);

        // --- 5. IDEMPOTENCY CHECK (Stage 5: Ask Twice, Get One) ---
        console.log('\n--- [Stage 5] Checkpoint: Idempotency (Ask Twice, Get One) ---');
        const secondPostRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {}); // No force -> must return existing today's report
        assert(secondPostRes.statusCode === 200, `Second POST /reports returns 200 OK (Got ${secondPostRes.statusCode})`);
        assert(secondPostRes.body.id === reportId, `Idempotent response returned same report ID #${reportId}`);
        assert(secondPostRes.body.cached === true, `Response flag indicates cached: true`);

        // Force new generation
        const forcedPostRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { force: true });
        assert(forcedPostRes.statusCode === 201, `Forced POST /reports with {force: true} returns 201 Created`);
        assert(forcedPostRes.body.id !== reportId, `Forced generation created new ID #${forcedPostRes.body.id}`);

        // --- 6. CONTROL PANEL LIST ENDPOINT (GET /reports) ---
        console.log('\n--- [Stretch Goal] Checkpoint: Control Panel List (GET /reports) ---');
        const listRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/reports',
            method: 'GET'
        });
        assert(listRes.statusCode === 200, `GET /reports returns 200 OK`);
        assert(Array.isArray(listRes.body.reports), `GET /reports returns reports array (Length: ${listRes.body.reports.length})`);
        assert(listRes.body.reports.some(r => r.id === reportId), `List contains our generated report`);

        console.log('\n===============================================================');
        console.log(`📊 SUMMARY: ${passed} / ${total} PDF Pipeline Assertions Passed`);
        console.log('===============================================================\n');

    } catch (err) {
        console.error('Fatal test error:', err);
    } finally {
        server.close();
    }
}

if (require.main === module) {
    runPdfPipelineVerification().catch(console.error);
}

module.exports = { runPdfPipelineVerification };
