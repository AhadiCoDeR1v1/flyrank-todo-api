const Database = require('better-sqlite3');
const path = require('path');

// Connect to SQLite database (creates tasks.db if it doesn't exist)
const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Stage 0: Create tasks table if it does not exist
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0
    );
`);

// Seed initial example tasks ONLY if table is empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;

if (rowCount === 0) {
    console.log('Seeding initial example tasks into database...');
    const insertTask = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    
    insertTask.run('Configure Linode production server', 1);
    insertTask.run('Test local trading bot telemetry', 0);
    insertTask.run('Optimize Spring Boot memory footprint', 0);
}

module.exports = db;
