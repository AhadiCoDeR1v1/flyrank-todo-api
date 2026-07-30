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

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});


app.get('/tasks', (req, res) => {
    const rows = db.prepare('SELECT * FROM tasks').all();
    res.json(rows.map(formatTask));
});

// GET single task by id
app.get('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID format" });
    }

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

    if (!row) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    res.json(formatTask(row));
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