const express = require('express');
const { inngest } = require('../inngest/client');
const { createReport, getReport, getAllReports, getReportStats } = require('../inngest/store');

const router = express.Router();

/**
 * POST /reports
 * Fast Door: Immediately accepts the request, persists initial pending state,
 * dispatches the background event to Inngest, and responds with 202 Accepted.
 */
router.post('/', async (req, res) => {
    const { topic } = req.body || {};

    // Strict input validation guard — reject invalid inputs at the door (HTTP 400)
    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        return res.status(400).json({
            error: 'Validation failed',
            field: 'topic',
            message: "Field 'topic' is required and must be a non-empty string"
        });
    }

    if (topic.length > 500) {
        return res.status(400).json({
            error: 'Validation failed',
            field: 'topic',
            message: "Field 'topic' must be 500 characters or fewer"
        });
    }

    try {
        const cleanTopic = topic.trim();
        const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // 1. Save in-memory status as pending
        createReport(id, cleanTopic);

        // 2. Dispatch event to Inngest background engine (non-blocking)
        inngest.send({
            name: 'report/requested',
            data: {
                id,
                topic: cleanTopic
            }
        }).catch((inngestErr) => {
            console.warn(`[Inngest Event Notice] Event dispatch notification (${inngestErr.message}). Pending report ${id} stored.`);
        });

        // 3. Return 202 Accepted immediately without waiting for background computation
        return res.status(202).json({
            id,
            status: 'pending'
        });
    } catch (err) {
        console.error('Error handling report creation:', err);
        return res.status(500).json({
            error: 'Internal server error while processing report request',
            message: err.message
        });
    }
});

/**
 * GET /reports
 * Control Panel List Endpoint: returns all created reports with aggregate stats.
 */
router.get('/', (req, res) => {
    const reports = getAllReports();
    const stats = getReportStats();
    return res.json({
        stats,
        reports
    });
});

/**
 * GET /reports/:id
 * Status Polling Endpoint: returns current lifecycle state (pending, done, or failed).
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const report = getReport(id);

    if (!report) {
        return res.status(404).json({
            error: 'Report not found',
            id
        });
    }

    return res.json(report);
});

module.exports = router;
