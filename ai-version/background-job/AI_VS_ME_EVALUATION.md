# Stage 6: The AI Rematch — Evaluation & Comparative Analysis

## 1. Specification Prompt Used
We prompted an AI assistant from memory with the core requirements:
- Fast acceptance door: `POST /reports` returning `202 Accepted` with `{ id, status: "pending" }` in milliseconds.
- Input validation: reject missing or non-string topics with `400 Bad Request`.
- Status polling endpoint: `GET /reports/:id` (404 for unknown, returns pending/done object).
- Inngest background job `make-report` with 8s sleep and build step.
- Fault injection: topic `"fail"` throws error with 2 retries.
- Heartbeat cron: `* * * * *` logging counts.

---

## 2. Checkpoint Comparison Matrix

| Checkpoint | Hand-Built Implementation (`src/`) | AI-Generated Implementation (`ai-version/`) | Status & Findings |
| :--- | :--- | :--- | :--- |
| **Stage 0: Health Diagnostic** | Dedicated resilient `/health` with DB status reporting | Omitted entirely | ⚠️ AI missed health endpoint |
| **Stage 1: Inngest Discovery** | Configured `isDev: true`, environment flags, modular client | Plain `Inngest({ id })` without dev flags (throws signature warning) | ⚠️ AI needed local dev config |
| **Stage 2: 202 Fast Door** | Non-blocking event dispatch, sub-100ms response | `await inngest.send()` blocks request latency on dev server connection | ⚠️ Hand-built is strictly non-blocking |
| **Stage 3: Bad Input Validation** | Detailed error schema `{ error, field, message }`, length checks | Basic `{ error: "topic is required" }` | ✅ Both pass 400 rejection |
| **Stage 3: Fault Injection & Retry** | Configured `retries: 2` and `onFailure` hook to transition store to `failed` | Throws error correctly, but omits `onFailure` hook (leaves state as `pending` forever) | ⚠️ AI failed to transition final state |
| **Stage 4: Cron Heartbeat** | Modular store queries with formatted structured logging | Inlined `Object.values(reports)` array filtering | ✅ Both pass cron execution |
| **Stretch: Idempotency** | Prevents duplicate run execution if event is re-delivered | No idempotency guard; re-executes 8s sleep | 🌟 Hand-built is idempotent |
| **Stretch: Concurrency Limit** | Enforces `{ limit: 2 }` concurrency | Omitted | 🌟 Hand-built controls concurrency |
| **Stretch: Outbox File** | Writes structured report file to `outbox/<id>.txt` | Omitted | 🌟 Hand-built saves outbox artifacts |

---

## 3. The Three Critical Architectural Questions

### Q1: What did the AI do better — and do you understand it?
**Answer:** The AI produced a very concise single-file script in ~70 lines of code. It directly used object property lookup (`reports[id]`) and array filters (`Object.values(reports).filter(...)`), which makes the initial code glanceable and easy to follow for a simple prototype.

### Q2: What did it get wrong or silently ignore?
**Answer:**
1. **Blocking `await inngest.send()`:** The AI used `await inngest.send(...)` inside the HTTP handler. If the event dispatcher or local Inngest engine experiences latency or is unreachable, the HTTP client blocks rather than receiving an instantaneous 202 Accepted.
2. **Missing `onFailure` State Transition:** When topic was `"fail"`, the AI code threw the error correctly, but never registered an `onFailure` handler. Consequently, in-memory state remained `"pending"` forever in the status polling endpoint instead of flipping to `"failed"`.
3. **No Idempotency / Concurrency Guards:** It omitted idempotency checks, meaning duplicate network events would re-trigger the 8-second sleep and double-generate reports.

### Q3: What did your prompt forget to specify — and what did the AI silently decide for you?
**Answer:**
1. **Local Dev Server Flags:** The prompt did not specify `isDev: true` or environment variables for Inngest v4, so the AI assumed default cloud mode which requires signing keys.
2. **Failure State Handling:** The prompt mentioned retries on failure, but did not specify *how* the status endpoint should reflect permanently failed jobs after retries exhaust. The AI silently left the record unmodified.
3. **Data Storage Layer:** The prompt asked to save state "in memory", and the AI chose a raw JavaScript object dictionary `{}` without synchronization, timestamps, or helper encapsulation.

---

## 4. Rematch Improvement
In the Rematch Prompt (Attempt 2), we explicitly specified the non-blocking dispatch pattern, the `onFailure` hook contract, Inngest v4 options, concurrency limits, and idempotency guards. The regenerated output closed all architectural gaps.
