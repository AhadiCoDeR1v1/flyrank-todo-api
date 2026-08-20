# Stage 6: The AI Rematch — Specification Prompts

## Initial Prompt (Attempt 1)

```markdown
Please build a Node.js Express API that handles long-running report generation using Inngest for background jobs.

Requirements:
1. Fast acceptance endpoint: POST /reports takes JSON with a `topic` string (e.g. {"topic": "cats"}). If topic is missing or empty, return 400 Bad Request immediately. Otherwise, generate a unique report ID, save it as pending in memory, send an Inngest event 'report/requested', and immediately respond with HTTP 202 Accepted and { id, status: "pending" }.
2. Status endpoint: GET /reports/:id returns the report object. If unknown ID, return 404.
3. Inngest background job 'make-report': Triggered by 'report/requested'. Uses two steps: first sleeps 8 seconds ('do-the-slow-work'), then runs a build step ('build-report') that generates the report text and marks the report as 'done' in memory.
4. Retry handling: If the topic is 'fail', throw an error in the build step. Configure the function to retry 2 times.
5. Cron heartbeat: An Inngest function that runs every minute (* * * * *) and logs a summary of pending, done, and failed reports.
6. Serve Inngest at /api/inngest and run Express on port 3000.
```

---

## Improved Rematch Prompt (Attempt 2)

```markdown
Build a production-grade Node.js and Express REST API with Inngest (v4 SDK) background job processing and robust error handling.

Explicit Contract Specifications:
1. HTTP Endpoints:
   - GET /health -> 200 OK {"status": "ok"}
   - POST /reports -> JSON body {"topic": string (1-500 chars)}. Validate strictly: missing, whitespace-only, or non-string topic must return 400 Bad Request with { error: "Validation failed", field: "topic" }. On valid input, generate unique ID (rep_<timestamp>_<rand>), record state in a thread-safe in-memory store ({id, topic, status: "pending", createdAt}), fire-and-forget dispatch event 'report/requested' with data {id, topic}, and IMMEDIATELY respond with HTTP 202 Accepted {id, status: "pending"} in <50ms.
   - GET /reports/:id -> Returns 404 {error: "Report not found"} if missing; returns {id, topic, status: "pending"|"done"|"failed", result?: object, error?: string} if found.
   - GET /reports -> Returns {stats: {pending, done, failed, total}, reports: [...]}.

2. Inngest Function 'make-report':
   - Config: id "make-report", retries: 2, concurrency limit: 2.
   - Triggers: [{ event: "report/requested" }].
   - Idempotency guard: If report is already marked "done", exit early without reprocessing.
   - Step 1: step.sleep("do-the-slow-work", "8s").
   - Step 2: step.run("build-report", async () => { ... }):
     * If topic === "fail", throw new Error("The report oven is broken!") to trigger Inngest exponential backoff retries.
     * Otherwise generate report metrics ({summary, sentimentScore, confidenceScore, generatedAt}), save formatted text to outbox/<id>.txt, and update store to status "done".
   - onFailure handler: When all retries exhaust, update store status to "failed" with error message.

3. Inngest Function 'heartbeat':
   - Config: id "heartbeat", triggers: [{ cron: "* * * * *" }].
   - Step: step.run("log-summary", async () => { ... }) to log summary line "[Heartbeat Cron] X pending, Y done, Z failed (Total: N)".

4. Inngest Serve Handler:
   - Mounted at app.use('/api/inngest', serve({ client: inngest, functions: [...] })).
   - Inngest client configured with id "report-api", isDev: true.
```
