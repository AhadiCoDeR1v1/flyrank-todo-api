const express = require('express');
const swaggerUi = require('swagger-ui-express');   // Import UI rendering library
const swaggerDocument = require('./openapi.json');
const app = express();
const PORT = 3000;


app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const db = require('./db');

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
app.post('/tasks', (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and cannot be empty" });
    }

    const trimmedTitle = title.trim();
    const info = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(trimmedTitle);

    const newTask = {
        id: Number(info.lastInsertRowid),
        title: trimmedTitle,
        done: false
    };

    res.status(201).json(newTask);
});
app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!existingTask) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const { title, done } = req.body;

    if (title === undefined || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }
    if (done === undefined || typeof done !== 'boolean') {
        return res.status(400).json({ error: "Done state is required and must be a boolean value" });
    }

    const trimmedTitle = title.trim();
    const doneVal = done ? 1 : 0;

    db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(trimmedTitle, doneVal, taskId);

    const updatedTask = {
        id: taskId,
        title: trimmedTitle,
        done: done
    };

    res.json(updatedTask);
});

app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!existingTask) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});