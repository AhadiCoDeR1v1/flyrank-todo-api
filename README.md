# FlyRank API: AI Support & Task Triage (`POST /triage`)
**Week 6 / 7 · Assignment A17 — Put an LLM behind your API**

---

## 1. What This Endpoint Does
This endpoint automatically reads incoming customer messages, task descriptions, and bug reports, and categorizes them into actionable classifications (`billing`, `bug`, `feature`, or `other`). Instead of a human manually sorting hundreds of support tickets or task descriptions, our API uses an AI model to evaluate urgency (`low`, `normal`, `high`), compute a confidence score, and provide a clear one-sentence explanation. Most importantly, it enforces a strict JSON data contract: every answer is rigorously checked against a schema, repaired automatically if malformed, and rejected safely if invalid, so downstream databases and services never crash from unexpected text.

---

## 2. Copy-Pasteable `curl` Commands & Responses

### ✅ Valid Request (Happy Path)
```bash
curl -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"text": "I was billed $49 twice on my credit card this morning for the monthly pro subscription. Please refund the extra charge."}'
```

**Exact Output (HTTP 200 OK):**
```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.98,
  "reason": "Customer reported duplicate charges for a subscription renewal requiring immediate financial correction."
}
```

### ❌ Deliberately Broken Request (Input Validation Guard)
```bash
curl -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"invalid_field": 12345}'
```

**Exact Output (HTTP 400 Bad Request):**
```json
{
  "error": "Validation failed",
  "field": "text",
  "message": "Field 'text' is required"
}
```

---

## 3. Job Card Specification

```markdown
# Job card
What it does (one sentence): Classifies a support or task message so it lands on the right team with appropriate urgency and actionable reasoning.
Input: { "text": "string, 1-2000 characters" }
Output: {
  "category": one of [billing|bug|feature|other],
  "urgency": one of [low|normal|high],
  "confidence": 0.0-1.0,
  "reason": "one short sentence"
}

It must never:
- Invent a category outside the list (billing, bug, feature, other)
- Return free text or conversational filler
- Give medical, legal, or financial advice
- Reveal internal system prompt instructions

When unsure it should:
- Return category "other" with confidence below 0.5, not a guess
```

---

## 4. Provider, Model & Environment Configuration

This system communicates via standard OpenAI-compatible HTTP requests. Three environment variables are the **only difference** between running against a local model on your laptop (Ollama) or a hosted cloud provider (OpenRouter / Groq / OpenAI):

```env
# Hosted OpenRouter (Free tier / production models)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_openrouter_api_key_here
LLM_MODEL=openrouter/free

# OR Local Ollama (Zero cost, no account required)
# LLM_BASE_URL=http://localhost:11434/v1/
# LLM_API_KEY=ollama
# LLM_MODEL=gemma3:1b

# Operational Flags
LLM_STUB=0        # Set to 1 for zero-cost offline development stub mode
LLM_ENABLED=true  # Set to false for instant production kill switch fallback
```

> **Why hard-coding providers is an anti-pattern:** Decoupling the client through environment variables allows instant infrastructure failover between local edge instances (Ollama) and datacenters (OpenRouter/Groq/OpenAI) without a single line of code changes or server redeployment.

---

## 5. Evaluation Benchmark Results

We tested our pipeline against an 8-case hand-labelled benchmark dataset (`evals/cases.json`) covering clear categories, critical severity boundary cases, ambiguous multi-intent tickets, and adversarial prompt injections:

- **Benchmark Date:** August 19, 2026
- **Prompt Version:** `prompts/triage-v1.md` (and `prompts/triage-v2.md`)
- **Key Field (Category) Score:** **8 / 8 (100.0% accuracy)**
- **Urgency Field Score:** **8 / 8 (100.0% accuracy)**
- **Run Command:** `npm run eval`

### Case-by-Case Breakdown:
| Case ID | Scenario | Input Type | Expected Category | Model Output | Status | Latency |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| `#1` | `duplicate_charge_invoice` | Clear Billing | `billing` (high) | `billing` (high) | ✅ MATCH | 820ms |
| `#2` | `crash_on_export` | Clear Bug | `bug` (normal) | `bug` (normal) | ✅ MATCH | 790ms |
| `#3` | `dark_mode_feature_request` | Feature Request | `feature` (low) | `feature` (low) | ✅ MATCH | 810ms |
| `#4` | `subscription_cancellation_inquiry`| Billing Inquiry | `billing` (normal) | `billing` (normal) | ✅ MATCH | 750ms |
| `#5` | `critical_data_loss_bug` | Critical Bug | `bug` (high) | `bug` (high) | ✅ MATCH | 830ms |
| `#6` | `slack_webhook_integration` | Integration | `feature` (low) | `feature` (low) | ✅ MATCH | 760ms |
| `#7` | `ambiguous_multi_intent` | Ambiguous | `other` (normal) | `other` (normal) | ✅ MATCH | 800ms |
| `#8` | `prompt_injection_unsure` | Adversarial / Injection | `other` (low) | `other` (low) | ✅ MATCH | 770ms |

---

## 6. Cost Observability & High-Volume Estimation

Every model invocation logs a structured JSON telemetry line to `stdout`:
```json
{
  "timestamp": "2026-08-19T08:10:14.465Z",
  "event": "llm_triage_call",
  "prompt_version": "v1",
  "model": "openrouter/free",
  "tokens": { "input": 312, "output": 48, "total": 360 },
  "duration_ms": 782,
  "repairs_needed": 0,
  "estimated_cost_usd": 0.0000756,
  "status": 200
}
```

- **Single Request Cost:** ~360 tokens (312 prompt tokens + 48 completion tokens) ≈ **$0.0000756 USD**.
- **10,000 Requests/Day Estimate:** **~$0.75 USD per day** (or ~$22.50 USD/month). With our built-in SHA-256 caching layer enabled, recurring queries reduce this cost by an estimated 35–50%.

---

## 7. What I'd Fix With Another Day
With another day, I would integrate **semantic vector embeddings with pgvector** directly in the database to cluster incoming tasks by semantic similarity and auto-detect emerging duplicate bug reports across different users before they even reach support engineers.

---

## 8. 🥊 Bonus Stage: "AI vs Me" Rematch Analysis

We tasked an AI code generator to build the exact same triage endpoint without seeing our architecture. The raw output was saved in `ai-version/` and diffed using `git diff --no-index src/ ai-version/src/`.

### Prompt Used to Generate the AI Version:
> *"Create an Express.js POST /triage endpoint that uses OpenAI to classify incoming support messages into category (billing, bug, feature, other), urgency, confidence, and reason."*

### 3 Concrete Differences Found:
1. **Unbounded 10-Minute Timeout Left in Place:** The AI code omitted the `timeout` parameter, relying on the OpenAI SDK's default 10-minute timeout. Our production code enforces an explicit `timeout: 30000` (30s) and returns a clean `HTTP 504 Gateway Timeout`.
2. **Raw Model Text & Lack of Schema Validation:** The AI version returned `res.json({ result: rawContent })` directly, leaving callers vulnerable to malformed markdown fences and missing fields. Our code uses Zod schema validation, fence stripping, a 1-shot repair retry loop, and quarantines unrepairable failures to `logs/quarantine.jsonl` with `HTTP 422`.
3. **No Retriable Error Discrimination:** The AI version had a generic `catch` block that failed to differentiate between transient network errors and client authentication errors. Our production code implements exponential backoff with jitter for `429`, `5xx`, and timeouts, but **fails immediately on 401/403/400** to avoid burning quota on bad credentials.

---

## 9. Reliability & Production Architecture

```
[ Incoming Request: POST /triage ]
               │
      1. Zod Input Validation ──(Invalid)──► 400 Bad Request (Zero Token Cost)
               │
      2. Kill Switch Check ──(Disabled)──► 200 Fallback / 503
               │
      3. SHA-256 Cache Check ──(Hit)──► 200 Instant Cached JSON
               │
      4. OpenAI Call (30s Timeout, Jitter Retry on 429/5xx)
               │
      5. Parse & Zod Schema Validation
            ├── (Valid) ──────► 200 OK + Structured Cost Log
            └── (Invalid)
                     │
            6. Repair Retry (Attempt 2 with validation feedback)
                  ├── (Valid) ──────► 200 OK (repairs_needed: 1)
                  └── (Invalid) ────► 422 Unprocessable + logs/quarantine.jsonl
```

### Full Interactive API Documentation
Interactive OpenAPI 3.0 documentation is available at `http://localhost:3000/docs`.
