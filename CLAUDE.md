# Vult: notes for Claude Code

Vult is an AI-native research desk for UK and US deal teams: financial models, comps, competitor, company and market analysis, delivered in hours and traced to source. This repo is the web app (React 18, Vite 8, Tailwind CSS 4, plain JavaScript/JSX) and its backend (Supabase: Postgres, Auth, Realtime, Storage, Deno edge functions).

## Commands

```bash
npm install
npm run dev              # http://localhost:5173, demo mode unless .env.local has Supabase keys
npm run engine           # the Vult engine on 127.0.0.1:8787 (model calls, LibreOffice recalculation); Vite proxies /engine
npm test                 # node:test suites in src/lib (extraction, Assayer, model, workbook, memo)
npm run lint             # ESLint, including React hooks and React Compiler rules
npm run format           # Prettier (format:check in CI)
npm run build            # production build into dist/
npm run db:start         # local Supabase (Docker), applies migrations and seed
npm run db:reset         # rebuild the local database
npm run db:seed:generate # rebuild supabase/seed.sql from the demo data in src/lib
```

Before you call a change done, run `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. If you touched `supabase/`, run `npm run db:reset` against a local stack.

## How the app is put together

- `src/main.jsx` mounts fonts, styles, the error boundary and `AuthGate`.
- `src/App.jsx` owns all app state (route, run clock, model state, dock, co-pilot messages, approvals) and exposes it through `Ctx`. Views read it with `useA()` from `src/lib/context.js`. Common names: `d` is the active workspace's data, `m` the model state, `run` the current run, `dock` the right-hand panel.
- Routing is hash based (`#home`, `#autopilot`, `#engagements`, `#platform`, and one hash per engagement tab such as `#model`). `G` then a letter navigates; the letters are in `src/views/tabs.js` and the keyboard handler is in `App.jsx`.
- `src/views/` holds one file per area. `shell.jsx` is the header, icon rail, mobile navigation, command palette and tab bar. `engagement.jsx` renders the engagement header and picks the tab view.
- `src/components/ui.jsx` holds the primitives (Radix based: Button, Badge, Tip, Popover, Dropdown, Dialog, Sheet, Switch, Slider, Segmented, Progress, command palette). `shared.jsx` holds Vult atoms (Mark, Av, CoLogo, Num, Status, Hallmark, DocPage, Panel, PageHead). `charts.jsx` wraps Recharts. Reuse these before writing new ones.
- `src/lib/engine.js` is the demo data and all finance maths (DCF `calc`, `lbo`, `compsData`, `sheetCells`, run planning `planFor`, the evidence trail `getEvidence`, the scripted co-pilot `copilot`). The maths runs in the browser in both modes.

## Filing desk and the engine

The Filing desk (`src/views/desk.jsx`, `#desk`) is the real product slice: 10-K PDF to a checked model, memo and tear sheet. Everything else in the demo engagements is scripted, and the engagement header says so.

- The pipeline is `src/lib/pipeline.js`: `filing.js` finds statement pages and splits rows (`pdf-text.js` rebuilds lines from pdf.js items), a model classifies rows, `assayer.js` checks, `model.js` forecasts, `workbook.js` writes the .xlsx, `memo.js` the .docx files.
- **A language model never supplies a number.** It returns row ids only (`mapping`); values are parsed from the page text by code. Narrative from a model goes through `stripFigures`. Keep it that way.
- Every Assayer pass or flag is computed. Do not add a check that trusts a model's answer, and never show a trust figure that is not computed.
- Each workbook formula has a twin in `model.js`; `checkCells` lists cells the engine recalculates in LibreOffice and compares. Change both together.
- All model calls go through `supabase/functions/_shared/llm.js` (providers: Ollama, LM Studio, Groq, Gemini, OpenRouter, OpenAI, Anthropic, custom OpenAI-compatible) and the prompts in `_shared/statements.js`. Both are plain JS used by the engine (`server/`), the edge functions and the browser. Add providers there, not in callers.
- The engine (`server/index.js`) binds to 127.0.0.1, refuses other origins, and keeps keys in `.vult/engine.json` (git-ignored). Never send keys to the browser.
- Test fixtures use the fictional Halden Instruments plc (`src/lib/fixtures/annual-report.js`); do not commit real filings.

## Demo mode and live mode

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`), the app runs on built-in demo data with no sign-in. With them, `AuthGate` shows sign-in and `useLiveWorkspace` loads the workspace from Supabase and reloads on realtime changes.

Keep both modes working. The rules that make that possible:

1. `src/lib/api.js` is the only file that calls Supabase. It maps rows into exactly the shapes the demo data uses (`R` in `engine.js`, `AUTO` in `autopilot.js`), so views never branch on the mode.
2. When you add a field the UI needs, add it to the demo data, to a **new** migration (never edit one that has been applied), to `scripts/generate-seed.mjs`, and to the mapping in `api.js`. Then run `npm run db:seed:generate`.
3. Writes go through `api.js` and are optimistic in `App.jsx`; in demo mode they only change local state.

## Backend rules

- Every table has row-level security. Members of an organisation read its rows; analysts and reviewers write; admins delete. Co-pilot history and briefing dismissals are private to each user.
- Approvals change only through `decide_approval()`, which records who decided and saves a model version when needed. Do not add update policies on `approvals`.
- `join_demo_workspaces()` gives a new account access to the seeded demo organisations. Remove it, or gate it, before real clients use the project.
- Edge functions (`supabase/functions/`) run on Deno and act as the signed-in user, so RLS applies. Pricing lives in `functions/_shared/pricing.ts` and must stay in step with `planFor` in `engine.js`. `ask-vult` and `extract-10k` use `VULT_LLM_PROVIDER`, `VULT_LLM_MODEL` and that provider's key (set with `npx supabase secrets set`; see `supabase/functions/.env.example`).

## Design rules

- Colours, radii and shadows are tokens in `src/index.css`: HSL triplets on `:root` (dark, the default) and `:root[data-theme="light"]`, exposed to Tailwind through `@theme`. Use token classes (`bg-raised`, `text-fg2`, `border-line`, `text-gold`), not raw colours. `--gold` is the electric-blue accent; the name is historical. Vult red (`--brand`) is for the logo and badges only.
- Surfaces are `.card` (20px radius, hairline border). Slides and documents render on paper inside `.light-scope` / `.on-paper`.
- Type is Plus Jakarta Sans for UI, Source Serif 4 for documents, Geist Mono for formulas.
- Copy is British English, sentence case, plain and specific. Join items with commas, not middots. Keep the "every company, client and figure here is fictional" notice.
- Check new UI at phone width (390px) and in the light theme. Respect `prefers-reduced-motion`.
