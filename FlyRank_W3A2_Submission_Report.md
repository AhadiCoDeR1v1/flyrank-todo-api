# FlyRank Backend Internship — Week 3 Assignment A2 Submission Report
**Connecting Your CRUD to the Database (SQLite Integration)**

---

## 📌 Document & Submission Metadata
- **Student / Intern Name:** Ahadi Iqbal
- **Track:** Backend Track — Week 3 (Assignment A2)
- **Project Repository:** [https://github.com/AhadiCoDeR1v1/flyrank-todo-api](https://github.com/AhadiCoDeR1v1/flyrank-todo-api)
- **Technology Stack:** Node.js, Express.js, SQLite (`better-sqlite3`), Swagger UI
- **Database File:** `tasks.db` (root directory)
- **Submission Date:** July 30, 2026

---

## 1. Executive Summary & Architecture Overview

In Assignment 1, the Task Management CRUD API stored state inside an in-memory JavaScript array. While functional, all data disappeared whenever the server process restarted.

In Assignment 2 (**W3 · A2**), the in-memory array storage was replaced with a real persistent **SQLite** database using `better-sqlite3`. Crucially, the public REST API contract remains 100% identical:
- **Clients send the exact same HTTP requests** to `/tasks`, `/tasks/:id`.
- **Response structures and HTTP status codes** (`200`, `201`, `204`, `400`, `404`) match Assignment 1 precisely.
- **Data now persists permanently** on disk inside `tasks.db` across server restarts.

```
[ Client / Postman / Swagger UI ]
               │
               ▼
[ Express.js REST API Layer (server.js) ]
               │
               ▼  SQL Queries (SELECT, INSERT, UPDATE, DELETE)
[ SQLite Database Engine (db.js -> tasks.db) ]
```

---

## 2. Stage-by-Stage Implementation & Requirements Checklist

### Stage 0: Create Database & Schema Auto-Initialization (~30 min)
- **Library Choice:** `better-sqlite3` (synchronous, high-performance SQLite driver for Node.js).
- **Database File:** `tasks.db` created automatically on application boot if missing.
- **Table Schema:**
  ```sql
  CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
  );
  ```
- **Idempotent Auto-Seeding:** Counts rows first (`SELECT COUNT(*) FROM tasks`). If count is 0, seeds 3 initial tasks. Restarting the app multiple times keeps the task count constant without duplication.

---

### Stage 1: Read Endpoints from Database (~45 min)
- **`GET /tasks`**: Executes `SELECT * FROM tasks`. Maps SQLite integer booleans (`0`/`1`) to JavaScript JSON booleans (`false`/`true`).
- **`GET /tasks/:id`**: Executes parameterized SQL `SELECT * FROM tasks WHERE id = ?`.
- **404 Handling:** Returns `{ "error": "Task <id> not found" }` with `404 Not Found` if record doesn't exist.

---

### Stage 2: Create New Tasks in Database (~45 min)
- **`POST /tasks`**: Validates `title` (returns `400 Bad Request` for empty strings).
- Executes parameterized SQL `INSERT INTO tasks (title, done) VALUES (?, 0)`.
- Returns `201 Created` with created task object including auto-generated primary key `id` (`info.lastInsertRowid`).
- **Persistence Verification**: Data survives server shutdown and restart.

---

### Stage 3: Update and Delete using SQL (~45 min)
- **`PUT /tasks/:id`**: Validates request body, verifies ID existence, and executes SQL `UPDATE tasks SET title = ?, done = ? WHERE id = ?`.
- **`DELETE /tasks/:id`**: Verifies ID existence and executes SQL `DELETE FROM tasks WHERE id = ?`. Returns `204 No Content`.

---

### Stage 4: Manual SQL Exploration & Bonus Endpoints (~45 min)
Executed manual queries:
- `SELECT * FROM tasks;`
- `SELECT * FROM tasks WHERE done = 1;`
- `SELECT COUNT(*) FROM tasks;`
- `UPDATE tasks SET done = 1;`
- `DELETE FROM tasks WHERE done = 1;`

**Bonus Features Implemented:**
- `GET /tasks?search=keyword`: Search titles using SQL `LIKE %keyword%`.
- `GET /tasks?done=true`: Filter completed/pending status using SQL `WHERE done = ?`.
- `GET /tasks?sort=title`: Alphabetical sorting using SQL `ORDER BY title ASC`.
- `GET /stats`: Aggregated task statistics using SQL `COUNT(*)` queries.

---

### Stage 5: Documentation & Git Commit Verification (~30 min)
Updated `README.md` with:
- Rationale for choosing SQLite
- Database file location (`tasks.db`) and schema
- Start and installation instructions
- Executed SQL query examples
- Database viewer screenshot representation

---

## 📸 3. Screenshots & Verification Instructions (Screenshots 1 to 9)

*Follow the step-by-step instructions below for each screenshot to capture and embed your images into this report.*

---

### 📷 Screenshot 1: Database Auto-Creation & Initial Seeding (Stage 0)

#### 📝 Step-by-Step Instructions to Take Screenshot 1:
1. Delete `tasks.db` if it exists in your terminal: `rm -f tasks.db`
2. Open a terminal and run: `node server.js`
3. Observe the output:
   `Seeding initial example tasks into database...`
   `Server running at http://localhost:3000`
4. Take a screenshot of the terminal window showing this startup log.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal console window showing application startup output. It explicitly highlights the auto-seeding log `"Seeding initial example tasks into database..."` followed by `"Server running at http://localhost:3000"`.
> **Rationale:** Proves Stage 0 compliance—showing that `tasks.db` is automatically created on first boot and seeded idempotently without requiring manual installation or manual SQL setup scripts.

---

### 📷 Screenshot 2: `GET /tasks` - Retrieve Seeded Tasks (Stage 1)

#### 📝 Step-by-Step Instructions to Take Screenshot 2:
1. Ensure `node server.js` is running.
2. Open a new terminal tab or Postman/Hoppscotch.
3. Execute: `curl -i http://localhost:3000/tasks`
4. Take a screenshot showing the HTTP `200 OK` status and JSON array of 3 seeded tasks.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal or API Client HTTP response displaying status `200 OK` and a formatted JSON array containing the three seeded database records (`id: 1`, `id: 2`, `id: 3`) with titles and boolean `done` states.
> **Rationale:** Proves Stage 1 compliance—confirming `GET /tasks` successfully reads records directly from SQLite via SQL `SELECT * FROM tasks`.

---

### 📷 Screenshot 3: `GET /tasks/:id` & 404 Error Handling (Stage 1)

#### 📝 Step-by-Step Instructions to Take Screenshot 3:
1. In your terminal, run: `curl -i http://localhost:3000/tasks/1`
2. Next, run: `curl -i http://localhost:3000/tasks/999`
3. Take a screenshot showing both responses (200 OK for ID 1, 404 Not Found for ID 999).

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal view displaying two `curl` commands. The first fetches ID 1 (`200 OK` returning task details), and the second requests missing ID 999 (`404 Not Found` returning `{"error": "Task 999 not found"}`).
> **Rationale:** Demonstrates parameterized single-row queries (`SELECT * FROM tasks WHERE id = ?`) and proper HTTP 404 error handling for non-existent primary keys.

---

### 📷 Screenshot 4: `POST /tasks` - Insert Task & Input Validation (Stage 2)

#### 📝 Step-by-Step Instructions to Take Screenshot 4:
1. In terminal, run:
   `curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title": "Build automated SQLite test suite"}'`
2. Run validation check with empty title:
   `curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title": ""}'`
3. Take a screenshot showing the `201 Created` response with `id: 4`, followed by `400 Bad Request`.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** API test execution showing a valid `POST /tasks` request returning `201 Created` with newly generated database `id: 4`, alongside an invalid empty title request returning `400 Bad Request` `{"error": "Title is required and cannot be empty"}`.
> **Rationale:** Proves Stage 2 compliance—verifying SQL `INSERT` execution, auto-incrementing primary key assignment, and backend input validation.

---

### 📷 Screenshot 5: Server Restart Data Persistence Proof (Stage 2 Checkpoint)

#### 📝 Step-by-Step Instructions to Take Screenshot 5:
1. Stop the running server (`Ctrl+C`).
2. Restart the server: `node server.js`
3. Execute: `curl http://localhost:3000/tasks`
4. Take a screenshot showing that task ID 4 (`Build automated SQLite test suite`) is still present after server restart.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal screen depicting the server process restart, followed immediately by `GET /tasks` returning 4 tasks (including the newly added task ID 4).
> **Rationale:** Provides concrete evidence of disk persistence via SQLite (`tasks.db`), fulfilling the core assignment requirement that data survives application restarts.

---

### 📷 Screenshot 6: `PUT /tasks/:id` & `DELETE /tasks/:id` Operations (Stage 3)

#### 📝 Step-by-Step Instructions to Take Screenshot 6:
1. Run PUT request to update task 2:
   `curl -i -X PUT http://localhost:3000/tasks/2 -H "Content-Type: application/json" -d '{"title":"Test local trading bot telemetry","done":true}'`
2. Run DELETE request to remove task 3:
   `curl -i -X DELETE http://localhost:3000/tasks/3`
3. Verify remaining tasks: `curl http://localhost:3000/tasks`
4. Take a screenshot showing `200 OK` for PUT, `204 No Content` for DELETE, and the final state.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal output illustrating `PUT /tasks/2` modifying completion status to `done: true`, `DELETE /tasks/3` returning `204 No Content`, and a final `GET /tasks` confirming task 3 is removed.
> **Rationale:** Proves Stage 3 compliance—verifying SQL `UPDATE` and `DELETE` queries operate correctly on database rows.

---

### 📷 Screenshot 7: DB Browser for SQLite - Table Structure & Queries (Stage 4)

#### 📝 Step-by-Step Instructions to Take Screenshot 7:
1. Launch DB Browser for SQLite (run `sqlitebrowser tasks.db` in terminal).
2. Click "Browse Data" tab to view `tasks` table data.
3. Click "Execute SQL" tab, enter: `SELECT * FROM tasks WHERE done = 1;` and click Play button.
4. Take a screenshot of the DB Browser GUI showing table rows and query result.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** DB Browser for SQLite GUI interface displaying view of `tasks.db`. The table browser shows columns `id (INTEGER)`, `title (TEXT)`, `done (INTEGER)`, and the SQL editor tab shows execution of `SELECT * FROM tasks WHERE done = 1;` returning matching rows.
> **Rationale:** Demonstrates Stage 4 manual database exploration, schema inspection, and raw SQL query execution.

---

### 📷 Screenshot 8: Optional Bonus Endpoints (Search, Filter, & Stats)

#### 📝 Step-by-Step Instructions to Take Screenshot 8:
1. In terminal, run: `curl "http://localhost:3000/tasks?search=telemetry"`
2. Run: `curl "http://localhost:3000/tasks?done=true"`
3. Run: `curl "http://localhost:3000/stats"`
4. Take a screenshot showing search result, filtered result, and total/completed/pending stats JSON.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal execution of bonus API routes displaying keyword search result (`LIKE '%telemetry%'`), status filter (`WHERE done = 1`), and aggregate statistics (`GET /stats`) returning `{"total": 3, "completed": 1, "pending": 2}`.
> **Rationale:** Proves completion of stretch goals—showing advanced SQL query capabilities integrated into Express routes.

---

### 📷 Screenshot 9: GitHub Repository Commit History (Stage 5)

#### 📝 Step-by-Step Instructions to Take Screenshot 9:
1. Open terminal and run: `git log --oneline -n 10`
   (Or open [https://github.com/AhadiCoDeR1v1/flyrank-todo-api/commits/main](https://github.com/AhadiCoDeR1v1/flyrank-todo-api/commits/main) in your browser).
2. Take a screenshot showing the incremental commit history for all 6 stages.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Git commit log / GitHub commits page listing the 6 stage-by-stage commits:
> - `Stage 0: create SQLite database`
> - `Stage 1: database read endpoints`
> - `Stage 2: insert into database`
> - `Stage 3: update and delete with SQL`
> - `Stage 4: explored SQLite`
> - `Stage 5: database documentation`
> **Rationale:** Confirms adherence to version control submission requirements with clean, granular commit messages.

---

## 4. Conclusion & Key Takeaways

Through this assignment, the Todo CRUD API was successfully transitioned from ephemeral in-memory state storage to persistent SQLite database storage. 

**Key Takeaways:**
1. **Separation of Concerns:** The REST API endpoints remain completely unchanged to external clients, proving that persistence is an internal implementation detail behind the API layer.
2. **Database Auto-Initialization:** Using code-driven table creation (`CREATE TABLE IF NOT EXISTS`) and row checking ensures seamless zero-configuration setup for any developer cloning the project.
3. **Data Integrity & Security:** Utilizing parameterized SQL queries (`?` placeholders) prevents SQL injection vulnerabilities and ensures safe data operations.
