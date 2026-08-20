/**
 * Direct Inngest Function Handler Execution & Step Verification Suite
 * Tests step.sleep, step.run, retries, outbox file generation, idempotency, and cron logic.
 */

const fs = require('fs');
const path = require('path');
const { sayHello, makeReport, heartbeat, cleanupCron } = require('../src/inngest/functions');
const { createReport, getReport, getAllReports, getReportStats } = require('../src/inngest/store');

async function runFunctionExecutionTests() {
    console.log('\n===============================================================');
    console.log('⚡ INNGEST DIRECT FUNCTION EXECUTION & STEP ENGINE TESTS');
    console.log('===============================================================\n');

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

    // Step execution mock helper
    const createStepMock = () => {
        const stepsExecuted = [];
        return {
            stepsExecuted,
            sleep: async (id, duration) => {
                stepsExecuted.push({ type: 'sleep', id, duration });
                return null;
            },
            run: async (id, fn) => {
                stepsExecuted.push({ type: 'run', id });
                return await fn();
            }
        };
    };

    // 1. Test sayHello function
    console.log('--- [Stage 1] Testing say-hello function ---');
    const stepMock1 = createStepMock();
    const sayHelloResult = await sayHello.fn({
        event: { name: 'test/hello', data: {} },
        step: stepMock1
    });
    assert(sayHelloResult === 'Hello from the background!', `sayHello returned correct greeting: "${sayHelloResult}"`);
    assert(stepMock1.stepsExecuted.some(s => s.type === 'sleep' && s.duration === '5s'), `sayHello executed 5-second sleep step`);

    // 2. Test makeReport happy path (cats)
    console.log('\n--- [Stage 2] Testing make-report (Happy Path: "cats") ---');
    const reportId = `rep_test_${Date.now()}`;
    createReport(reportId, 'cats');

    const stepMock2 = createStepMock();
    const reportResult = await makeReport.fn({
        event: { name: 'report/requested', data: { id: reportId, topic: 'cats' } },
        step: stepMock2
    });

    assert(reportResult && reportResult.topic === 'cats', `makeReport returned valid report for 'cats'`);
    assert(stepMock2.stepsExecuted.some(s => s.type === 'sleep' && s.duration === '8s'), `makeReport executed 8-second sleep step`);
    assert(stepMock2.stepsExecuted.some(s => s.type === 'run' && s.id === 'build-report'), `makeReport executed build-report step`);

    const storedReport = getReport(reportId);
    assert(storedReport.status === 'done', `Store report status transitioned to 'done' (Got '${storedReport.status}')`);
    assert(storedReport.result.metrics.confidenceScore > 0.9, `Report includes confidence metric (${storedReport.result.metrics.confidenceScore})`);

    // Verify Outbox stretch goal
    const outboxFilePath = path.join(__dirname, `../outbox/${reportId}.txt`);
    assert(fs.existsSync(outboxFilePath), `Outbox file created on disk at outbox/${reportId}.txt`);
    if (fs.existsSync(outboxFilePath)) {
        const content = fs.readFileSync(outboxFilePath, 'utf-8');
        assert(content.includes('FLYRANK REPORT OUTBOX DELIVERY'), `Outbox file contains correct formatted report header`);
    }

    // 3. Test Idempotency (Sending same event again)
    console.log('\n--- [Stretch Goal] Testing Idempotency on Duplicate Event ---');
    const stepMock3 = createStepMock();
    const idempotentResult = await makeReport.fn({
        event: { name: 'report/requested', data: { id: reportId, topic: 'cats' } },
        step: stepMock3
    });
    assert(idempotentResult.message.includes('idempotent skip'), `Duplicate report request safely skipped execution`);
    assert(stepMock3.stepsExecuted.length === 0, `No redundant steps were re-executed`);

    // 4. Test Stage 3 Fault Injection & Retry Behavior (topic "fail")
    console.log('\n--- [Stage 3] Testing Fault Injection (topic "fail") ---');
    const failReportId = `rep_fail_${Date.now()}`;
    createReport(failReportId, 'fail');

    const stepMock4 = createStepMock();
    let caughtError = null;
    try {
        await makeReport.fn({
            event: { name: 'report/requested', data: { id: failReportId, topic: 'fail' } },
            step: stepMock4
        });
    } catch (err) {
        caughtError = err;
    }
    assert(caughtError !== null, `makeReport threw intentional error on topic 'fail'`);
    assert(caughtError && caughtError.message === 'The report oven is broken!', `Error message matches: "The report oven is broken!"`);

    // Simulate Inngest onFailure callback after retries exhausted
    if (makeReport.onFailureFn) {
        await makeReport.onFailureFn({
            event: { data: { event: { data: { id: failReportId } } } },
            error: caughtError
        });
        const failedReport = getReport(failReportId);
        assert(failedReport.status === 'failed', `Report state updated to 'failed' via onFailure handler`);
        assert(failedReport.error.includes('broken'), `Report stored failure reason: "${failedReport.error}"`);
    }

    // 5. Test Stage 4 Heartbeat Cron
    console.log('\n--- [Stage 4] Testing Heartbeat Cron Execution ---');
    const stepMock5 = createStepMock();
    const heartbeatResult = await heartbeat.fn({
        event: { name: 'inngest/scheduled.timer' },
        step: stepMock5
    });
    assert(heartbeatResult && heartbeatResult.status === 'ok', `Heartbeat cron completed with status: ok`);
    assert(heartbeatResult.stats && typeof heartbeatResult.stats.total === 'number', `Heartbeat computed active report statistics`);

    // 6. Test Cleanup Cron
    console.log('\n--- [Stretch Goal] Testing Cleanup Cron Execution ---');
    const stepMock6 = createStepMock();
    const cleanupResult = await cleanupCron.fn({
        event: { name: 'inngest/scheduled.timer' },
        step: stepMock6
    });
    assert(cleanupResult && cleanupResult.status === 'ok', `Cleanup cron completed with status: ok`);

    console.log('\n===============================================================');
    console.log(`📊 INNGEST EXECUTION SUMMARY: ${passed} / ${total} Tests Passed`);
    console.log('===============================================================\n');
}

if (require.main === module) {
    runFunctionExecutionTests().catch(console.error);
}

module.exports = { runFunctionExecutionTests };
