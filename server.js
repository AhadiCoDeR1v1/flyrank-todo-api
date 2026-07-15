const express = require('express');
const app = express();
const PORT = 3000;


app.use(express.json());

// In-Memory mock data list
let tasks = [
    { id: 1, title: "Configure Linode production server", done: true },
    { id: 2, title: "Test local trading bot telemetry", done: false },
    { id: 3, title: "Optimize Spring Boot memory footprint", done: false }
];


app.get('/', (req, res) => {
    res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});


app.get('/tasks', (req, res) => {
    res.json(tasks);
});

// GET single task by id
app.get('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    res.json(task);
});
app.post('/tasks', (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and cannot be empty" });
    }

    const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

    const newTask = {
        id: nextId,
        title: title.trim(),
        done: false
    };

    tasks.push(newTask);


    res.status(201).json(newTask);
});
app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const { title, done } = req.body;

    if (title === undefined || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }
    if (done === undefined || typeof done !== 'boolean') {
        return res.status(400).json({ error: "Done state is required and must be a boolean value" });
    }

    task.title = title.trim();
    task.done = done;

    res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const index = tasks.findIndex(t => t.id === taskId);

    if (index === -1) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    tasks.splice(index, 1);

    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});