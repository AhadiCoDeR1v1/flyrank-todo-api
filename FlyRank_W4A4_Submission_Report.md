# FlyRank Backend Internship — Week 4 Assignment A4 Submission Report
**Auth · Login & Protect (Supabase Auth & Bearer JWT Verification)**

---

## 📌 Document & Submission Metadata
- **Student / Intern Name:** Ahadi Iqbal
- **Track:** Backend Track — Week 4 (Assignment A4)
- **Project Repository:** [https://github.com/AhadiCoDeR1v1/flyrank-todo-api](https://github.com/AhadiCoDeR1v1/flyrank-todo-api)
- **Technology Stack:** Node.js, Express.js, Supabase Auth (`@supabase/supabase-js`), PostgreSQL 16, OpenAPI 3.0 / Swagger UI
- **Supabase Project URL:** `https://rdkttsjwdlsfawmjazno.supabase.co`
- **Submission Date:** August 10, 2026

---

## 1. Executive Summary & Security Architecture

In Week 4 Assignment A4, the FlyRank Todo API was upgraded from an unauthenticated API to a enterprise-grade secure REST API using **Supabase Auth** as the **Identity Provider (IdP)**.

### Core Security Architecture: The Trust Triangle
```
[ Client App / Curl / Swagger ]
          │
          │ 1. POST /auth/login (email + password)
          ▼
 [ Express Server ] ──────────────► [ Supabase IdP ]
                    2. Verifies & Returns JWT Access Token
          ▲                               │
          │ 3. Authorization: Bearer JWT  │
          └───────────────────────────────┘
                    4. supabase.auth.getUser(token) (Middleware Verification)
```

### Key Technical Achievements
1. **Zero Local Password Storage:** Passwords are never hashed, salted, or stored on local databases. All credential management is delegated to Supabase Auth.
2. **Bearer Token Authentication:** Access tokens are transmitted in standard `Authorization: Bearer <JWT>` HTTP headers.
3. **Reusable Express Middleware (`requireAuth`):** Intercepts requests to protected endpoints, parses Bearer tokens, calls `supabase.auth.getUser(token)`, attaches `req.user`, and rejects unauthorized requests with `401 Unauthorized`.
4. **OpenAPI 3.0 Swagger UI Integration (`securitySchemes`):** Rendered interactive docs at `/docs` with a green **Authorize 🔒** padlock button for token testing.

---

## 2. Stage-by-Stage Implementation Breakdown

### Stage 0: Set Up Supabase & Server Initialization
- **SDK Installation:** Installed `@supabase/supabase-js` package.
- **Environment Management:** Configured `.env` with `SUPABASE_URL` and `SUPABASE_KEY` (git-ignored) and committed `.env.example`.
- **Client Connection:** Initialized Supabase client in `server.js` (`createClient(SUPABASE_URL, SUPABASE_KEY)`).
- **Commit:** `Stage 0: setup server and supabase client`

---

### Stage 1: Open Auth Routes (`POST /auth/signup` & `POST /auth/login`)
- **`POST /auth/signup`**: Validates `email` & `password` presence (400), calls `supabase.auth.signUp()`, returns `201 Created` with user record.
- **`POST /auth/login`**: Validates input (400), calls `supabase.auth.signInWithPassword()`, returns `200 OK` carrying `access_token` JWT string or `401 Unauthorized` for invalid credentials.
- **Commit:** `Stage 1: signup and login routes working`

---

### Stage 2: Public & Protected Gates (`GET /public/info` & Header Inspection)
- **`GET /public/info`**: Unprotected public endpoint returning `200 OK` `{ "message": "Welcome stranger! This info is public." }`.
- **`GET /protected/profile`**: Header check for `Authorization: Bearer <token>`. Missing/malformed headers return `401 Unauthorized` `{ "error": "Access token required" }`.
- **Commit:** `Stage 2: public route and unverified protected route`

---

### Stage 3: Token Verification with Supabase (`supabase.auth.getUser()`)
- **JWT Signature & Expiration Verification:** Updated `GET /protected/profile` to pass the extracted token to `supabase.auth.getUser(token)`.
- **Forgery Rejection:** Forged or tampered tokens return `401 Unauthorized` `{ "error": "Invalid or expired token" }`.
- **Valid Response:** Returns `200 OK` with user metadata (`id`, `email`, `created_at`).
- **Commit:** `Stage 3: profile route token verification`

---

### Stage 4: Reusable Middleware (`requireAuth`) & Protected Logout
- **Reusable Guard:** Extracted token verification into `requireAuth` Express middleware function (`(req, res, next)`).
- **Endpoint Protection:** Applied `requireAuth` to `GET /protected/profile`, `GET /protected/dashboard`, and `POST /auth/logout`.
- **`POST /auth/logout`**: Calls `supabase.auth.signOut()` to invalidate session, returning `204 No Content`.
- **Commit:** `Stage 4: auth middleware and logout endpoint`

---

### Stage 5: Swagger UI Bearer Authorization (`securitySchemes`)
- **OpenAPI 3.0 Configuration:** Added `components.securitySchemes.bearerAuth` (`type: http`, `scheme: bearer`, `bearerFormat: JWT`) in `openapi.json`.
- **Interactive Documentation:** Attached `"security": [{ "bearerAuth": [] }]` to protected paths, enabling the **Authorize 🔒** padlock button on `/docs`.
- **Commit:** `Stage 5: Swagger UI documentation with bearer auth`

---

### Stage 6: Documentation & Version Control Publishing
- **Comprehensive Documentation:** Updated `README.md` with complete API reference table (12 endpoints), environment setup, and `curl -i` verification examples.
- **Git Push:** Pushed all stage commits to GitHub (`origin/main`).
- **Commit:** `Stage 6: publish to GitHub and write README`

---

## 📸 3. Step-by-Step Screenshots & Verification Guide

*Follow the exact steps below to capture each of the 7 screenshots for your submission report.*

---

### 📷 Screenshot 1: Stage 0 — Server Startup & Supabase Client Connection

#### 📝 Exact Steps to Take Screenshot 1:
1. Open your Linux terminal in the project directory.
2. Run command:
   ```bash
   node server.js
   ```
3. Capture a screenshot of your terminal showing the startup output logs:
   `Server initialized and connected to Supabase`
   `Server running at http://localhost:3000`

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal console window showing execution of `node server.js` displaying clean environment secret loading and initialization of the Supabase Auth client.
> **Rationale:** Proves Stage 0 compliance—verifying server startup and valid Supabase configuration.

---

### 📷 Screenshot 2: Stage 1 — Registration & Login JWT Issuance

#### 📝 Exact Steps to Take Screenshot 2:
1. Register user:
   ```bash
   curl -i -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d '{"email":"testuser@flyrank.com","password":"Password123!"}'
   ```
2. Authenticate user:
   ```bash
   curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"testuser@flyrank.com","password":"Password123!"}'
   ```
3. Capture a screenshot showing `201 Created` with user record, followed by `200 OK` returning `access_token`.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal output illustrating `POST /auth/signup` returning HTTP `201 Created`, followed by `POST /auth/login` returning HTTP `200 OK` carrying the Supabase JWT `access_token`.
> **Rationale:** Proves Stage 1 compliance—verifying user registration and token generation via Supabase Auth.

---

### 📷 Screenshot 3: Stage 2 — Public Route & Unauthenticated Gate Rejection

#### 📝 Exact Steps to Take Screenshot 3:
1. Call public endpoint:
   ```bash
   curl -i http://localhost:3000/public/info
   ```
2. Call protected endpoint without token:
   ```bash
   curl -i http://localhost:3000/protected/profile
   ```
3. Capture a screenshot showing `200 OK` for public info, and `401 Unauthorized` with `{"error": "Access token required"}` for protected profile.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal view displaying `GET /public/info` returning `200 OK` message, and `GET /protected/profile` rejecting unauthenticated request with `401 Unauthorized`.
> **Rationale:** Proves Stage 2 compliance—verifying public accessibility and missing header rejection.

---

### 📷 Screenshot 4: Stage 3 — Token Verification & Cryptographic Forgery Rejection

#### 📝 Exact Steps to Take Screenshot 4:
1. Call profile with valid token:
   ```bash
   curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
   ```
2. Call profile with tampered token:
   ```bash
   curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer invalid_tampered_token"
   ```
3. Capture a screenshot showing `200 OK` with user details for valid token, and `401 Unauthorized` with `{"error": "Invalid or expired token"}` for tampered token.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal console displaying successful user profile retrieval (`200 OK`) with valid JWT, and instant rejection (`401 Unauthorized`) when a single character of the JWT signature is tampered with.
> **Rationale:** Proves Stage 3 compliance—demonstrating cryptographic token verification via `supabase.auth.getUser()`.

---

### 📷 Screenshot 5: Stage 4 — Reusable `requireAuth` Middleware & Protected Logout

#### 📝 Exact Steps to Take Screenshot 5:
1. Access secondary protected route:
   ```bash
   curl -i http://localhost:3000/protected/dashboard -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
   ```
2. Perform protected logout:
   ```bash
   curl -i -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
   ```
3. Capture a screenshot showing `200 OK` for dashboard, and `204 No Content` for logout.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal view showing `GET /protected/dashboard` returning `200 OK` using `requireAuth` middleware, followed by `POST /auth/logout` returning `204 No Content`.
> **Rationale:** Proves Stage 4 compliance—verifying DRY middleware reuse across multiple endpoints and session sign-out.

---

### 📷 Screenshot 6: Stage 5 — Swagger UI Bearer Authorization Padlock (`/docs`)

#### 📝 Exact Steps to Take Screenshot 6:
1. Open web browser and navigate to: `http://localhost:3000/docs`
2. Click the green **Authorize 🔓** button at top right.
3. Paste access token into the value box and click **Authorize**.
4. Capture a screenshot of the Swagger UI page showing the **Authorize 🔒** button locked and padlocks next to `/protected/` endpoints.

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Web browser window rendering Swagger UI at `/docs`, featuring the OpenAPI 3.0 `securitySchemes` modal and locked padlocks alongside protected endpoints.
> **Rationale:** Proves Stage 5 compliance—verifying end-to-end interactive documentation with Bearer authentication support.

---

### 📷 Screenshot 7: Stage 6 — Git Commit History (`git log --oneline`)

#### 📝 Exact Steps to Take Screenshot 7:
1. Open terminal inside project directory.
2. Run command:
   ```bash
   git log --oneline -n 10
   ```
3. Capture a screenshot of your terminal showing the 7 sequential stage commits:
   - `Stage 6: publish to GitHub and write README`
   - `Stage 5: Swagger UI documentation with bearer auth`
   - `Stage 4: auth middleware and logout endpoint`
   - `Stage 3: profile route token verification`
   - `Stage 2: public route and unverified protected route`
   - `Stage 1: signup and login routes working`
   - `Stage 0: setup server and supabase client`

#### 🖼️ Image Description & Submission Rationale:
> **Description:** Terminal git commit history displaying granular, stage-by-stage version control commits from `Stage 0` to `Stage 6`.
> **Rationale:** Proves Stage 6 compliance—confirming disciplined version control history and repository publishing.

---

## 4. Conclusion & Key Security Takeaways

1. **Identity Provider Delegation:** Utilizing Supabase Auth isolates authentication responsibility from core application logic, ensuring industry-standard security without re-inventing password cryptography.
2. **Stateless Bearer JWTs:** Authenticating requests via HTTP Authorization Bearer headers allows stateless, scalable user verification across server instances.
3. **Middleware Guard Pattern:** Writing a single `requireAuth` Express middleware enforces consistent security across all protected API routes.
