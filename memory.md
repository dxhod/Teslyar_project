# Project Memory

## Current Project

This repository is the test-task version of an Amazon EU analytics dashboard for the Northstar dataset.

The app compares March 2026 vs April 2026 using:

- aggregated P&L files;
- country-level PPC files;
- Python/pandas data preparation;
- Next.js dashboard UI;
- Groq-powered AI insights and Q&A.

The current GitHub repository is:

```text
private repository
```

The repository contains real Amazon report files and derived JSON analytics. It should remain private.

## Main Architecture

Data flow:

```text
data/raw CSV files
  -> scripts/prepare_data.py
  -> data/processed/dashboard.json
  -> public/data/dashboard.json
  -> Next.js dashboard
  -> Groq AI endpoints
```

Important files:

- `scripts/prepare_data.py` — pandas pipeline.
- `scripts/prepare_data.cmd` — Windows helper that tries `python`, `py -3`, Anaconda, then Miniconda.
- `public/data/dashboard.json` — JSON read by Next.js.
- `src/components/Dashboard.tsx` — main dashboard UI.
- `src/app/api/ai-insight/route.ts` — executive insight and AI-selected attention SKUs.
- `src/app/api/ask/route.ts` — Q&A endpoint.
- `src/lib/qa-context.ts` — compact and question-specific context builders.
- `src/lib/groq.ts` — Groq model fallback chain.

## Data Processing Notes

The CSV reports are real and messy:

- P&L files use `;` as delimiter.
- PPC files use a different CSV structure.
- Numbers use European notation, for example `1 234,56`.
- Some numeric values contain NBSP/non-breaking spaces.
- File names are inconsistent.
- Belgium appears as `Amazon.com.be`, mapped to `BE`.
- Marketplace-level rows are used for country totals to avoid double counting product rows.
- Product rows are aggregated by `ASIN + SKU`.
- PPC is used as country/portfolio advertising context and is not joined to P&L at SKU level.

## AI Notes

The AI layer uses Groq.

Environment variables:

```bash
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_SECONDARY_FALLBACK_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

There is no deterministic fallback for AI. If all Groq models fail, the UI shows an AI integration error.

Q&A uses question-specific context to avoid Groq TPM/token limits. For example:

- top-sales questions receive top sales/unit helpers;
- risk/check-first questions receive biggest profit/margin/sales drops;
- country questions receive country aggregates;
- unrelated questions are blocked by a guard and return a short scope message.

Debug endpoint:

```text
/api/debug/qa-context
/api/debug/qa-context?question=Which SKU sold best in April?
```

## Local Commands

Install dependencies:

```bash
npm install
```

Prepare data:

```bash
npm run prepare:data
```

Run locally:

```bash
npm run dev
```

Build check:

```bash
npm run build
```

## Current UI Decisions

Header:

```text
Northstar portfolio · March vs April 2026
Amazon EU Performance Dashboard
```

Main blocks:

- KPI overview.
- Executive insight.
- AI-selected SKU attention list.
- AI Q&A.
- Country breakdown.
- Where we dropped.
- Product table with search and clickable sorting.

Visible UI should avoid showing Groq provider name. It should say `AI`, not `Groq AI`.

## Important Git Notes

`.env.local` is ignored and must not be committed.

The project has already been pushed to:

```text
private repository URL
```

Because real Amazon report data is included, keep this repository private.

## Future Pet Project Plan

The goal later is to turn this into a separate portfolio/pet project.

Recommended approach:

1. Copy the current project into a new folder.
2. Remove `.git` history.
3. Remove all real CSV files and real derived JSON.
4. Generate synthetic demo data with similar structure and edge cases.
5. Remove all private brand references.
6. Translate UI and README to English.
7. Rename project to something generic, for example:

```text
Marketplace Performance Dashboard
```

8. Create a new public GitHub repository.
9. Deploy the portfolio version separately.

The portfolio version should demonstrate the same engineering ideas:

- messy CSV ingestion;
- pandas normalization;
- marketplace performance analytics;
- AI executive insight;
- AI-selected attention items;
- Q&A over processed aggregates;
- query-specific context compression;
- model fallback chain;
- clean product-like dashboard UI.

Do not reuse real private-brand/Amazon report data in the public pet project.
