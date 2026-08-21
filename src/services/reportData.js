const { db } = require('../db/sqlite');

/**
 * Stage 2: SQL Aggregation Query Engine
 * Extracts key business metrics from 200 raw order rows.
 */
function getReportData(options = {}) {
    const daysLimit = options.days || 30;

    // 1. Total number of orders, total revenue, and average order value
    const totalsQuery = db.prepare(`
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(amount), 0) as total_revenue,
            COALESCE(AVG(amount), 0) as avg_order_value,
            COALESCE(MIN(amount), 0) as min_order_value,
            COALESCE(MAX(amount), 0) as max_order_value
        FROM orders;
    `).get();

    // 2. Top 5 products by revenue
    const topProductsQuery = db.prepare(`
        SELECT 
            product,
            COUNT(*) as order_count,
            ROUND(SUM(amount), 2) as total_revenue,
            ROUND(AVG(amount), 2) as avg_price
        FROM orders
        GROUP BY product
        ORDER BY total_revenue DESC
        LIMIT 5;
    `).all();

    // 3. Orders and revenue trend per day for the last 7 active days
    const dailyTrendQuery = db.prepare(`
        SELECT 
            SUBSTR(created_at, 1, 10) as report_date,
            COUNT(*) as order_count,
            ROUND(SUM(amount), 2) as daily_revenue
        FROM orders
        GROUP BY SUBSTR(created_at, 1, 10)
        ORDER BY report_date DESC
        LIMIT 7;
    `).all();

    // 4. All detailed order records (for the multi-page detailed breakdown table)
    const allOrdersQuery = db.prepare(`
        SELECT 
            id,
            customer,
            product,
            ROUND(amount, 2) as amount,
            SUBSTR(created_at, 1, 19) as created_at
        FROM orders
        ORDER BY id ASC;
    `).all();

    const reportData = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalOrders: totalsQuery.total_orders,
            totalRevenue: Math.round(totalsQuery.total_revenue * 100) / 100,
            avgOrderValue: Math.round(totalsQuery.avg_order_value * 100) / 100,
            minOrderValue: Math.round(totalsQuery.min_order_value * 100) / 100,
            maxOrderValue: Math.round(totalsQuery.max_order_value * 100) / 100
        },
        topProducts: topProductsQuery,
        dailyTrend: dailyTrendQuery,
        orders: allOrdersQuery
    };

    return reportData;
}

module.exports = { getReportData };
