const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { getReportData } = require('../src/services/reportData');
const { buildReportHtml } = require('../src/services/pdfRenderer');

async function generatePdfPreview() {
    console.log('Generating PDF visual screenshot preview...');
    const data = getReportData();
    const html = buildReportHtml(data);

    const docsDir = path.join(__dirname, '../docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const previewPath = path.join(docsDir, 'pdf_report_page1.png');

    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage({
            viewport: { width: 794, height: 1123 } // A4 pixel dimensions at 96 DPI
        });
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.screenshot({
            path: previewPath,
            fullPage: false
        });
        console.log(`✅ Visual screenshot of PDF Report saved to: ${previewPath}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    generatePdfPreview().catch(console.error);
}

module.exports = { generatePdfPreview };
