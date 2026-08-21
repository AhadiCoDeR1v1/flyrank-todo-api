const fs = require('fs');
const path = require('path');
const { inngest } = require('./client');
const { getReport, updateReport, getReportStats, cleanupOldReports } = require('./store');
const { db } = require('../db/sqlite');
const { getReportData } = require('../services/reportData');
const { renderPdf } = require('../services/pdfRenderer');

/**
 * Stage 1: Basic Inngest Function
 * Triggered by: test/hello
 * Sleeps for 5 seconds and returns a greeting.
 */
const sayHello = inngest.createFunction(
    {
        id: 'say-hello',
        name: 'Say Hello',
        triggers: [{ event: 'test/hello' }]
    },
    async ({ event, step }) => {
        await step.sleep('wait-5-seconds', '5s');
        return 'Hello from the background!';
    }
);

/**
 * Stage 2, 3 & Stretch: Asynchronous Report Generation
 * Triggered by: report/requested
 * - Concurrency limit: 2
 * - Retries: 2 (Total 3 attempts before failure)
 * - Sleep: 8s simulation
 * - Build step with error simulation for topic 'fail'
 * - Outbox text file artifact generation
 * - Idempotency protection against duplicate event delivery
 */
const makeReport = inngest.createFunction(
    {
        id: 'make-report',
        name: 'Make Report',
        retries: 2,
        concurrency: {
            limit: 2
        },
        triggers: [{ event: 'report/requested' }],
        onFailure: async ({ event, error }) => {
            const payload = event?.data?.event?.data;
            if (payload && payload.id) {
                updateReport(payload.id, {
                    status: 'failed',
                    error: error?.message || 'Report generation failed after max retries'
                });
                console.error(`[Inngest make-report] Run failed permanently for report ${payload.id}: ${error?.message}`);
            }
        }
    },
    async ({ event, step }) => {
        const { id, topic } = event.data;

        // Idempotency Check: Don't rebuild if already processed
        const existing = getReport(id);
        if (existing && existing.status === 'done') {
            return {
                id,
                message: 'Report already processed (idempotent skip)',
                status: 'done',
                result: existing.result
            };
        }

        // Step 1: Simulate heavy computational / AI / export task
        await step.sleep('do-the-slow-work', '8s');

        // Step 2: Build report result & persist to store and outbox
        const result = await step.run('build-report', async () => {
            // Stage 3 Fault Injection: Topic 'fail' simulates broken downstream dependency
            if (topic === 'fail') {
                throw new Error('The report oven is broken!');
            }

            const reportData = {
                title: `Market & Sentiment Intelligence Report: ${topic}`,
                summary: `Comprehensive analytical breakdown for topic '${topic}'. Automated data ingestion completed successfully with optimal trend indicators.`,
                metrics: {
                    sentimentScore: 0.88,
                    confidenceScore: 0.96,
                    dataPointsEvaluated: 1250,
                    processingLatencyMs: 8024
                },
                topic,
                generatedAt: new Date().toISOString(),
                version: '1.0.0'
            };

            // Stretch Goal: Stand-in for email / outbox persistence
            const outboxDir = path.join(__dirname, '../../outbox');
            if (!fs.existsSync(outboxDir)) {
                fs.mkdirSync(outboxDir, { recursive: true });
            }
            const outboxFilePath = path.join(outboxDir, `${id}.txt`);
            const outboxContent = [
                `==================================================`,
                `FLYRANK REPORT OUTBOX DELIVERY — ID: ${id}`,
                `==================================================`,
                `Topic:        ${topic}`,
                `Generated At: ${reportData.generatedAt}`,
                `Summary:      ${reportData.summary}`,
                `Sentiment:    ${reportData.metrics.sentimentScore}`,
                `==================================================\n`
            ].join('\n');

            fs.writeFileSync(outboxFilePath, outboxContent, 'utf-8');

            // Update in-memory state
            updateReport(id, {
                status: 'done',
                result: reportData,
                outboxPath: outboxFilePath
            });

            return reportData;
        });

        return result;
    }
);

/**
 * Stage 4: Cron Heartbeat Function
 * Schedule: Every minute (* * * * *)
 * Logs aggregate counts of pending, done, and failed reports.
 */
const heartbeat = inngest.createFunction(
    {
        id: 'heartbeat',
        name: 'Heartbeat Cron',
        triggers: [{ cron: '* * * * *' }]
    },
    async ({ step }) => {
        const stats = await step.run('log-report-summary', async () => {
            const currentStats = getReportStats();
            console.log(
                `[Heartbeat Cron] Reports Summary: ${currentStats.pending} pending, ${currentStats.done} done, ${currentStats.failed} failed (Total: ${currentStats.total})`
            );
            return currentStats;
        });

        return {
            status: 'ok',
            stats,
            executedAt: new Date().toISOString()
        };
    }
);

/**
 * Stretch Goal: Periodic Cleanup Cron Function
 * Schedule: Every 10 minutes
 * Purges completed reports older than 10 minutes to manage memory footprint.
 */
const cleanupCron = inngest.createFunction(
    {
        id: 'cleanup-old-reports',
        name: 'Cleanup Old Reports',
        triggers: [{ cron: '*/10 * * * *' }]
    },
    async ({ step }) => {
        const cleanedCount = await step.run('purge-old-reports', async () => {
            const count = cleanupOldReports(10 * 60 * 1000);
            if (count > 0) {
                console.log(`[Cleanup Cron] Purged ${count} expired reports.`);
            }
            return count;
        });

        return {
            status: 'ok',
            cleanedCount,
            executedAt: new Date().toISOString()
        };
    }
);

/**
 * Assignment A8 Stretch Goal: Weekly PDF Report Cron Function
 * Schedule: Every Monday at 08:00 UTC (0 8 * * 1)
 * Automatically queries SQLite, renders PDF via Playwright, and saves report artifact.
 */
const weeklyMondayReportCron = inngest.createFunction(
    {
        id: 'weekly-monday-pdf-report',
        name: 'Weekly Monday PDF Report',
        triggers: [{ cron: '0 8 * * 1' }]
    },
    async ({ step }) => {
        // Step 1: Query SQL Aggregations
        const reportData = await step.run('query-sql-data', async () => {
            return getReportData();
        });

        // Step 2: Render PDF using Playwright & Chromium
        const pdfResult = await step.run('render-pdf-document', async () => {
            const today = new Date().toISOString().substring(0, 10);
            const reportId = Date.now();
            const outputFilename = `sales-report-monday-${reportId}.pdf`;
            const outputPath = path.join(__dirname, '../../reports', outputFilename);

            await renderPdf(reportData, outputPath);

            const insertStmt = db.prepare(`
                INSERT INTO reports (path, created_at, created_date)
                VALUES (?, ?, ?);
            `);
            const result = insertStmt.run(outputPath, new Date().toISOString(), today);
            const newId = Number(result.lastInsertRowid);

            return {
                id: newId,
                path: outputPath,
                file: `/reports/${newId}/file`
            };
        });

        console.log(`[Monday Cron] Generated weekly PDF report ID #${pdfResult.id} at ${pdfResult.file}`);
        return {
            status: 'ok',
            report: pdfResult,
            executedAt: new Date().toISOString()
        };
    }
);

module.exports = {
    sayHello,
    makeReport,
    heartbeat,
    cleanupCron,
    weeklyMondayReportCron
};
