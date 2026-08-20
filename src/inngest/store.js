/**
 * In-memory data store for asynchronous background reports.
 * Tracks report lifecycle: pending -> done | failed.
 */

const reportsMap = new Map();

/**
 * Initialize a new pending report entry in memory
 */
function createReport(id, topic) {
    const now = new Date().toISOString();
    const report = {
        id,
        topic,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
    reportsMap.set(id, report);
    return report;
}

/**
 * Retrieve report by its unique ID
 */
function getReport(id) {
    return reportsMap.get(id);
}

/**
 * Retrieve all stored reports
 */
function getAllReports() {
    return Array.from(reportsMap.values());
}

/**
 * Update an existing report with new fields (status, result, error, etc.)
 */
function updateReport(id, updates) {
    const existing = reportsMap.get(id);
    if (!existing) return null;

    const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
    };
    reportsMap.set(id, updated);
    return updated;
}

/**
 * Compute aggregate statistics across all reports
 */
function getReportStats() {
    let pending = 0;
    let done = 0;
    let failed = 0;

    for (const r of reportsMap.values()) {
        if (r.status === 'pending') pending++;
        else if (r.status === 'done') done++;
        else if (r.status === 'failed') failed++;
    }

    return {
        pending,
        done,
        failed,
        total: reportsMap.size
    };
}

/**
 * Remove completed reports older than maxAgeMs (default: 10 minutes)
 */
function cleanupOldReports(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, r] of reportsMap.entries()) {
        if (r.status === 'done' && (now - new Date(r.updatedAt).getTime()) > maxAgeMs) {
            reportsMap.delete(id);
            cleaned++;
        }
    }
    return cleaned;
}

module.exports = {
    reportsMap,
    createReport,
    getReport,
    getAllReports,
    updateReport,
    getReportStats,
    cleanupOldReports
};
