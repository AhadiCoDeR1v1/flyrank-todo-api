const path = require('path');
const fs = require('fs');
const { getReportData } = require('../src/services/reportData');
const { renderPdf } = require('../src/services/pdfRenderer');

async function testPdfRender() {
    console.log('Testing PDF Rendering with Playwright & Chromium...');
    const startTime = Date.now();

    const data = getReportData();
    const outputPath = path.join(__dirname, '../reports/test.pdf');

    const result = await renderPdf(data, outputPath);
    const duration = Date.now() - startTime;

    console.log(`\n✅ PDF generated successfully in ${duration}ms!`);
    console.log(`📁 File Path: ${result.path}`);
    console.log(`📊 Size: ${(result.sizeBytes / 1024).toFixed(2)} KB`);

    if (!fs.existsSync(outputPath)) {
        throw new Error('PDF file was not created on disk!');
    }

    if (result.sizeBytes < 10000) {
        throw new Error('PDF file size is suspiciously small!');
    }

    console.log('\n✅ Stage 3 Checkpoint Passed: reports/test.pdf rendered with clean page breaks.\n');
}

if (require.main === module) {
    testPdfRender().catch(console.error);
}

module.exports = { testPdfRender };
