const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

/**
 * Generate a beautifully styled, print-optimized HTML string from report data
 */
function buildReportHtml(reportData) {
    const { summary, topProducts, dailyTrend, orders, generatedAt } = reportData;
    const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const topProductsRows = topProducts.map((p, idx) => `
        <tr>
            <td style="text-align: center; font-weight: bold;">#${idx + 1}</td>
            <td><strong>${p.product}</strong></td>
            <td style="text-align: right;">${p.order_count}</td>
            <td style="text-align: right;">$${p.avg_price.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #1e3a8a;">$${p.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');

    const dailyTrendRows = dailyTrend.map(d => `
        <tr>
            <td><strong>${d.report_date}</strong></td>
            <td style="text-align: right;">${d.order_count}</td>
            <td style="text-align: right; font-weight: bold; color: #047857;">$${d.daily_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');

    const ordersRows = orders.map(o => `
        <tr>
            <td style="text-align: center; color: #64748b;">${o.id}</td>
            <td><strong>${o.customer}</strong></td>
            <td>${o.product}</td>
            <td style="text-align: right; font-weight: 600;">$${o.amount.toFixed(2)}</td>
            <td style="color: #64748b; font-size: 11px;">${o.created_at.replace('T', ' ')}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FlyRank Executive Sales Report</title>
    <style>
        /* CSS Reset & Print Variables */
        @page {
            size: A4;
            margin: 15mm 12mm 15mm 12mm;
            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px;
                color: #94a3b8;
            }
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.4;
            font-size: 12px;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
        }

        /* Header Section */
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }

        .brand-title {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
        }

        .brand-subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }

        .report-meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
        }

        /* KPI Cards Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }

        .kpi-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
        }

        .kpi-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 6px;
        }

        .kpi-value {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
        }

        .kpi-sub {
            font-size: 10px;
            color: #10b981;
            font-weight: 600;
            margin-top: 4px;
        }

        /* Tables & Page Break Handling */
        .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 20px 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-left: 4px solid #3b82f6;
            padding-left: 8px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            page-break-inside: auto;
        }

        /* Critical Print CSS: Repeating Table Header & Clean Row Breaks */
        thead {
            display: table-header-group;
        }

        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            font-size: 11px;
            text-align: left;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
        }

        td {
            padding: 7px 10px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 11.5px;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        .footer-note {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <div>
            <div class="brand-title">FlyRank Sales & Revenue Executive Report</div>
            <div class="brand-subtitle">Automated Data-to-Document Pipeline · Verified SQL Aggregation</div>
        </div>
        <div class="report-meta">
            <div><strong>Generated:</strong> ${formattedDate}</div>
            <div><strong>Total Records:</strong> ${summary.totalOrders}</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Total Revenue</div>
            <div class="kpi-value">$${summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div class="kpi-sub">Across 200 orders</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total Order Volume</div>
            <div class="kpi-value">${summary.totalOrders}</div>
            <div class="kpi-sub">Active customers</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Average Order Value</div>
            <div class="kpi-value">$${summary.avgOrderValue.toFixed(2)}</div>
            <div class="kpi-sub">Min: $${summary.minOrderValue.toFixed(2)} · Max: $${summary.maxOrderValue.toFixed(2)}</div>
        </div>
    </div>

    <div class="section-title">Top 5 Products by Revenue Performance</div>
    <table>
        <thead>
            <tr>
                <th style="width: 8%; text-align: center;">Rank</th>
                <th style="width: 38%;">Product Tier</th>
                <th style="width: 18%; text-align: right;">Orders Sold</th>
                <th style="width: 18%; text-align: right;">Avg Price</th>
                <th style="width: 18%; text-align: right;">Gross Revenue</th>
            </tr>
        </thead>
        <tbody>
            ${topProductsRows}
        </tbody>
    </table>

    <div class="section-title">Recent 7-Day Revenue Trend</div>
    <table>
        <thead>
            <tr>
                <th style="width: 40%;">Date</th>
                <th style="width: 30%; text-align: right;">Daily Order Count</th>
                <th style="width: 30%; text-align: right;">Daily Gross Revenue</th>
            </tr>
        </thead>
        <tbody>
            ${dailyTrendRows}
        </tbody>
    </table>

    <div class="section-title">Full Detailed Transaction Log (${orders.length} Rows)</div>
    <table>
        <thead>
            <tr>
                <th style="width: 8%; text-align: center;">ID</th>
                <th style="width: 28%;">Customer Name</th>
                <th style="width: 30%;">Product Ordered</th>
                <th style="width: 16%; text-align: right;">Amount</th>
                <th style="width: 18%;">Timestamp</th>
            </tr>
        </thead>
        <tbody>
            ${ordersRows}
        </tbody>
    </table>

    <div class="footer-note">
        This document was automatically generated by FlyRank PDF Engine using SQLite aggregation and Playwright Chromium headless printing.
    </div>
</body>
</html>
    `.trim();
}

/**
 * Render HTML report into a high-quality A4 PDF artifact on disk
 */
async function renderPdf(reportData, outputPath) {
    const htmlContent = buildReportHtml(reportData);

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Launch headless Chromium
    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle' });

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                bottom: '15mm',
                left: '12mm',
                right: '12mm'
            }
        });

        const stats = fs.statSync(outputPath);
        return {
            path: outputPath,
            sizeBytes: stats.size
        };
    } finally {
        await browser.close();
    }
}

module.exports = {
    buildReportHtml,
    renderPdf
};
