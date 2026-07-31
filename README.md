# FlyRank Todo API — Containerized Stack (Assignment A3)

A high-performance RESTful Task Management API built with **Node.js**, **Express.js**, and **PostgreSQL** running in **Docker** orchestrating containerized storage via **Docker Compose**.

This assignment completes the storage evolution:
1. **Assignment A1**: In-memory storage array (*ephemeral*)
2. **Assignment A2**: SQLite local file database (*disk-persisted*)
3. **Assignment A3**: PostgreSQL containerized database server (*production-grade containerized persistence*)

> **Core Architectural Principle:** The public REST API contract (`GET`, `POST`, `PUT`, `DELETE`) remains **100% identical**. Storage engine replacement required modifying only the repository module (`db.js`), proving that persistence is an implementation detail behind the API layer.

---

## ⚡ Quick Start: The One-Command Stack

Start the entire application (Express API + PostgreSQL Database) with one single command:

```bash
# 1. Clone repository & enter directory
git clone https://github.com/AhadiCoDeR1v1/flyrank-todo-api.git
cd flyrank-todo-api

# 2. Copy environment secrets template
cp .env.example .env

# 3. Start full containerized stack
docker compose up -d
```

Access the application immediately at:
- **API Base URL:** `http://localhost:3000`
- **Interactive Swagger API Docs:** `http://localhost:3000/docs`
- **Health & DB Check:** `http://localhost:3000/health`

---

## 🔑 Environment Configuration (`.env`)

Database connection secrets are kept secure using environment variables and are **never** committed to version control (`.env` is added to `.gitignore`).

- `.env.example` *(committed template)*:
  ```env
  DATABASE_URL=postgres://postgres:dev@db:5432/tasks
  PORT=3000
  ```
- `.env` *(local runtime secrets)*:
  ```env
  DATABASE_URL=postgres://postgres:dev@172.17.0.1:5432/tasks
  PORT=3000
  ```

---

## 🗄️ Database Architecture & Storage Scheme

- **Database Engine:** PostgreSQL 16 Alpine container (`postgres:16-alpine`).
- **Volume Mount:** `taskdata:/var/lib/postgresql/data` (ensures data survives container restarts).
- **Auto-Initialization & Seeding:** On startup, `db.js` automatically creates the `tasks` table if missing and seeds 3 initial tasks idempotently if the table is empty.

### PostgreSQL Table Schema (`tasks`)

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE
);
```

---

## 📸 Database Verification Screenshot

![PostgreSQL DB Browser Screenshot](docs/postgres_db_screenshot.png)

*Verification of containerized PostgreSQL tables (`\dt`) and table records (`SELECT * FROM tasks;`) inside `docker exec`.*

---

## 📑 API Reference & Endpoints Table

| Method | Endpoint | Description | Status Codes | Parameterized SQL |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | API Metadata & Overview | `200` | — |
| `GET` | `/health` | Application & Database Healthcheck | `200`, `500` | `SELECT 1` |
| `GET` | `/tasks` | List all tasks (Search, Filter, Sort) | `200` | `SELECT * FROM tasks ...` |
| `GET` | `/tasks/:id` | Get single task by ID | `200`, `400`, `404` | `WHERE id = $1` |
| `POST` | `/tasks` | Create a new task | `201`, `400` | `INSERT ... RETURNING *` |
| `PUT` | `/tasks/:id` | Update task title and completion | `200`, `400`, `404` | `UPDATE ... RETURNING *` |
| `DELETE` | `/tasks/:id` | Delete task by ID | `204`, `400`, `404` | `DELETE ... RETURNING *` |
| `GET` | `/stats` | Aggregate task statistics | `200` | `COUNT(*)` |

---

## 🧪 Sample `curl -i` Execution Examples

### 1. Retrieve All Tasks (`GET /tasks`)
```bash
curl -i http://localhost:3000/tasks
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[
  {"id":1,"title":"Configure Linode production server","done":true},
  {"id":2,"title":"Test local trading bot telemetry","done":false},
  {"id":3,"title":"Optimize Spring Boot memory footprint","done":false}
]
```

### 2. Create Task (`POST /tasks`)
```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Dockerize Node.js application"}'
```
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Dockerize Node.js application","done":false}
```

### 3. Update Task (`PUT /tasks/2`)
```bash
curl -i -X PUT http://localhost:3000/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{"title":"Test local trading bot telemetry","done":true}'
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":2,"title":"Test local trading bot telemetry","done":true}
```

### 4. Delete Task (`DELETE /tasks/3`)
```bash
curl -i -X DELETE http://localhost:3000/tasks/3
```
```http
HTTP/1.1 204 No Content
```

---

## 🛠️ Data Persistence Proof

To verify data persistence across a container and stack restart:

1. Create a task via API: `POST /tasks` -> Returns ID 4.
2. Stop stack: `docker compose down`
3. Restart stack: `docker compose up -d`
4. Query API: `GET /tasks` -> Task ID 4 is preserved due to volume `taskdata`.

---

## 📄 License
ISC License. Built for FlyRank Backend Engineering Internship.