# Vult model risk documentation

For model risk and validation teams reviewing Vult under the US Federal Reserve's SR 11-7 or the UK Prudential Regulation Authority's SS1/23. It describes what Vult computes, where a language model is involved, how outputs are checked, and how changes are controlled. It covers the Filing desk (filing to model, memo and tear sheet). The other engagement screens are a scripted concept and are labelled as such in the product.

## 1. What the tool does

From an annual report or 10-K (PDF, scanned PDF or a data-room spreadsheet) Vult produces:

1. the reported income statement, balance sheet and cash flow, each figure tied to its page and printed row;
2. a five-year three-statement forecast and an unlevered DCF (or, for banks and insurers, a justified price-to-book valuation), as an Excel workbook with live formulas;
3. trading comparables from peers' own filings and market prices;
4. an investment memo and a one-page tear sheet in Word, with every figure footnoted to its source.

Outputs are drafts for an analyst. Vult does not sign anything off.

## 2. Where a language model is used, and where it is not

| Step | Done by | Can a model put a number in the output? |
| --- | --- | --- |
| Find the statement pages | Code (headings, indicators, scoring) | No |
| Split rows and read figures | Code (`src/lib/filing.js`) | No |
| Decide which printed row is which line item ("which row is revenue?") | **Language model** (local by default) | **No.** The model returns row ids only. Values are read from the page by code. |
| Scanned pages | Tesseract OCR (not a language model) | OCR reads digits; every OCR'd page is flagged for review |
| Checks (the Assayer) | Code (`src/lib/assayer.js`) | No. A model's answer is never counted as a pass |
| Forecast, DCF, comps, valuation | Code (`src/lib/model.js`, `financials.js`, `comps.js`) with a formula twin in the workbook | No |
| Business and risk narrative | **Language model**, from the filing's own text | No. Any sentence containing a digit is removed (`stripFigures`) |
| Market data | Public sources (SEC, ESEF, Bank of England, Yahoo Finance) read by code | No; each value carries its source and date |

The model's only influence on figures is which row it picks. A wrong pick is caught by the label check (the printed label must plausibly fit the line item), the coverage check, the accounting identities (balance sheet balances, cash flow ties, net income agrees across statements), and, where fetched, the company's own structured filing.

## 3. The checks (the Assayer)

Every check is deterministic and recomputed on every build:

- **Figure against the filing.** Each figure is re-read from its cited page and column, and must match.
- **Row label fits the line item.** A pattern each line item's printed label must match.
- **Coverage.** Required lines present (different sets for companies and for banks and insurers).
- **Accounting identities.** Gross profit, pre-tax less tax, net income across statements, assets equal liabilities plus equity, current plus non-current totals, net assets equal equity, cash flow sums, opening plus change equals closing cash, closing cash equals the balance sheet, net income per diluted share equals reported EPS.
- **Structured filing cross-check.** Where the analyst fetches the company's SEC XBRL or ESEF data, each figure is compared with it.
- **OCR.** Each scanned page used is flagged for comparison with the page image.
- **Workbook recalculation.** LibreOffice recalculates the generated workbook and selected cells (balance checks, WACC, enterprise value, equity value, per-share value, sensitivity grid, comps medians and implied value) must equal the engine's values.
- **Analyst entries.** A figure an analyst types must appear on the page they cite.

A pass means a figure matches its source or an identity ties. It is not a judgement on assumptions.

## 4. Human review and corrections

The analyst can point a line item at another row (statement or note page), clear a wrong match, or enter a figure with its page. Each correction needs a reason and records who and when; it is replayed over the model's original mapping, so figures are always rebuilt from source. Corrections appear in the workbook (Corrections sheet) and the memo. Every build, correction and change of assumption is kept as a version.

## 5. Assumptions

Defaults and their basis are written next to each input in the workbook (Inputs sheet). Defaults that need a house view (risk-free rate, equity risk premium, beta, cost of debt, terminal growth) say so. Fetched values (price, beta, risk-free rate) record their source and date, and lose that label if the analyst changes them.

## 6. Accuracy evidence

`npm run benchmark` runs the full pipeline over a corpus of real filings in `.vult/benchmark` and scores every line item against an answer key (built from the companies' SEC XBRL data by `scripts/benchmark-fetch.mjs`). It reports accuracy and precision per line item and per filing. `npm run benchmark -- --fixtures` scores the model on Vult's fictional US, UK and bank layouts. Unit tests cover parsing, checks, model, workbook, corrections, saving and comps, including LibreOffice recalculation.

Validation teams should run the benchmark on their own sample of filings with the model they intend to use, and record the results with the model and prompt versions below.

## 7. Change control

- **Model and prompts.** The model name and provider used for a run are recorded on the workbook cover and in the saved run. Prompts live in one file (`supabase/functions/_shared/statements.js`); a change to it is a model change and should be benchmarked before release.
- **Formulas.** Each workbook formula has a twin in code; a change to one without the other fails the recalculation check.
- **Releases.** CI runs lint, formatting, unit tests and the build on every change. A model or prompt change should also have a benchmark report attached.

## 8. Known limitations

- Notes are not read automatically beyond what an analyst maps (debt maturity schedules, segment notes). Leases, minority interests, share-based pay and exceptional items are read when printed on the face of the statements.
- Interim reports and LTM figures are not supported.
- Regulatory capital, credit quality and insurance solvency measures are not extracted for banks and insurers.
- Yahoo Finance is free but unofficial; client deliverables need a licensed market data feed.
- OCR can misread digits; scanned pages are always flagged.

## 9. Data handling

With a local model (the default) no filing text leaves the machine or the firm's network. With a hosted model only statement row labels and the business and risk text are sent. Saved runs stay on the engine machine, or in the firm's Supabase project under row-level security, deal walls and private storage.
