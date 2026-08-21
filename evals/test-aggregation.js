const { getReportData } = require('../src/services/reportData');

function testAggregation() {
    console.log('Testing SQL Aggregation Queries...');
    const data = getReportData();

    console.log('\n--- Aggregation Summary ---');
    console.log(JSON.stringify(data.summary, null, 2));

    console.log('\n--- Top 5 Products by Revenue ---');
    console.table(data.topProducts);

    console.log('\n--- Daily Trend (Last 7 Days) ---');
    console.table(data.dailyTrend);

    console.log(`\nTotal Detailed Orders Retrieved: ${data.orders.length}`);

    // Sanity checks
    if (data.summary.totalOrders !== 200) {
        throw new Error(`Expected 200 total orders, got ${data.summary.totalOrders}`);
    }

    const sumTopProductsRevenue = data.topProducts.reduce((acc, p) => acc + p.total_revenue, 0);
    if (sumTopProductsRevenue > data.summary.totalRevenue * 1.01) {
        throw new Error(`Top products revenue (${sumTopProductsRevenue}) exceeds total revenue (${data.summary.totalRevenue})`);
    }

    console.log('\n✅ SQL Aggregation Queries Passed All Sanity Checks!\n');
}

if (require.main === module) {
    testAggregation();
}

module.exports = { testAggregation };
