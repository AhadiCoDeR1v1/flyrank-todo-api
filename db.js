require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:dev@localhost:5432/tasks';

const pool = new Pool({
    connectionString,
});

// Stage 1: Auto-create table & seed initial tasks on boot
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE
            );
        `);

        const res = await pool.query('SELECT COUNT(*) FROM tasks');
        const count = parseInt(res.rows[0].count, 10);

        if (count === 0) {
            console.log('Seeding initial example tasks into PostgreSQL database...');
            await pool.query(`
                INSERT INTO tasks (title, done) VALUES
                ($1, $2),
                ($3, $4),
                ($5, $6);
            `, [
                'Configure Linode production server', true,
                'Test local trading bot telemetry', false,
                'Optimize Spring Boot memory footprint', false
            ]);
        }
    } catch (err) {
        console.error('Error initializing PostgreSQL database:', err.message);
    }
};

// Run initialization
initDb();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
