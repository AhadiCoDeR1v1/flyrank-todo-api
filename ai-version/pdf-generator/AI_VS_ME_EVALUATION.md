# Stage 7: The AI Rematch — PDF Generator Evaluation & Comparative Analysis

## 1. Specification Prompt Used
We prompted an AI assistant from memory to build the complete data-to-document pipeline:
- Database schema (`orders` and `reports` tables in SQLite).
- Four SQL aggregations (Totals, Top 5 products by revenue, 7-day trend, detailed table).
- HTML-to-PDF rendering via Playwright Chromium with print CSS page-break rules (`break-inside: avoid` and repeating `<thead>`).
- Endpoints: `POST /reports` (with same-day idempotency caching), `GET /reports/:id` (metadata), and `GET /reports/:id/file` (streaming PDF).

---

## 2. Checkpoint Comparison Matrix

| Checkpoint | Hand-Built Implementation (`src/`) | AI-Generated Implementation (`ai-version/`) | Status & Findings |
| :--- | :--- | :--- | :--- |
| **Stage 1: Seed & Database** | Dedicated module `src/db/sqlite.js` with WAL mode and idempotent `scripts/seed.js` | Inlined `report-ai.db` in single script without seed recipe | ⚠️ AI omitted standalone seed script |
| **Stage 2: Aggregation SQL** | Structured queries (`COUNT`, `SUM`, `AVG`, `GROUP BY` top 5, `GROUP BY` date 7-day trend) | Basic `COUNT`, `SUM`, and Top 5; omitted 7-day revenue trend | ⚠️ AI missed daily trend query |
| **Stage 3: HTML Template & Print CSS** | Professional executive layout, KPI metric cards, `@page` margins, zebra striping, repeating headers | Raw unstyled HTML table, basic borders, no page margin rules | 🌟 Hand-built is publication-ready |
| **Stage 3: Page Break Survival** | Tested across 4+ A4 pages with zero cut rows, headers on each page | Simple `tr { break-inside: avoid }` only; lack of page padding caused edge clipping | ⚠️ AI had margin clipping issues |
| **Stage 4: Store & Link Serving** | Secure path resolution, `Content-Disposition`, `Content-Type: application/pdf` headers | Bare `res.sendFile(row.path)` without headers | 🌟 Hand-built handles browser streaming properly |
| **Stage 5: Idempotency Check** | Comprehensive check on `created_date = today` returning `cached: true` flag | Basic check without `cached` metadata response | ✅ Both implement same-day cache |
| **Stretch: Inngest & Monday Cron** | Background async queue (`/reports/async`) and `0 8 * * 1` Monday cron | Omitted entirely | 🌟 Hand-built connects to background engine |

---

## 3. The Three Critical Architectural Questions

### Q1: What did the AI do better — and do you understand it?
**Answer:** The AI wrote a very compact, single-file script in under 120 lines that combined database setup, query execution, Playwright rendering, and endpoint routing into one readable file. It makes understanding the basic flow fast.

### Q2: What did it get wrong or silently ignore?
**Answer:**
1. **Omitted the 7-Day Revenue Trend:** The prompt requested 4 aggregation sets, but the AI only implemented 3 and skipped the daily date-grouping query.
2. **Missing Print Margins & Styling:** It didn't set `@page { margin: 15mm; }`, meaning text rendered right up against the edge of the printed paper in Chromium.
3. **No Database Modularity or Error Handling:** It put database creation and route handlers in one file, making unit testing and seeding difficult.

### Q3: What did your prompt forget to specify — and what did the AI silently decide for you?
**Answer:**
1. **Visual Design & Typography:** The prompt asked for "HTML template with KPI cards", but didn't specify styling frameworks, colors, or page margins. The AI chose plain browser defaults.
2. **File Download Headers:** The prompt didn't mention HTTP headers, so the AI relied on default `res.sendFile()` behavior rather than setting explicit `Content-Type: application/pdf` and `Content-Disposition`.

---

## 4. Rematch Improvement
In the Rematch Prompt (Attempt 2), we specified strict modular files, exact SQL aggregation queries, detailed print CSS margin rules, and explicit HTTP response headers. The regenerated code matched production standards.
