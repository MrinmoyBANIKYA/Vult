# Running Vult work on autopilot: what to provide

This file lists everything Claude needs from you to keep building and running Vult without stopping to ask: AI models, data sources and APIs, Supabase, accounts, and the decisions only you can make. It is kept up to date as work lands. Nothing here is a secret; put keys and passwords in `.env.local` (git-ignored), never in this file.

## The rule on AI models

**No paid AI models.** Every model call in Vult goes through `supabase/functions/_shared/llm.js`, and the engine is set to a local model. The hosted providers (Groq, Gemini, OpenRouter, OpenAI, Anthropic) stay in the code because clients may choose them, but they are not used for development, testing or demos.

| What | Where it runs | Cost | Status |
| --- | --- | --- | --- |
| Ollama with `qwen3:8b` | This laptop (RTX 4050, 6 GB) | Free | Installed and in use. Classifies statement rows (about 3 minutes per filing) and drafts the business and risk sections. |
| Tesseract OCR (`tesseract.js` 7, English `best_int` model) | The browser, on this machine | Free, open source | Bundled under `/ocr`; no CDN. Reads scanned pages. It is not a language model. |
| LibreOffice | This laptop (per-user install) | Free | Installed. Recalculates every workbook to check its formulas. |

Optional, only if you want better row classification on hard filings: `ollama pull qwen3:14b` (about 9 GB; it will not fit in 6 GB of VRAM and runs partly on the CPU, roughly three times slower). Nothing else needs downloading.

## Free data sources (no keys)

| Source | Used for | What you need to provide |
| --- | --- | --- |
| SEC EDGAR (`data.sec.gov`) | US company financials (XBRL) for peers and the cross-check | **A contact for the SEC User-Agent.** SEC asks every client to send a name and email. Add `VULT_SEC_USER_AGENT="Your Name your@email"` to `.env.local`. Claude will not use your email without being told to. Until then a generic agent is sent, which SEC may throttle. |
| filings.xbrl.org | UK and EU listed companies' ESEF annual reports | Nothing |
| Yahoo Finance chart API | Share prices, two-year weekly beta, FX rates, US 10-year yield (CBOE ^TNX) | Nothing. It is free but unofficial: fine for the desk and demos, not for client deliverables. |
| Bank of England statistical database | 10-year gilt yield (IUDMNZC) | Nothing |

For client work you will eventually want a licensed feed (FactSet, S&P Capital IQ, LSEG or Bloomberg). That is a paid contract and your decision; the engine's `server/market.js` is the one place to add it.

## Supabase

Demo mode needs nothing. To run Vult with sign-in, saved runs shared across a team, and row-level security:

**Local (free).** Start Docker Desktop, then `npm run db:start` and copy the API URL and publishable key it prints into `.env.local`. Claude can do all of this once Docker Desktop is running.

**Cloud (free tier is enough to start).** Provide:

1. The project URL and publishable key (Project Settings, API) for `.env.local`.
2. A Supabase personal access token (`SUPABASE_ACCESS_TOKEN`) and the database password, so Claude can run `npx supabase link`, `db push` and `functions deploy` without you.
3. Under Authentication, URL configuration: the site URL you will host Vult on.

**Single sign-on.** Microsoft Entra ID (Azure AD) and Google sign-in are free on Supabase; provide the tenant ID, client ID and client secret of an app registration. SAML SSO (Okta, Entra SAML) needs the Supabase Pro plan and the SSO add-on, which is paid, so it is your call.

## Accounts and decisions only you can make

- **Git.** The project folder is not a git repository. Run `git init` (or let Claude do it) and create a private GitHub repository; CI is already written in `.github/workflows/ci.yml`.
- **Hosting.** Any Docker host or cloud account (UK or EU region for UK clients). Claude can write the deployment once you say where.
- **Business model.** Software (per seat or enterprise licence) or a service (per deliverable, with human review). The current pricing screens assume a service. This changes the product, the pricing and who signs off work.
- **Security and compliance.** SOC 2 Type II and ISO 27001 need an auditor and policies signed by a company officer; a penetration test needs a vendor; a data processing agreement and terms need a lawyer.
- **Market data licence** (see above).
- **Excel add-in sideloading.** Installing the local development certificate and loading the add-in in Excel needs one click from you each (Windows asks for confirmation).

## What Claude can do without asking

Everything in the code: parsing, checks, models, the workbook, memo and deck, the Filing desk, migrations, tests, the benchmark harness, documentation, and running the app, the engine, LibreOffice, Ollama and local Supabase on this machine.

## Status of the fixes from the product review

Updated as each one lands; see the end of the work for the final list.
