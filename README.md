# Northstar Amazon Dashboard

A local analytics dashboard for Amazon EU P&L reports covering March and April 2026. The main goal is to help a sales manager quickly understand what changed in the portfolio, where profit declined, and which SKUs deserve attention first.

## Why This Stack

**Python + pandas** prepares the data because the source files are real CSV reports with messy formats: `;` delimiters in P&L files, European number formats, NBSP characters inside numbers, inconsistent file names, and separate PPC reports.

**Next.js + TypeScript** powers the dashboard UI so the result feels like a small product instead of a technical notebook. It also keeps the local workflow and code structure clear.

**Groq** powers the AI layer. The model generates the executive insight, selects the SKUs to watch from prepared candidates, and answers questions over processed aggregates.

## Product Thinking

The first screen is built around the questions a sales manager would ask first:

- How did Sales change?
- What happened to Net profit?
- Did Margin decline?
- Did Units change?
- Which countries or products are driving the biggest change?

The dashboard therefore starts with key KPIs, then shows country breakdowns, AI-selected SKUs to watch, and a searchable/sortable product table.

The AI feature is not a chat widget for its own sake. Its main value is:

- **Executive insight**: a short explanation of what changed month over month.
- **SKUs to watch**: the model chooses 3-5 priority SKUs from prepared risk candidates.
- **Ask the AI analyst**: Q&A over pandas-processed aggregates.

The model does not receive raw CSV files and does not calculate metrics by itself. Python prepares the numbers first; Groq interprets already calculated facts.

## Data Processing

Raw files live in:

```text
data/raw
```

The preparation script is:

```text
scripts/prepare_data.py
```

It handles:

- P&L CSV files with `;` as delimiter;
- PPC CSV files with a different structure;
- European numbers such as `1 234,56`;
- NBSP characters inside numbers;
- inconsistent casing and file names;
- marketplace alias mapping, for example `Amazon.com.be -> BE`;
- country-level totals separately from product rows;
- product aggregation by `ASIN + SKU`.

P&L totals are taken from marketplace-level rows to avoid double-counting product rows. PPC is used as country and portfolio advertising context. PPC is not joined to P&L at SKU level because that would require a confirmed attribution rule.

The script generates:

```text
data/processed/dashboard.json
public/data/dashboard.json
```

Next.js reads the prepared JSON from `public/data/dashboard.json`.

## AI Layer

Groq environment variables:

```bash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

Model order:

1. `GROQ_MODEL`
2. `GROQ_FALLBACK_MODEL`
3. `GROQ_SECONDARY_FALLBACK_MODEL`

There is intentionally no deterministic fallback for AI. If every Groq model fails or hits limits, the dashboard shows an AI integration error because the test task is meant to demonstrate a real AI integration.

Q&A uses question-specific context. For example, best-selling product questions receive only top sales and top unit slices. Drop/risk questions receive country data and biggest-drop helper lists. This keeps requests smaller and reduces the chance of hitting token-per-minute limits.

Debug endpoint:

```text
/api/debug/qa-context
/api/debug/qa-context?question=Which SKU sold best in April?
```

## Full Windows Setup

### 1. Install Git

Run in PowerShell:

```powershell
winget install --id Git.Git -e --source winget
```

Check installation:

```powershell
git --version
```

If `winget` is not available, install Git manually:

```text
https://git-scm.com/download/win
```

### 2. Install Node.js

Run in PowerShell:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

Check installation:

```powershell
node --version
npm --version
```

If `winget` is not available, install Node.js LTS manually:

```text
https://nodejs.org/
```

### 3. Install Python

Run in PowerShell:

```powershell
winget install --id Python.Python.3.12 -e --source winget
```

Check installation:

```powershell
python --version
pip --version
```

If `winget` is not available, install Python manually:

```text
https://www.python.org/downloads/
```

Anaconda also works:

```powershell
winget install --id Anaconda.Anaconda3 -e --source winget
```

If the `python` command is still unavailable after installation, open a new PowerShell window or add Python to `PATH`.

### 4. Clone The Project

```powershell
git clone <private-repository-url>
cd <project-folder>
```

### 5. Install JavaScript Dependencies

```powershell
npm install
```

### 6. Install Python Dependencies

```powershell
pip install -r requirements.txt
```

If you use Anaconda and `pip` is not available in PowerShell, run this command in **Anaconda Prompt**.

### 7. Add The Groq API Key

Create `.env.local` from the example:

```powershell
copy .env.example .env.local
```

Open `.env.local` and replace:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

with your real Groq API key.

The other variables can stay as provided:

```bash
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

### 8. Prepare Data

```powershell
npm run prepare:data
```

This command runs the Python script, reads CSV files from `data/raw`, and generates the JSON used by the dashboard. On Windows, it automatically tries `python`, `py -3`, Anaconda, and Miniconda.

### 9. Run The Dashboard

```powershell
npm run dev
```

The terminal will show a local URL, for example:

```text
http://localhost:3000
```

Open that URL in the browser. If port `3000` is busy, Next.js will choose another port such as `3001`; open the URL printed by the terminal.

## Quick Local Start

Install dependencies:

```bash
npm install
```

Generate processed data:

```bash
npm run prepare:data
```

Run the dashboard:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## What I Would Add Next

If this test task were turned into a production solution, I would evolve it toward a more systematic data and AI architecture instead of only adding more charts.

### Ingestion Pipeline

- Add a dedicated report import layer with file-name normalization.
- Automatically detect report type, month, country, and marketplace.
- Store import history and processed dataset versions.
- Allow new months to be uploaded without code changes.

### Schema Validation And Data Quality

- Validate required columns for P&L and PPC reports.
- Validate number formats, currencies, empty values, and unexpected types.
- Reconcile marketplace totals against product rows to catch duplicates or missing rows.
- Detect duplicates by `ASIN + SKU + month`.
- Add alerts for abnormal Margin, ROI, Refunds, or negative Sales.

### Caching And Precomputed Aggregates

- Cache prepared aggregates for portfolio, country, SKU, and PPC levels.
- Split intermediate tables from the single JSON file when report volume grows.
- Make the AI context builder token-budget-aware.
- Store metadata such as processing date, pipeline version, row counts, and validation status.

### RAG For Q&A

- Build a retrieval layer over prepared aggregates so the model does not receive the full context.
- Index country, SKU, and month records and retrieve only relevant chunks for each question.
- Add semantic query routing for sales, profit, margin, PPC, country, SKU, and refunds.
- Reduce token usage, lower rate-limit risk, and make answers more stable.

### Multi-Agent Workflow

- **Data validation agent**: checks import quality and schema.
- **Anomaly detection agent**: finds sharp changes in Sales, Profit, Margin, Units, and PPC.
- **Insight agent**: creates the executive summary for the manager.
- **Q&A router/retriever agent**: decides which data is needed for the answer.
- **Answer critic**: checks that the answer is grounded in numbers and does not invent conclusions.

### Prompt Templates And Evals

- Use separate prompt templates for executive summary, attention SKUs, country analysis, and Q&A.
- Add evaluation cases for common manager questions.
- Add regression checks for prompt changes.
- Track hallucination rate and groundedness: every AI conclusion should map back to a concrete metric.

### Observability

- Log AI requests without secrets or raw private data.
- Store model used, fallback reason, latency, token estimate, and status code.
- Add separate error states for rate limits, invalid model responses, and missing API key.
- Monitor which questions users ask most often.

### Role-Based UX

- Add role-based insights for sales managers, PPC managers, and finance users.
- Show evidence cards under each AI conclusion with concrete country/SKU metrics.
- Export the executive summary to PDF or Google Sheets.
- Support more months and period selection.
