/**
 * AI-Generated PDF Generator Implementation (Quarantined in ai-version/pdf-generator/)
 * Generated from Initial Specification Prompt
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const db = new DatabaseSync(path.join(__dirname, 'report-ai.db'));

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer TEXT,
        product TEXT,
        amount REAL,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT,
        created_at TEXT,
        created_date TEXT
    );
`);

// POST /reports
app.post('/reports', async (req, res) => {
    const { force } = req.body || {};
    const today = new Date().toISOString().substring(0, 10);

    if (!force) {
        const existing = db.prepare('SELECT * FROM reports WHERE created_date = ? LIMIT 1').get(today);
        if (existing) {
            return res.status(200).json({
                id: existing.id,
                file: `/reports/${existing.id}/file`
            });
        }
    }

    // Queries
    const totals = db.prepare('SELECT COUNT(*) as count, SUM(amount) as revenue FROM orders').get();
    const topProducts = db.prepare('SELECT product, SUM(amount) as rev FROM orders GROUP BY product ORDER BY rev DESC LIMIT 5').all();
    const allOrders = db.prepare('SELECT * FROM orders').all();

    // HTML template
    const html = `
        <html>
        <head>
            <style>
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 5px; }
                tr { break-inside: avoid; }
                thead { display: table-header-group; }
            </style>
        </head>
        <body>
            <h1>Sales Report</h1>
            <p>Total Orders: ${totals.count || 0}</p>
            <p>Total Revenue: $${totals.revenue || 0}</p>
            <h2>Top Products</h2>
            <table>
                <thead><tr><th>Product</th><th>Revenue</th></tr></thead>
                <tbody>
                    ${topProducts.map(p => `<tr><td>${p.product}</td><td>$${p.rev}</td></tr>`).join('')}
                </tbody>
            </table>
            <h2>All Orders</h2>
            <table>
                <thead><tr><th>ID</th><th>Customer</th><th>Product</th><th>Amount</th></tr></thead>
                <tbody>
                    ${allOrders.map(o => `<tr><td>${o.id}</td><td>${o.customer}</td><td>${o.product}</td><td>$${o.amount}</td></tr>`).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const reportsDir = path.join(__dirname, 'reports-ai');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const pdfPath = path.join(reportsDir, `report-${Date.now()}.pdf`);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: pdfPath, format: 'A4' });
    await browser.close();

    const insert = db.prepare('INSERT INTO reports (path, created_at, created_date) VALUES (?, ?, ?)');
    const result = insert.run(pdfPath, new Date().toISOString(), today);
    const id = Number(result.lastInsertRowid);

    res.status(201).json({
        id,
        file: `/reports/${id}/file`
    });
});

// GET /reports/:id
app.get('/reports/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
});

// GET /reports/:id/file
app.get('/reports/:id/file', (req, res) => {
    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!row || !fs.existsSync(row.path)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(row.path);
});

if (require.main === module) {
    app.listen(3002, () => console.log('AI PDF Server running on port 3002'));
}

module.exports = { app, db };
