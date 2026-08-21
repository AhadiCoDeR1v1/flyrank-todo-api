const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/sqlite');
const { getReportData } = require('../services/reportData');
const { renderPdf } = require('../services/pdfRenderer');
const { inngest } = require('../inngest/client');
const { createReport, getReport, getAllReports, getReportStats } = require('../inngest/store');

const router = express.Router();

/**
 * POST /reports
 * Stage 4 & 5: Generates a complete PDF report from SQLite data.
 * - Idempotency Guard (Stage 5): If a report was already generated today, returns existing record (HTTP 200)
 * - Force Override: If { "force": true } is provided, skips check and generates a fresh report (HTTP 201)
 */
router.post('/', async (req, res) => {
    const { force, days } = req.body || {};
    const today = new Date().toISOString().substring(0, 10);

    try {
        // Stage 5 Idempotency Guard: Check if a report was already generated today
        if (!force) {
            const existingReport = db.prepare(`
                SELECT id, path, created_at, created_date
                FROM reports
                WHERE created_date = ?
                ORDER BY id DESC
                LIMIT 1;
            `).get(today);

            if (existingReport && fs.existsSync(existingReport.path)) {
                return res.status(200).json({
                    id: existingReport.id,
                    file: `/reports/${existingReport.id}/file`,
                    created_at: existingReport.created_at,
                    cached: true,
                    message: "Report already generated today. Use { 'force': true } to force fresh generation."
                });
            }
        }

        // 1. Query aggregated data from SQLite
        const reportData = getReportData({ days: days || 30 });

        // 2. Generate unique filename on disk
        const reportId = Date.now();
        const outputFilename = `sales-report-${reportId}.pdf`;
        const outputPath = path.join(__dirname, '../../reports', outputFilename);

        // 3. Render HTML to PDF via Playwright & Chromium
        await renderPdf(reportData, outputPath);

        // 4. Save metadata record to SQLite reports table
        const insertStmt = db.prepare(`
            INSERT INTO reports (path, created_at, created_date)
            VALUES (?, ?, ?);
        `);
        const result = insertStmt.run(outputPath, new Date().toISOString(), today);
        const newId = Number(result.lastInsertRowid);

        // Rename/alias to standard ID path if needed
        return res.status(201).json({
            id: newId,
            file: `/reports/${newId}/file`
        });
    } catch (err) {
        console.error('Error generating PDF report:', err);
        return res.status(500).json({
            error: 'Failed to generate PDF report',
            message: err.message
        });
    }
});

/**
 * POST /reports/async
 * Inngest Background Worker endpoint (A7/A8 integration)
 */
router.post('/async', async (req, res) => {
    const { topic } = req.body || {};
    const cleanTopic = (topic && typeof topic === 'string') ? topic.trim() : 'sales';
    const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    createReport(id, cleanTopic);

    inngest.send({
        name: 'report/requested',
        data: { id, topic: cleanTopic }
    }).catch((err) => {
        console.warn(`[Inngest Async Notice] Event dispatch notification (${err.message}).`);
    });

    return res.status(202).json({
        id,
        status: 'pending'
    });
});

/**
 * GET /reports
 * Control Panel List Endpoint: lists all generated reports in SQLite
 */
router.get('/', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT id, path, created_at, created_date
            FROM reports
            ORDER BY id DESC;
        `).all();

        const reports = rows.map(r => ({
            id: r.id,
            file: `/reports/${r.id}/file`,
            created_at: r.created_at,
            created_date: r.created_date,
            existsOnDisk: fs.existsSync(r.path)
        }));

        return res.json({
            total: reports.length,
            reports
        });
    } catch (err) {
        console.error('Error listing reports:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /reports/:id
 * Status / Metadata Endpoint
 */
router.get('/:id', (req, res) => {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId)) {
        // Fallback for async in-memory ID strings (rep_...)
        const memReport = getReport(req.params.id);
        if (memReport) return res.json(memReport);
        return res.status(404).json({ error: 'Report not found', id: req.params.id });
    }

    try {
        const row = db.prepare(`
            SELECT id, path, created_at, created_date
            FROM reports
            WHERE id = ?;
        `).get(reportId);

        if (!row) {
            return res.status(404).json({
                error: `Report ${req.params.id} not found`
            });
        }

        return res.json({
            id: row.id,
            file: `/reports/${row.id}/file`,
            created_at: row.created_at,
            created_date: row.created_date
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /reports/:id/file
 * Serve PDF File by Link: streams binary file from disk
 */
router.get('/:id/file', (req, res) => {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
    }

    try {
        const row = db.prepare(`
            SELECT id, path
            FROM reports
            WHERE id = ?;
        `).get(reportId);

        if (!row) {
            return res.status(404).json({ error: `Report ${reportId} not found` });
        }

        const absolutePath = path.resolve(row.path);

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'Report file missing from disk' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="sales-report-${row.id}.pdf"`);
        return res.sendFile(absolutePath);
    } catch (err) {
        console.error('Error serving PDF file:', err);
        return res.status(500).json({ error: 'Error streaming file', message: err.message });
    }
});

module.exports = router;
