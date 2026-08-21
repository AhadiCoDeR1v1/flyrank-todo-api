const { db } = require('../src/db/sqlite');

const PRODUCTS = [
    { name: 'Pro Subscription', basePrice: 49.00 },
    { name: 'Enterprise Seat', basePrice: 149.00 },
    { name: 'SEO Audit Kit', basePrice: 99.00 },
    { name: 'API Credits Bundle', basePrice: 29.00 },
    { name: 'Developer Addon', basePrice: 19.99 },
    { name: 'Custom Domain SSL', basePrice: 12.50 }
];

const FIRST_NAMES = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George', 'Hannah',
    'Ian', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nadia', 'Oliver', 'Paula',
    'Quinn', 'Rachel', 'Sam', 'Tara', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zack'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'
];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function getRandomDateWithinDays(daysAgo) {
    const now = new Date();
    const past = new Date(now.getTime() - (Math.random() * daysAgo * 24 * 60 * 60 * 1000));
    return past.toISOString();
}

function seedDatabase() {
    console.log('Seeding SQLite database report.db with 200 orders...');

    // 1. Clear existing orders to ensure seed idempotency (safe to run twice)
    db.exec('DELETE FROM orders;');
    try {
        db.exec("DELETE FROM sqlite_sequence WHERE name='orders';");
    } catch (_) {}

    // 2. Prepare batch insert statement
    const insertStmt = db.prepare(`
        INSERT INTO orders (customer, product, amount, created_at)
        VALUES (?, ?, ?, ?);
    `);

    // 3. Generate 200 realistic order rows
    const TOTAL_ROWS = 200;
    for (let i = 0; i < TOTAL_ROWS; i++) {
        const customerName = `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
        const productObj = getRandomItem(PRODUCTS);
        // Vary price slightly around base price
        const variation = getRandomNumber(-5.00, 15.00);
        const amount = Math.max(5.00, Math.round((productObj.basePrice + variation) * 100) / 100);
        const createdAt = getRandomDateWithinDays(30);

        insertStmt.run(customerName, productObj.name, amount, createdAt);
    }

    // 4. Verify count
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM orders;').get();
    console.log(`✅ Seed Complete: Database contains ${countQuery.count} orders.`);
    return countQuery.count;
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
