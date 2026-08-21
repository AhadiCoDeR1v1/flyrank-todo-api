# FlyRank Backend Engineering Track — Assignment BE-08 / A8 Submission Report
**PDF Report Generator · Data-to-Document Pipeline with SQL Aggregations & Playwright Chromium**

---

## 📌 Document & Submission Metadata
- **Student / Intern Name:** Ahad Iqbal
- **Email:** ahadparhar@gmail.com
- **Track:** Backend AI Engineering — Week 7 / Week 4 (Assignment BE-08 / A8: "PDF report generator")
- **Project Repository:** [https://github.com/AhadiCoDeR1v1/flyrank-todo-api](https://github.com/AhadiCoDeR1v1/flyrank-todo-api)
- **Technology Stack:** Node.js 24, Express.js 5, SQLite (`node:sqlite`), Playwright & Headless Chromium, Inngest SDK (`inngest`), OpenAPI 3.0 / Swagger UI
- **Submission Date:** August 21, 2026
- **Assignment Grade Target:** Complete (Stages 0–6 + Stage 7 AI Rematch + All Stretch Goals)

---

## 1. Executive Summary & Core Engineering Philosophy

"Generate a Report" is the quintessential backend pipeline in production SaaS engineering. Whether generating customer billing invoices, financial statements, or weekly analytical digests, backend systems transform raw transactional rows into human-readable documents.

### The Four-Step Pipeline

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                  THE DATA-TO-DOCUMENT PIPELINE                                   |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                  |
|   1. QUERY (SQL)              2. RENDER (Playwright)         3. STORE           4. SERVE BY LINK |
|   [ SQLite Database ]   ──►   [ HTML Template + CSS ]  ──►   [ File System ]──►  [ HTTP Stream ] |
|   Turn 200 order rows         Headless Chromium prints       Save PDF to disk   GET /reports/1/file|
|   into 5 key numbers.         clean A4 document.             (reports/<id>.pdf) (res.sendFile).  |
|                                                                                                  |
|   Core Rule: "Store and link; never pass 20 megabytes of binary bytes through JSON APIs."         |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
```

### Key Engineering Pillars
1. **Boring SQL is 80% of Reporting:** Instead of pulling thousands of raw rows into JavaScript memory to loop through, the database engine does the heavy lifting via SQL aggregation (`COUNT`, `SUM`, `AVG`, `GROUP BY`).
2. **Headless Browser Printing:** You don't draw vector lines to build a PDF—you write semantic HTML and ask Chromium to "print" it into a standardized PDF file.
3. **Artifact Handling & Idempotency:** The server stores generated files once on disk and serves them by address link, enforcing same-day caching so double-clicking users receive cached files without re-rendering.

---

## 2. Complete System Workflow Diagram

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                   COMPLETE PIPELINE ARCHITECTURE                                 |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                  |
|   [ Client HTTP Request ] ─── POST /reports { force?: boolean } ───► [ Express API Router ]      |
|                                                                             │                    |
|        ┌────────────────────────────────────────────────────────────────────┴───────────────┐    |
|        │  1. Check Same-Day Idempotency Cache:                                              │    |
|        │     If report generated today AND !force:                                          │    |
|        │     └──► Immediately return HTTP 200 OK: { id: 1, file: "/reports/1/file", cached } │    |
|        │                                                                                    │    |
|        │  2. SQL Aggregations (SQLite - report.db):                                         │    |
|        │     - Total Orders (COUNT), Total Revenue (SUM), Avg Order Value (AVG)             │    |
|        │     - Top 5 Products by Revenue (GROUP BY product ORDER BY sum DESC LIMIT 5)       │    |
|        │     - 7-Day Revenue Trend (GROUP BY SUBSTR(created_at, 1, 10))                     │    |
|        │     - Detailed Order Records (200 rows)                                            │    |
|        │                                                                                    │    |
|        │  3. HTML Template & Print CSS Compilation:                                         │    |
|        │     - Injects metrics into executive cards, top tables, and transaction logs       │    |
|        │     - Applies print CSS: tr { break-inside: avoid }, thead { display: table-header}│    |
|        │                                                                                    │    |
|        │  4. Headless Chromium PDF Generation (Playwright):                                 │    |
|        │     - Launches headless browser, renders DOM, prints A4 PDF to disk                │    |
|        │                                                                                    │    |
|        │  5. Database Persistence:                                                          │    |
|        │     - Inserts metadata into `reports` table { id, path, created_at, created_date } │    |
|        │     - Responds with HTTP 201 Created: { id: 1, file: "/reports/1/file" }           │    |
|        └────────────────────────────────────────────────────────────────────────────────────┘    |
|                                                                                                  |
|   [ Download Link ] ─── GET /reports/1/file ───► Streams binary PDF file from disk (res.sendFile)|
+──────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. SQL Aggregation Query Engine

We selected **Option A: The Little Shop** dataset consisting of 200 order transactions seeded across the last 30 days in SQLite `report.db`.

```sql
-- Query 1: Total Orders, Revenue, Average, Min, and Max
SELECT 
    COUNT(*) as total_orders,
    COALESCE(SUM(amount), 0) as total_revenue,
    COALESCE(AVG(amount), 0) as avg_order_value,
    COALESCE(MIN(amount), 0) as min_order_value,
    COALESCE(MAX(amount), 0) as max_order_value
FROM orders;

-- Query 2: Top 5 Products Ranked by Revenue Performance (GROUP BY)
SELECT 
    product,
    COUNT(*) as order_count,
    ROUND(SUM(amount), 2) as total_revenue,
    ROUND(AVG(amount), 2) as avg_price
FROM orders
GROUP BY product
ORDER BY total_revenue DESC
LIMIT 5;

-- Query 3: Daily Revenue and Order Volume Trend (Last 7 Active Days)
SELECT 
    SUBSTR(created_at, 1, 10) as report_date,
    COUNT(*) as order_count,
    ROUND(SUM(amount), 2) as daily_revenue
FROM orders
GROUP BY SUBSTR(created_at, 1, 10)
ORDER BY report_date DESC
LIMIT 7;

-- Query 4: Detailed Orders Transactions Log (200 Rows for Page-Break Verification)
SELECT id, customer, product, ROUND(amount, 2) as amount, created_at
FROM orders
ORDER BY id ASC;
```

---

## 4. HTML-to-PDF Template & Print CSS Page-Break Architecture

### The Classic Page-Break Trap
When converting large HTML tables into multi-page PDFs, default rendering engines arbitrarily slice table rows in half across page boundaries and drop table headers on subsequent pages.

### The Production Fix:
```css
/* 1. Standard A4 Dimensions and Page Margins */
@page {
    size: A4;
    margin: 15mm 12mm 15mm 12mm;
    @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #94a3b8;
    }
}

/* 2. Prevent Row Slicing across Page Boundaries */
tr {
    page-break-inside: avoid;
    break-inside: avoid;
}

/* 3. Force Table Headers to Repeat on Page 2, 3, 4+ */
thead {
    display: table-header-group;
}

table {
    width: 100%;
    border-collapse: collapse;
    page-break-inside: auto;
}
```

### Visual Preview of Generated PDF Report (Page 1)

![PDF Report Page 1 Preview](docs/pdf_report_page1.png)

---

## 5. Stage-by-Stage Implementation & Verified Checkpoints

### Stage 0: The Setup
- Verified `GET /health` returns `200 OK`.
- Installed Playwright and Chromium browser binary (`npx playwright install chromium`).
- Commit: `Stage 0: setup ready`

---

### Stage 1: Data Worth Reporting On (SQLite & Seeding)
- Initialized `report.db` using Node.js built-in `node:sqlite` module.
- Built `scripts/seed.js` to insert 200 realistic orders across 6 product tiers.
- **Idempotency Proof:** Running `npm run seed` twice clears and re-populates exactly 200 rows without duplicating records.
- Commit: `Stage 1: seeded report.db`

---

### Stage 2: Boring SQL Aggregations
- Built `src/services/reportData.js` implementing all 4 SQL aggregations.
- Ran `evals/test-aggregation.js` verifying that top product revenues sum accurately against total revenue.
- Commit: `Stage 2: aggregation queries`

---

### Stage 3: HTML to PDF Rendering with Playwright
- Built `src/services/pdfRenderer.js` combining executive HTML layout, metric cards, and print CSS.
- Generated `reports/test.pdf` via Playwright Chromium. Verified file size is ~80 KB across 4 clean pages with repeating headers and zero sliced rows.
- Commit: `Stage 3: HTML to PDF with clean page breaks`

---

### Stage 4: Serve by Link ("Store and Link" Pattern)
- Built `POST /reports`: Generates PDF artifact on disk, stores path in `reports` table, and returns `HTTP 201 Created` with `{ id: 1, file: "/reports/1/file" }`.
- Built `GET /reports/:id/file`: Streams the binary file with `Content-Type: application/pdf` and `Content-Disposition: inline`.
- Commit: `Stage 4: generate and serve by link`

---

### Stage 5: Ask Twice, Get One (Idempotency)
- Enhanced `POST /reports` to check if a report was already generated today (`created_date = today`).
- **Proof:** Back-to-back POST requests return `200 OK` with the exact same ID (`cached: true`) and create zero new files on disk. Passing `{"force": true}` bypasses cache and creates a fresh report.
- Commit: `Stage 5: duplicate requests make one report`

---

### Stage 6: Documentation & Artifact Hygiene
- Added `reports/` and `report.db` to `.gitignore`.
- Updated `README.md` with complete usage instructions and curl examples.
- Commit: `Stage 6: publish and docs`

---

## 6. Stretch Goals & Inngest Background Integration

| Stretch Feature | Technical Implementation | Value Delivered |
| :--- | :--- | :--- |
| **Control Panel List Endpoint (`GET /reports`)** | Lists all generated PDF reports from SQLite with direct download links. | Complete historical auditing and admin visibility. |
| **Monday at 08:00 Weekly Cron (`0 8 * * 1`)** | Inngest cron trigger that queries SQLite and renders the executive PDF automatically every Monday morning. | Automated scheduled document delivery without human intervention. |
| **Async Background PDF Generation (`POST /reports/async`)** | Dispatches Inngest event and returns `202 Accepted` immediately for massive data exports. | Unblocks HTTP connection pool for large enterprise datasets. |

---

## 7. Stage 7: The AI Rematch ("AI vs Me")

### Specification Prompts & Quarantined Code
We tested an AI assistant in [`ai-version/pdf-generator/`](file:///home/ahadiqbal/Career/FlyRank/Assingments/flyrank-todo-api/ai-version/pdf-generator/) using memory-based prompts.

### Side-by-Side Comparison

```diff
- AI Version: Monolithic Script & Missing Daily Trend Query
- Omitted 7-day revenue trend SQL aggregation
- Raw unstyled HTML table without page padding or margins

+ Hand-Built Version: Modular Enterprise Pipeline
+ Implements all 4 SQL aggregations (Totals, Top 5, 7-Day Trend, All Orders)
+ Styled executive layout with KPI cards and precise @page margins
+ Explicit Content-Type: application/pdf and Content-Disposition headers
```

### Core Analytical Takeaways
1. **What the AI did better:** Generated an ultra-compact ~110 line script combining database creation, rendering, and routing in one glanceable file.
2. **What the AI missed:** Missed the 7-day date grouping aggregation, omitted `@page` margin control, and did not modularize database seeding.
3. **The Specification Lesson:** Without explicitly naming styling rules and aggregation sets, the AI defaulted to bare unstyled browser defaults. Specifying exact contracts produces professional output.

---

## 8. Answers to Core Assignment Questions

### 1. At what point would you move PDF generation out of the request?
> **Answer:** You should move PDF generation out of the synchronous HTTP request and into a background job (such as Inngest or BullMQ) when generation latency exceeds **1.5 to 2 seconds**, when dataset volume exceeds **5,000+ rows**, or when concurrent users cause server event loop delays. For a quick single-page report under 500ms, a direct request is acceptable; for heavy document pipelines, the asynchronous 202 pattern is mandatory.

### 2. What does the idempotency check protect against, and where does a missing check cost money?
> **Answer:** 
> 1. **What it protects against:** Prevents redundant CPU/GPU rendering cycles, disk storage exhaustion, and race conditions when users double-click "Download Report" or browser auto-retries fire.
> 2. **Real-world costly failure:** If an automated invoice generator or email marketing report lacks idempotency, a double-clicked request will send **two duplicate invoices to a customer** or double-charge payment webhooks, creating customer support churn and accounting nightmares.

---

## 9. Automated Verification Test Suite Results

All automated test suites executed with 100% pass rates:

```
===============================================================
🚀 FLYRANK ASSIGNMENT BE-08 / A8: PDF REPORT GENERATOR TEST SUITE
===============================================================
  ✅ PASS: GET /health status is 200
  ✅ PASS: POST /reports returned 201 Created (1062ms latency)
  ✅ PASS: Response includes report ID and file link: {"id":1,"file":"/reports/1/file"}
  ✅ PASS: GET /reports/1 returns 200 OK
  ✅ PASS: Report metadata matches requested ID
  ✅ PASS: Report metadata contains download link
  ✅ PASS: GET /reports/1/file returns 200 OK
  ✅ PASS: Content-Type header is 'application/pdf'
  ✅ PASS: Downloaded PDF size is valid (80.56 KB)
  ✅ PASS: File content is a verified PDF document (Header: %PDF-)
  ✅ PASS: Sample verified PDF saved to reports/downloaded-sample.pdf
  ✅ PASS: Second POST /reports returns 200 OK (Idempotent Cache)
  ✅ PASS: Idempotent response returned same report ID #1
  ✅ PASS: Response flag indicates cached: true
  ✅ PASS: Forced POST /reports with {force: true} returns 201 Created
  ✅ PASS: Forced generation created new ID #2
  ✅ PASS: GET /reports returns 200 OK
  ✅ PASS: GET /reports returns reports array (Length: 2)
  ✅ PASS: List contains our generated report
===============================================================
📊 SUMMARY: 19 / 19 PDF Pipeline Assertions Passed
===============================================================
```

---

## 10. 📸 Step-by-Step Guide for Taking & Inserting Assignment Screenshots

Follow these exact steps to capture the required visual proofs for your final submission:

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    REQUIRED SCREENSHOT CHECKLIST                                 |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|  [ ] 1. Seeding the Database (`npm run seed` Output) (`docs/stage1_seed_output.png`)             |
|  [ ] 2. SQL Aggregation Terminal Output (`node evals/test-aggregation.js`) (`docs/stage2_sql.png`)|
|  [ ] 3. Generated PDF Document Page 1 Preview (`docs/pdf_report_page1.png`)                      |
|  [ ] 4. Terminal `curl` POST ➔ Download File Proof (`docs/stage4_curl_download.png`)             |
|  [ ] 5. Idempotency Proof: 2 POSTs returning same ID (`docs/stage5_idempotency.png`)             |
|  [ ] 6. Complete Test Suite 100% Passing (`docs/test_pdf_pipeline_verification.png`)             |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 🔹 Screenshot 1: Database Seeding (`docs/stage1_seed_output.png`)
- **How to Take:** In your terminal, run `npm run seed`. Capture the output showing `✅ Seed Complete: Database contains 200 orders.`. Save to `docs/stage1_seed_output.png`.

### 🔹 Screenshot 2: SQL Aggregations (`docs/stage2_sql.png`)
- **How to Take:** In your terminal, run `node evals/test-aggregation.js`. Capture the summary metrics, top 5 products table, and 7-day trend table. Save to `docs/stage2_sql.png`.

### 🔹 Screenshot 3: PDF Document Preview (`docs/pdf_report_page1.png`)
- **How to Take:** Open `reports/test.pdf` in your PDF viewer or browser, or use the generated image at `docs/pdf_report_page1.png`.

### 🔹 Screenshot 4: Terminal POST & Download Proof (`docs/stage4_curl_download.png`)
- **How to Take:** In terminal, run `curl -i -X POST http://localhost:3000/reports -H "Content-Type: application/json" -d '{"force": true}'` followed by `curl -i -o sales.pdf http://localhost:3000/reports/1/file`. Capture the terminal showing HTTP 201 and HTTP 200 PDF headers. Save to `docs/stage4_curl_download.png`.

### 🔹 Screenshot 5: Idempotency Proof (`docs/stage5_idempotency.png`)
- **How to Take:** Run two `curl -s -X POST http://localhost:3000/reports` commands back-to-back. Capture the output showing identical IDs with `cached: true`. Save to `docs/stage5_idempotency.png`.

### 🔹 Screenshot 6: Test Suite Passing (`docs/test_pdf_pipeline_verification.png`)
- **How to Take:** Run `npm test`. Capture the screen showing `19 / 19 PDF Pipeline Assertions Passed`. Save to `docs/test_pdf_pipeline_verification.png`.

---

## 11. Git Commit History

```
* Stage 7: AI vs me (quarantined AI evaluation, prompt comparisons, diff matrix)
* Stage 6: publish and docs (complete README, openapi specs, submission report, PDF preview)
* Stage 5: duplicate requests make one report (same-day idempotency caching and force override)
* Stage 4: generate and serve by link (POST /reports, GET /reports/:id/file PDF streaming)
* Stage 3: HTML to PDF with clean page breaks (Playwright Chromium, @page margins, repeating thead)
* Stage 2: aggregation queries (COUNT, SUM, AVG, GROUP BY top 5 and 7-day trend)
* Stage 1: seeded report.db (SQLite orders table with 200 records, idempotent seed script)
* Stage 0: setup ready (Express baseline, Playwright & Chromium install)
* Extras: weekly Monday PDF report cron, control panel list, async Inngest generation
```
