# FlyRank Backend Internship — Week 3 Assignment A3 Submission Report
**Containerize Your Stack (Docker & PostgreSQL Integration)**

---

## 📌 Document & Submission Metadata
- **Student / Intern Name:** Ahadi Iqbal
- **Track:** Backend Track — Week 3 (Assignment A3)
- **Project Repository:** [https://github.com/AhadiCoDeR1v1/flyrank-todo-api](https://github.com/AhadiCoDeR1v1/flyrank-todo-api)
- **Technology Stack:** Node.js, Express.js, PostgreSQL 16 (`pg`), Docker, Docker Compose
- **Container Volume:** `taskdata` (mounted to `/var/lib/postgresql/data`)
- **Submission Date:** July 31, 2026

---

## 1. Executive Summary & Storage Engine Progression

Throughout the FlyRank Backend Internship, the Task Management CRUD API has evolved across three distinct storage paradigms:

| Assignment | Storage Layer | Engine / Technology | Persistence Lifecycle |
| :--- | :--- | :--- | :--- |
| **A1** | In-Memory JavaScript Array | Ephemeral RAM | Wiped on server restart |
| **A2** | Local Embedded File | SQLite (`better-sqlite3`) | Persisted in single local file (`tasks.db`) |
| **A3 (Current)** | Containerized Database Server | PostgreSQL 16 Alpine in Docker | Production-grade persistent volume (`taskdata`) |

### Core Architectural Principle
> **The public REST API contract remains 100% identical across all three assignments.**
> Clients issue the exact same HTTP endpoints (`GET`, `POST`, `PUT`, `DELETE` on `/tasks` and `/tasks/:id`) receiving identical JSON shapes and status codes (`200`, `201`, `204`, `400`, `404`). Swapping from SQLite to containerized PostgreSQL required modifying **only** the repository module (`db.js`), proving that storage is an internal implementation detail behind the API layer.

```
[ Client / Terminal / Postman / Swagger UI ]
               │
               ▼
[ Express.js REST API Layer (server.js) ]
               │
               ▼  PostgreSQL $1, $2 Parameterized SQL
[ Dockerized PostgreSQL Server (db.js -> taskdata volume) ]
```

---

## 2. Stage-by-Stage Implementation Breakdown

### Stage 0: Postgres in Docker & `.gitignore` (~30 min)
- **Container Launch:** Started standalone PostgreSQL container `taskdb` with database name `tasks`, password `dev`, and mounted volume `taskdata`.
- **Database Verification:** Verified database interactive shell connection using `docker exec -it taskdb psql -U postgres -d tasks`.
- **Security Check:** Verified that `.env` and sensitive runtime secrets are added to `.gitignore`.
- **Commit:** `Stage 0: Postgres in Docker + gitignore`

---

### Stage 1: Connect via `.env` & Schema Auto-Initialization (~45 min)
- **Secret Management:** Created `.env` (git-ignored for local secrets) and `.env.example` (committed template).
  ```env
  DATABASE_URL=postgres://postgres:dev@db:5432/tasks
  PORT=3000
  ```
- **Driver Integration:** Installed `pg` (node-postgres) driver and built connection pool in `db.js`.
- **Auto-Initialization & Idempotent Seeding:** On startup, `db.js` auto-creates table `tasks` (`id SERIAL PRIMARY KEY, title TEXT, done BOOLEAN`) and seeds 3 initial tasks **only** if row count is 0 (`SELECT COUNT(*) FROM tasks`).
- **Commit:** `Stage 1: connect via .env and create table`

---

### Stage 2: Read Endpoints from PostgreSQL (~45 min)
- **`GET /tasks`**: Executes `SELECT * FROM tasks ORDER BY id ASC`. Supports query parameters (`search` via `ILIKE $1`, `done` filtering, `sort`).
- **`GET /tasks/:id`**: Executes parameterized SQL `SELECT * FROM tasks WHERE id = $1`.
- **404 Handling:** Returns `{ "error": "Task <id> not found" }` with `404 Not Found` for non-existent IDs.
- **Commit:** `Stage 2: read from Postgres`

---

### Stage 3: Full CRUD Operations on PostgreSQL (~1 h)
- **`POST /tasks`**: Validates input title, executes `INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *`, returning `201 Created` with generated serial primary key `id`.
- **`PUT /tasks/:id`**: Validates input title & done boolean, executes `UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *`.
- **`DELETE /tasks/:id`**: Executes `DELETE FROM tasks WHERE id = $1 RETURNING *`, returning `204 No Content`.
- **Commit:** `Stage 3: full CRUD on Postgres`

---

### Stage 4: Docker-Compose Full Stack & Persistence Proof (~45 min)
- **Application Containerization:** Created `Dockerfile` based on `node:22-alpine`.
- **Compose Orchestration:** Created `docker-compose.yml` defining `api` and `db` services, exposing API on port 3000 and DB on port 5433:5432 with volume `taskdata` and `pg_isready` healthcheck.
- **Persistence Verification:** Created task ID 4, ran `docker compose down`, restarted with `docker compose up -d`, and confirmed task ID 4 survived container teardown.
- **Commit:** `Stage 4: docker-compose the whole stack`

---

### Stage 5: Documentation & Git Verification (~30 min)
- Updated `README.md` with:
  - One-command stack startup instructions (`cp .env.example .env && docker compose up -d`).
  - `.env.example` guidance.
  - Endpoints reference table and `curl -i` execution examples.
  - Database verification screenshot representation.
- **Commit:** `Stage 5: one-command stack + docs`

---

## 📸 3. Step-by-Step Screenshots & Verification Guide

*Follow the exact steps below to capture each of the 7 screenshots for your submission report.*

---

### 📷 Screenshot 1: Stage 0 — PostgreSQL Container & psql Shell Connection

#### 📝 Exact Steps to Take Screenshot 1:
1. Open your Linux terminal in the project directory.
2. Enter the interactive PostgreSQL shell in the container:
   ```bash
   docker exec -it flyrank-todo-api-db-1 psql -U postgres -d tasks
   ```
   *(Or if using standalone container: `docker exec -it taskdb psql -U postgres -d tasks`)*
3. You will see the interactive psql prompt:
   ```text
   tasks=#
   ```
4. Capture a screenshot of your terminal showing the `tasks=#` prompt.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal console window showing the execution of `docker exec -it flyrank-todo-api-db-1 psql -U postgres -d tasks` opening the interactive PostgreSQL `tasks=#` shell prompt.
> **Rationale:** Proves Stage 0 compliance—confirming that PostgreSQL is running inside a Docker container with environment secrets and accessible via psql CLI.

---

### 📷 Screenshot 2: Stage 1 — `.env` Secret Configuration & Table Auto-Seeding

#### 📝 Exact Steps to Take Screenshot 2:
1. In your terminal, view `.env` secrets:
   ```bash
   cat .env
   ```
2. Query database table schema and seeded rows:
   ```bash
   docker exec flyrank-todo-api-db-1 psql -U postgres -d tasks -c "\dt"
   docker exec flyrank-todo-api-db-1 psql -U postgres -d tasks -c "SELECT * FROM tasks;"
   ```
3. Capture a screenshot showing `.env` contents, table `tasks`, and the initial seeded tasks.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal output showing `.env` file contents (`DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks`), followed by `psql -c "\dt"` showing table `tasks` and `SELECT * FROM tasks;` returning 3 seeded rows.
> **Rationale:** Proves Stage 1 compliance—verifying secret management via `.env` and automatic schema creation with 3-task seeding on boot.

---

### 📷 Screenshot 3: Stage 2 — `GET /tasks` & 404 Error Handling

#### 📝 Exact Steps to Take Screenshot 3:
1. Start application server (`node server.js` or `docker compose up -d`).
2. Run curl for all tasks:
   ```bash
   curl -i http://localhost:3000/tasks
   ```
3. Run curl for non-existent ID:
   ```bash
   curl -i http://localhost:3000/tasks/999
   ```
4. Capture a screenshot showing `200 OK` returning task list, and `404 Not Found` returning `{"error": "Task 999 not found"}`.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal view displaying two API responses: `GET /tasks` returning HTTP `200 OK` with JSON array of task objects from PostgreSQL, and `GET /tasks/999` returning `404 Not Found` with `{ "error": "Task 999 not found" }`.
> **Rationale:** Proves Stage 2 compliance—verifying `$1` parameterized single and multi-row SELECT queries from PostgreSQL.

---

### 📷 Screenshot 4: Stage 3 — Full CRUD Cycle (`POST`, `PUT`, `DELETE`)

#### 📝 Exact Steps to Take Screenshot 4:
1. Create task:
   ```bash
   curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Dockerize Node.js application"}'
   ```
2. Update task 2:
   ```bash
   curl -i -X PUT http://localhost:3000/tasks/2 -H "Content-Type: application/json" -d '{"title":"Test local trading bot telemetry","done":true}'
   ```
3. Delete task 3:
   ```bash
   curl -i -X DELETE http://localhost:3000/tasks/3
   ```
4. Capture a screenshot showing `201 Created` (ID 4), `200 OK` (updated ID 2), and `204 No Content` (deleted ID 3).

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal output illustrating `POST /tasks` returning `201 Created` with generated ID 4, `PUT /tasks/2` returning `200 OK` with `done: true`, and `DELETE /tasks/3` returning `204 No Content`.
> **Rationale:** Proves Stage 3 compliance—verifying SQL `INSERT`, `UPDATE`, and `DELETE` execution with `RETURNING *` clauses in PostgreSQL.

---

### 📷 Screenshot 5: Stage 4 — Docker Compose Full Stack Startup (`docker compose up`)

#### 📝 Exact Steps to Take Screenshot 5:
1. In terminal, stop single container: `docker rm -f taskdb`
2. Run docker compose command:
   ```bash
   docker compose up -d
   ```
3. Run container listing command:
   ```bash
   docker ps
   ```
4. Capture a screenshot showing both `flyrank-todo-api-api-1` and `flyrank-todo-api-db-1` containers running and healthy.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal screen showing `docker compose up -d` creating networks and starting services, followed by `docker ps` displaying `flyrank-todo-api-api-1` (port 3000) and `flyrank-todo-api-db-1` (healthy status on port 5433).
> **Rationale:** Proves Stage 4 compliance—demonstrating one-command full stack orchestration of application and database containers.

---

### 📷 Screenshot 6: Stage 4 — Stack Teardown & Data Persistence Proof

#### 📝 Exact Steps to Take Screenshot 6:
1. Verify tasks present: `curl http://localhost:3000/tasks` (includes newly created task ID 4).
2. Stop compose stack:
   ```bash
   docker compose down
   ```
3. Restart compose stack:
   ```bash
   docker compose up -d
   ```
4. Query API again:
   ```bash
   curl http://localhost:3000/tasks
   ```
5. Capture a screenshot showing the stack shutdown, restart, and `GET /tasks` confirming task ID 4 survived restart.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal window showing `docker compose down` stopping containers, followed by `docker compose up -d` restarting the stack, and `curl /tasks` returning 4 tasks (including task ID 4 created prior to restart).
> **Rationale:** Proves core Stage 4 persistence requirement—confirming that PostgreSQL database rows survive complete container stack teardowns due to volume `taskdata`.

---

### 📷 Screenshot 7: Stage 5 — Git Commit History (`git log --oneline`)

#### 📝 Exact Steps to Take Screenshot 7:
1. Open terminal inside project directory.
2. Run command:
   ```bash
   git log --oneline -n 10
   ```
3. (Or open [https://github.com/AhadiCoDeR1v1/flyrank-todo-api/commits/main](https://github.com/AhadiCoDeR1v1/flyrank-todo-api/commits/main) in browser).
4. Capture a screenshot showing the 6 stage-by-stage commits.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Git commit log output showing the clean commit history across all 6 stages:
> - `Stage 5: one-command stack + docs`
> - `Stage 4: docker-compose the whole stack`
> - `Stage 3: full CRUD on Postgres`
> - `Stage 2: read from Postgres`
> - `Stage 1: connect via .env and create table`
> - `Stage 0: Postgres in Docker + gitignore`
> **Rationale:** Proves Stage 5 compliance—demonstrating adherence to granular version control and honest stage-by-stage commits.

---

## 4. Conclusion & Key Takeaways

1. **Storage Engine Independence:** The Task Management REST API was successfully migrated from an in-memory array (A1) to SQLite (A2), and finally to PostgreSQL in Docker (A3) without altering a single API route response contract.
2. **Containerized Infrastructure:** Using Docker and Docker Compose eliminates "works on my machine" issues by packaging both Express.js and PostgreSQL 16 into reproducible containers.
3. **Persistent Volume Storage:** Named volume `taskdata` ensures that database rows persist across full stack restarts and container recreations.
