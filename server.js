const express = require('express');
const swaggerUi = require('swagger-ui-express');   // Import UI rendering library
const swaggerDocument = require('./openapi.json');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const db = require('./db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Server initialized and connected to Supabase');

// Helper to format database task row into API response structure
const formatTask = (row) => ({
    id: row.id,
    title: row.title,
    done: Boolean(row.done)
});

app.get('/', (req, res) => {
    res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: "ok", db: "ok" });
    } catch (err) {
        res.status(500).json({ status: "error", db: err.message });
    }
});

// --- AUTHENTICATION ROUTES (Stage 1) ---

// POST /auth/signup - Register a new user account with Supabase
app.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /auth/login - Authenticate user credentials & return JWT access token
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error || !data.session) {
            return res.status(401).json({ error: error ? error.message : "Invalid login credentials" });
        }

        res.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PUBLIC & PROTECTED GATE ROUTES (Stage 2) ---

// GET /public/info - Public route accessible by anyone without authentication
app.get('/public/info', (req, res) => {
    res.json({ message: "Welcome stranger! This info is public." });
});

// GET /protected/profile - Protected route requiring Authorization header check
app.get('/protected/profile', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    res.json({ message: "Access token presented successfully", token_received: true });
});


app.get('/tasks', async (req, res) => {
    try {
        const { search, done, sort } = req.query;
        let query = 'SELECT * FROM tasks';
        const conditions = [];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`title ILIKE $${params.length}`);
        }

        if (done !== undefined) {
            const doneVal = (done === 'true' || done === '1');
            params.push(doneVal);
            conditions.push(`done = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        if (sort === 'title') {
            query += ' ORDER BY title ASC';
        } else {
            query += ' ORDER BY id ASC';
        }

        const result = await db.query(query, params);
        res.json(result.rows.map(formatTask));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET statistics (Bonus endpoint)
app.get('/stats', async (req, res) => {
    try {
        const totalRes = await db.query('SELECT COUNT(*) FROM tasks');
        const completedRes = await db.query('SELECT COUNT(*) FROM tasks WHERE done = true');
        const pendingRes = await db.query('SELECT COUNT(*) FROM tasks WHERE done = false');

        res.json({
            total: parseInt(totalRes.rows[0].count, 10),
            completed: parseInt(completedRes.rows[0].count, 10),
            pending: parseInt(pendingRes.rows[0].count, 10)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single task by id
app.get('/tasks/:id', async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    try {
        const result = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Task ${req.params.id} not found` });
        }

        res.json(formatTask(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/tasks', async (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and cannot be empty" });
    }

    try {
        const trimmedTitle = title.trim();
        const result = await db.query(
            'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
            [trimmedTitle, false]
        );
        res.status(201).json(formatTask(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/tasks/:id', async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    const { title, done } = req.body;

    if (title === undefined || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }
    if (done === undefined || typeof done !== 'boolean') {
        return res.status(400).json({ error: "Done state is required and must be a boolean value" });
    }

    try {
        const trimmedTitle = title.trim();
        const result = await db.query(
            'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
            [trimmedTitle, done, taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Task ${req.params.id} not found` });
        }

        res.json(formatTask(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/tasks/:id', async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    try {
        const result = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Task ${req.params.id} not found` });
        }

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});