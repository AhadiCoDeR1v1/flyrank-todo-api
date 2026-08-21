# Stage 7: The AI Rematch — PDF Report Generator Specification Prompts

## Initial Prompt (Attempt 1)

```markdown
Build a Node.js Express application that queries a SQLite database of sales orders, aggregates key business metrics with SQL, renders an HTML executive sales report into a PDF using Playwright Chromium, and serves the PDF via an API link.

Requirements:
1. Database: SQLite database `report.db` with an `orders` table (id, customer, product, amount, created_at) seeded with ~200 orders, and a `reports` table (id, path, created_at, created_date).
2. SQL Aggregations:
   - Total number of orders and total revenue.
   - Top 5 products by revenue (GROUP BY product).
   - Last 7 days orders trend (GROUP BY date).
   - Full detailed table of all orders.
3. PDF Rendering:
   - HTML template with KPI cards, Top 5 table, daily trend table, and full orders table.
   - Print CSS page-break rules: table rows must not be cut in half across pages (`break-inside: avoid`) and table headers must repeat on every page (`thead { display: table-header-group }`).
   - Use Playwright Chromium to print to A4 PDF.
4. Endpoints:
   - POST /reports: Checks if a report was generated today. If yes (and not force), return 200 OK with the existing file link. Otherwise generate the PDF, save metadata, and return 201 Created with `{ id, file: "/reports/:id/file" }`.
   - GET /reports/:id: Return report metadata and file link.
   - GET /reports/:id/file: Stream the binary PDF from disk using `res.sendFile()`.
```

---

## Improved Rematch Prompt (Attempt 2)

```markdown
Build a production-grade Node.js 24 and Express 5 data-to-document PDF reporting microservice using the built-in `node:sqlite` module and Playwright Chromium headless rendering.

Strict Technical Contract Specifications:
1. SQLite Layer (`report.db`):
   - Table `orders`: (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT, product TEXT, amount REAL, created_at TEXT).
   - Table `reports`: (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, created_at TEXT, created_date TEXT).
   - Seed script `scripts/seed.js` must be idempotent: deletes existing records first, then inserts exactly 200 realistic rows (amounts $5-$200 across last 30 days).

2. SQL Aggregation Engine:
   - `COUNT(*)` for total orders, `SUM(amount)` for revenue, `AVG(amount)` for average order value.
   - `GROUP BY product ORDER BY total_revenue DESC LIMIT 5` with avg price.
   - `GROUP BY SUBSTR(created_at, 1, 10)` for last 7 active days.
   - Full orders log sorted by ID.

3. HTML-to-PDF Template & Print CSS:
   - Styled executive layout with brand header, 3 KPI metric cards, Top 5 performance table, daily trend table, and 200-row detailed transactions log.
   - Robust print CSS: `@page { size: A4; margin: 15mm 12mm; }`, `tr { page-break-inside: avoid; break-inside: avoid; }`, `thead { display: table-header-group; }`.
   - Playwright Chromium renderer with `--no-sandbox` flags, `page.setContent()` with `waitUntil: 'networkidle'`, and `page.pdf()`.

4. HTTP Endpoints:
   - `POST /reports`: Body `{ force?: boolean, days?: number }`. Checks `created_date = today`. If existing and `!force`, returns `200 OK` `{ id, file, cached: true }`. Otherwise generates PDF, inserts row, and returns `201 Created` `{ id, file: "/reports/<id>/file" }`.
   - `GET /reports/:id`: Returns `404` if not found; returns `{ id, file, created_at }` if found.
   - `GET /reports/:id/file`: Sets `Content-Type: application/pdf`, `Content-Disposition: inline; filename="..."`, and streams the file using `res.sendFile()`. Returns `404` if ID or file is missing.
   - `GET /reports`: Lists all generated reports in database.
```
