# FlyRank Backend API: Durable Background Jobs & Async Worker Engine

**Backend Engineering Track · Assignment BE-06 / A7 · "Your First Background Job"**

---

## 1. Overview & Architectural Philosophy

When web requests perform slow, heavy tasks (AI inference, PDF report generation, video processing, bulk exports), holding the HTTP connection open causes request timeouts, worker thread starvation, and double-execution from client retries.

This service implements the industry-standard **Asynchronous Request-Response Pattern**:
1. **The Fast Door (`POST /reports`):** Validates input immediately, initializes state, queues the job event, and responds in milliseconds with **HTTP `202 Accepted`**.
2. **The Background Worker (`Inngest`):** Orchestrates durable step-based execution (`step.sleep`, `step.run`), automatic exponential backoff retries on failure, and concurrency limits.
3. **Status Polling (`GET /reports/:id`):** Provides real-time visibility into the job lifecycle (`pending` → `done` or `failed`).
4. **Scheduled Cron Heartbeat (`* * * * *`):** Background cron job running on the clock to monitor and log system throughput without human intervention.

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    BACKGROUND JOB ARCHITECTURE                                   |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                  |
|   1. FAST ACCEPTANCE (Immediate 202)                                                             |
|   [ Client ] ──POST /reports {topic}──► [ Express API ]                                          |
|                                                │                                                 |
|                                                ├── 1. Validate Input (Empty? -> 400 Bad Request) |
|                                                ├── 2. Save in-memory: {id, topic, status:pending}|
|                                                ├── 3. Non-blocking Inngest Event: report/requested|
|                                                └── 4. Respond IMMEDIATELY: 202 Accepted {id}     |
|                                                                                                  |
|   2. DURABLE INNGEST WORKER                                                                      |
|   [ Inngest Engine ] ◄── Listens for "report/requested"                                          |
|            │                                                                                     |
|            ├── Step 1: step.sleep("do-the-slow-work", "8s")  [Simulate heavy workload]          |
|            └── Step 2: step.run("build-report", ...)                                             |
|                     ├── Idempotency Guard (skip if already marked done)                          |
|                     ├── Fault Injection (topic === "fail" -> Throw error & Retry 2x)             |
|                     ├── Write report to outbox/<id>.txt (Outbox artifact)                        |
|                     └── Update memory store -> status: "done", result: { ... }                   |
|                                                                                                  |
|   3. STATUS POLLING & CONTROL PANEL                                                              |
|   [ Client ] ──GET /reports/:id ──► Returns {status: "pending" | "done" | "failed"}              |
|   [ Client ] ──GET /reports     ──► Returns aggregate metrics & all reports                      |
|                                                                                                  |
|   4. SCHEDULED CRON HEARTBEAT & PURGE                                                            |
|   [ Inngest Cron: "* * * * *" ]   ──► Runs every minute -> Logs pending/done/failed count        |
|   [ Inngest Cron: "*/10 * * * *" ] ──► Purges completed reports older than 10 mins               |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Quick Start: How to Run in Under 5 Minutes

Running the background job system requires **two terminal commands** (no credit card or paid account required):

### Terminal 1: Start Express API Server
```bash
npm install
npm start
```
*The API starts on `http://localhost:3000`.*

### Terminal 2: Start Local Inngest Dev Server & Visual Dashboard
```bash
npm run inngest:dev
# Alternatively:
# npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
*The Inngest visual dashboard will be live at `http://localhost:8288`.*

---

## 3. Endpoints & Inngest Functions Reference

### API Endpoints

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health diagnostic check | `200 OK` |
| `POST` | `/reports` | Fast door: validates input, registers pending report, sends event | `202 Accepted`, `400 Bad Request` |
| `GET` | `/reports/:id` | Status polling: returns current state (`pending`, `done`, `failed`) | `200 OK`, `404 Not Found` |
| `GET` | `/reports` | Control panel: returns all reports and aggregate statistics | `200 OK` |
| `ALL` | `/api/inngest` | Inngest SDK handler serving background functions | `200 OK` |
| `GET` | `/docs` | Interactive Swagger UI API documentation | `200 OK` |
| `POST` | `/triage` | Hardened AI classification pipeline (from A17) | `200 OK`, `400`, `422` |
| `GET/POST` | `/tasks` | Todo CRUD database operations | `200 OK`, `201 Created` |

### Inngest Functions

| Function ID | Trigger | Key Steps & Behavior |
| :--- | :--- | :--- |
| `say-hello` | `test/hello` event | Sleeps 5s (`step.sleep`), returns greeting message. |
| `make-report` | `report/requested` event | Sleeps 8s (`do-the-slow-work`), generates report, writes to `outbox/<id>.txt`, updates state to `done`. Configured with `retries: 2`, `concurrency: { limit: 2 }`, and idempotency protection. |
| `heartbeat` | Cron `* * * * *` (every min) | Queries store and logs summary: `[Heartbeat Cron] X pending, Y done, Z failed (Total: N)`. |
| `cleanup-old-reports` | Cron `*/10 * * * *` (every 10m) | Automatically purges completed reports older than 10 minutes from memory. |

---

## 4. Copy-Pasteable `curl` Commands & Verifiable Output Proofs

### ✅ Proof 1: Instant 202 Accepted & Status Polling

#### Step 1: Submit Report (Sub-50ms Response)
```bash
time curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d '{"topic": "cats"}'
```

**Output (HTTP 202 Accepted in 12ms):**
```json
HTTP/1.1 202 Accepted
Content-Type: application/json; charset=utf-8

{
  "id": "rep_1787233679498_k8lxt",
  "status": "pending"
}
```

#### Step 2: Immediate Poll (< 2 Seconds After Submission)
```bash
curl -i http://localhost:3000/reports/rep_1787233679498_k8lxt
```

**Output (HTTP 200 OK — Still Working):**
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "id": "rep_1787233679498_k8lxt",
  "topic": "cats",
  "status": "pending",
  "createdAt": "2026-08-20T13:47:59.498Z",
  "updatedAt": "2026-08-20T13:47:59.498Z"
}
```

#### Step 3: Eventual Poll (~10 Seconds Later)
```bash
curl -i http://localhost:3000/reports/rep_1787233679498_k8lxt
```

**Output (HTTP 200 OK — Eventual Consistency Achieved):**
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "id": "rep_1787233679498_k8lxt",
  "topic": "cats",
  "status": "done",
  "createdAt": "2026-08-20T13:47:59.498Z",
  "updatedAt": "2026-08-20T13:48:07.520Z",
  "outboxPath": "/workspace/outbox/rep_1787233679498_k8lxt.txt",
  "result": {
    "title": "Market & Sentiment Intelligence Report: cats",
    "summary": "Comprehensive analytical breakdown for topic 'cats'. Automated data ingestion completed successfully with optimal trend indicators.",
    "metrics": {
      "sentimentScore": 0.88,
      "confidenceScore": 0.96,
      "dataPointsEvaluated": 1250,
      "processingLatencyMs": 8024
    },
    "topic": "cats",
    "generatedAt": "2026-08-20T13:48:07.519Z",
    "version": "1.0.0"
  }
}
```

---

### ❌ Proof 2: Input Validation Guard (Rejection at the Door)
```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Output (HTTP 400 Bad Request — Zero Inngest Events Dispatched):**
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "error": "Validation failed",
  "field": "topic",
  "message": "Field 'topic' is required and must be a non-empty string"
}
```

---

### ⚠️ Proof 3: Fault Injection, Retries & Exponential Backoff (Topic `"fail"`)
```bash
curl -i -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -d '{"topic": "fail"}'
```

**Inngest Dashboard Execution Lifecycle (`http://localhost:8288`):**
1. **Attempt 1:** Runs `do-the-slow-work` (8s) → Executes `build-report` → Throws `"The report oven is broken!"` → Fails.
2. **Backoff Wait:** Inngest delays execution with exponential backoff.
3. **Attempt 2:** Resumes → Fails again.
4. **Attempt 3 (Final Retry):** Resumes → Fails → Run permanently marked **`Failed`**.
5. **`onFailure` Handler:** Updates the report record to `"status": "failed"` with the exact failure error message.

---

## 5. Architectural Questions & Concepts

### Stage 3: Why bad input gets 400 immediately vs transient errors getting retried
> **"A wrong input must be rejected at the door (400); only a wrong moment deserves a retry."**
> 
> When an incoming request contains invalid or missing data (e.g. missing `topic`), no amount of waiting or retrying will ever make it valid—retrying it wastes compute and pollutes queues. Conversely, when a background job encounters an intermittent operational fault (such as a database connection timeout, an upstream AI provider rate limit, or a temporary network hiccup), the request itself is perfectly valid and is highly likely to succeed after a brief backoff period.

---

### Stage 4: Cron Schedules
- **Every day at 08:00 UTC:** `0 8 * * *`
- **Every Sunday at 22:00 UTC:** `0 22 * * 0` (or `0 22 * * 7`)

---

### Stretch Goal Questions

#### Idempotency: Why must jobs survive running twice?
> In distributed systems, networks drop packets and workers crash mid-execution, meaning queues guarantee **at-least-once delivery**, not exactly-once delivery. An idempotent job inspects its persistent state before executing expensive mutations—if the report is already marked `done`, it immediately returns the existing result without re-executing steps or charging duplicate API costs.

#### Concurrency Limiter: When would you want a queue to be slow?
> You want a queue to be slow when protecting fragile downstream dependencies—such as strict third-party AI rate limits (e.g., 5 requests per second), database connection pools, or CPU-intensive image renderers—preventing a traffic spike from overwhelming your infrastructure with cascading outages.

#### Durability & The Restart Experiment:
> During an 8-second sleep step, if the Express server process is forcefully stopped (`Ctrl-C`) and restarted, **the background job does not disappear or restart from scratch**. Because Inngest persists step state durably in its event log, when the server boots back up, Inngest resumes execution exactly from the unfinished step without repeating previously completed work.

---

## 6. Stage 6: The AI Rematch ("AI vs Me")

In Stage 6, we prompted an AI assistant from memory to build the same background job architecture in a quarantined folder ([`ai-version/`](file:///home/ahadiqbal/Career/FlyRank/Assingments/flyrank-todo-api/ai-version/)).

### Side-by-Side Comparison

| Feature | Hand-Built (`src/`) | AI Version (`ai-version/`) | Evaluation Findings |
| :--- | :--- | :--- | :--- |
| **HTTP Dispatch** | Non-blocking dispatch (<50ms 202 response) | `await inngest.send()` (blocks client if dev server is slow) | Hand-built provides genuine async isolation |
| **Failure State** | `onFailure` hook flips status to `"failed"` | Throws error, but leaves status stuck in `"pending"` forever | AI failed to update polling state |
| **Idempotency** | Prevents duplicate step execution on re-delivery | None (re-runs 8s sleep) | Hand-built prevents duplicate compute |
| **Concurrency** | Enforces `{ limit: 2 }` | Omitted | Hand-built protects worker capacity |
| **Outbox Artifacts** | Writes formatted `.txt` files to `outbox/` | Omitted | Hand-built satisfies all stretch goals |

### Summary of Lessons Learned
1. **What the AI did better:** Generated an ultra-concise ~70 line script using raw dictionary keys and array filters.
2. **What the AI missed:** Forgot `onFailure` lifecycle handlers, blocking `await inngest.send()`, and idempotency guards.
3. **What was omitted in the prompt:** We did not explicitly tell the AI *how* to handle the final failed state in memory, so it silently decided to leave it untouched.

---

## 7. Running the Automated Evaluation Test Suites

Run both built-in test suites to verify all background jobs, endpoints, and Inngest step engines:

```bash
# 1. Test HTTP routes, 202 acceptance, validation guards, and stats
node evals/test-background-jobs.js

# 2. Test Inngest function steps, sleep, build, outbox generation, and cron
node evals/test-inngest-execution.js
```
