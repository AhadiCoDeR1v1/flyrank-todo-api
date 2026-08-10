# FlyRank Todo API — Containerized Stack & Supabase Auth (Assignment A4)

A high-performance RESTful Task Management & Authentication API built with **Node.js**, **Express.js**, **PostgreSQL** (in Docker), and **Supabase Auth** for identity management, user registration, JWT verification, and protected routes.

---

## 🚀 Architectural Evolution Across Assignments

| Assignment | Storage Layer | Authentication | Persistence & Infrastructure |
| :--- | :--- | :--- | :--- |
| **A1** | In-Memory Array | Open (No Auth) | Ephemeral RAM |
| **A2** | Local SQLite File | Open (No Auth) | Local disk file (`tasks.db`) |
| **A3** | Containerized PostgreSQL | Open (No Auth) | Docker Compose (`taskdata` volume) |
| **A4 (Current)** | Containerized PostgreSQL | Supabase Auth & Bearer JWT | Docker Compose + Supabase IdP |

---

## ⚡ Quick Start: One-Command Startup

Start the full stack with one single command:

```bash
# 1. Clone repository & enter directory
git clone https://github.com/AhadiCoDeR1v1/flyrank-todo-api.git
cd flyrank-todo-api

# 2. Copy environment secrets template
cp .env.example .env

# 3. Fill in your Supabase credentials in .env
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_KEY=your_anon_key

# 4. Start containerized PostgreSQL & Express server
docker compose up -d
```

Access the application immediately at:
- **API Base URL:** `http://localhost:3000`
- **Interactive Swagger Docs (with Bearer Auth):** `http://localhost:3000/docs`
- **Health Diagnostic Check:** `http://localhost:3000/health`

---

## 🔑 Environment Secrets & Security (`.env`)

Secrets are safely managed via environment variables and are **never** committed to version control (`.env` is listed in `.gitignore`).

- `.env.example` *(Committed template)*:
  ```env
  DATABASE_URL=postgres://postgres:dev@db:5432/tasks
  PORT=3000
  SUPABASE_URL=your_supabase_project_url
  SUPABASE_KEY=your_supabase_anon_key
  ```
- `.env` *(Local git-ignored secrets)*:
  ```env
  DATABASE_URL=postgres://postgres:dev@localhost:5433/tasks
  PORT=3000
  SUPABASE_URL=https://rdkttsjwdlsfawmjazno.supabase.co
  SUPABASE_KEY=eyJhbGciOiJIUzI1...
  ```

---

## 📑 Complete API Reference Table

| Method | Endpoint | Description | Auth Required | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | API Metadata & Overview | No | `200` |
| `GET` | `/health` | Application & Database Healthcheck | No | `200`, `500` |
| `POST` | `/auth/signup` | Register new account with Supabase | No | `201`, `400` |
| `POST` | `/auth/login` | Authenticate & return Bearer JWT | No | `200`, `400`, `401` |
| `POST` | `/auth/logout` | End user session | **Yes** (`Bearer JWT`) | `204`, `401` |
| `GET` | `/public/info` | Public open data endpoint | No | `200` |
| `GET` | `/protected/profile` | Read authenticated profile metadata | **Yes** (`Bearer JWT`) | `200`, `401` |
| `GET` | `/protected/dashboard` | Access personal user dashboard | **Yes** (`Bearer JWT`) | `200`, `401` |
| `GET` | `/tasks` | List all tasks (search/filter/sort) | No | `200` |
| `POST` | `/tasks` | Create a new task item | No | `201`, `400` |
| `PUT` | `/tasks/:id` | Update an existing task item | No | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Erase a task item by ID | No | `204`, `404` |

---

## 🧪 Auth Verification Examples (`curl -i`)

### 1. Register User (`POST /auth/signup`)
```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"developer@flyrank.com","password":"StrongPassword123!"}'
```
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"user":{"id":"39c1aa8f-6488...","email":"developer@flyrank.com"}}
```

### 2. Log In & Receive JWT Access Token (`POST /auth/login`)
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"developer@flyrank.com","password":"StrongPassword123!"}'
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {"id":"39c1aa8f-6488...","email":"developer@flyrank.com"}
}
```

### 3. Call Protected Profile Endpoint (`GET /protected/profile`)
```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <PASTE_ACCESS_TOKEN_HERE>"
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"user":{"id":"39c1aa8f-6488...","email":"developer@flyrank.com"}}
```

### 4. Forged / Missing Token Test (`401 Unauthorized`)
```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer invalid_tampered_token"
```
```http
HTTP/1.1 401 Unauthorized

{"error":"Invalid or expired token"}
```

---

## 🔒 Swagger UI Bearer Authorization (`/docs`)

Swagger UI is configured with `securitySchemes` for OpenAPI 3.0:
1. Open `http://localhost:3000/docs` in your browser.
2. Click the green **Authorize 🔓** button at the top right.
3. Paste your Supabase JWT `access_token` into the Value field and click **Authorize**.
4. Test protected endpoints (`/protected/profile`, `/protected/dashboard`, `/auth/logout`) directly from the browser!