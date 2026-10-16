// Free market data for the engine. Every figure is read from a public source by code and returned with that
// source and its date; nothing here comes from a language model.
//
//   SEC EDGAR (data.sec.gov)  US filers' XBRL financials and shares outstanding. Free; SEC asks for a
//                             User-Agent naming you and an email (VULT_SEC_USER_AGENT).
//   Yahoo Finance chart API   Prices and weekly history for beta. Free but unofficial: fine for a desk
//                             tool, replace with a licensed feed for client work.
//   Bank of England IADB      10-year nominal gilt yield (zero coupon, series IUDMNZC).
//   CBOE ^TNX via Yahoo       US 10-year Treasury yield.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = process.env.VULT_CACHE_DIR || path.join(ROOT, '.vult', 'cache');
const DAY = 24 * 60 * 60 * 1000;

export class MarketError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const secAgent = () =>
  process.env.VULT_SEC_USER_AGENT || 'Vult research desk (set VULT_SEC_USER_AGENT to your name and email)';

async function getJson(url, { headers = {}, ttl = DAY, key } = {}) {
  const cacheFile = key ? path.join(CACHE, `${key.replace(/[^a-z0-9_.-]/gi, '_')}.json`) : null;
  if (cacheFile && fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < ttl)
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new MarketError(502, `Could not reach ${new URL(url).hostname}: ${error.message}`);
  }
  if (response.status === 404) throw new MarketError(404, 'Not found at the data source');
  if (!response.ok) throw new MarketError(502, `${new URL(url).hostname} answered ${response.status}`);
  const data = await response.json();
  if (cacheFile) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  }
  return data;
}

/** Drops a cached text answer that turned out not to be data. */
const forget = key => fs.rmSync(path.join(CACHE, `${key}.txt`), { force: true });

async function getText(url, { ttl = DAY / 4, key } = {}) {
  const cacheFile = key ? path.join(CACHE, `${key}.txt`) : null;
  if (cacheFile && fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < ttl)
    return fs.readFileSync(cacheFile, 'utf8');
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw new MarketError(502, `Could not reach ${new URL(url).hostname}: ${error.message}`);
  }
  if (!response.ok) throw new MarketError(502, `${new URL(url).hostname} answered ${response.status}`);
  const text = await response.text();
  if (cacheFile) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cacheFile, text);
  }
  return text;
}

/* ------------------------------------------------------------------ SEC EDGAR */
const TICKER = /^[A-Z0-9.\-^=]{1,15}$/;
const cleanTicker = value => {
  const ticker = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!TICKER.test(ticker)) throw new MarketError(400, 'Give a ticker such as AAPL or VOD.L');
  return ticker;
};

/** SEC-registered companies whose ticker or name matches `query`, best first: exact ticker, then name prefix. */
export async function searchCompanies(rawQuery, limit = 8) {
  const query = String(rawQuery ?? '')
    .trim()
    .toLowerCase();
  if (query.length < 1) return { results: [] };
  const all = await getJson('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'user-agent': secAgent() },
    key: 'sec-company-tickers'
  });
  const words = query.split(/\s+/);
  const scored = [];
  for (const entry of Object.values(all)) {
    const ticker = entry.ticker.toLowerCase();
    const name = entry.title.toLowerCase();
    const score =
      ticker === query
        ? 0
        : name.startsWith(query)
          ? 1
          : ticker.startsWith(query)
            ? 2
            : words.every(word => name.includes(word))
              ? 3
              : -1;
    if (score >= 0) scored.push({ score, ticker: entry.ticker, name: entry.title, cik: entry.cik_str });
  }
  // SEC lists the largest filers first, so the order within a score keeps big companies on top.
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set();
  const results = [];
  for (const item of scored) {
    if (seen.has(item.cik)) continue; // one row per company, not per share class
    seen.add(item.cik);
    results.push({ ticker: item.ticker, name: item.name });
    if (results.length >= limit) break;
  }
  return { results };
}

export async function secCompany(ticker) {
  const all = await getJson('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'user-agent': secAgent() },
    key: 'sec-company-tickers'
  });
  const symbol = ticker.replace(/\.US$/, '');
  const found = Object.values(all).find(entry => entry.ticker === symbol);
  if (!found) throw new MarketError(404, `${ticker} is not an SEC-registered ticker`);
  return { cik: found.cik_str, name: found.title, ticker: symbol };
}

// US GAAP tags for each Vult line item, in order of preference.
const SEC_TAGS = {
  'income:revenue': [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet'
  ],
  'income:cost_of_revenue': ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'],
  'income:gross_profit': ['GrossProfit'],
  'income:operating_income': ['OperatingIncomeLoss'],
  'income:pretax_income': [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'
  ],
  'income:income_tax': ['IncomeTaxExpenseBenefit'],
  'income:net_income': ['NetIncomeLoss'],
  'income:eps_diluted': ['EarningsPerShareDiluted'],
  'income:shares_diluted': ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  'balance:cash_and_equivalents': ['CashAndCashEquivalentsAtCarryingValue'],
  'balance:current_assets': ['AssetsCurrent'],
  'balance:total_assets': ['Assets'],
  'balance:current_liabilities': ['LiabilitiesCurrent'],
  'balance:total_liabilities': ['Liabilities'],
  'balance:total_equity': [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'StockholdersEquity'
  ],
  'balance:total_liabilities_and_equity': ['LiabilitiesAndStockholdersEquity'],
  'cashflow:depreciation_amortization': [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'Depreciation'
  ],
  'cashflow:operating_cash_flow': ['NetCashProvidedByUsedInOperatingActivities'],
  'cashflow:capital_expenditure': ['PaymentsToAcquirePropertyPlantAndEquipment'],
  'cashflow:investing_cash_flow': ['NetCashProvidedByUsedInInvestingActivities'],
  'cashflow:financing_cash_flow': ['NetCashProvidedByUsedInFinancingActivities'],
  'cashflow:dividends_paid': ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'],
  'cashflow:share_repurchases': ['PaymentsForRepurchaseOfCommonStock']
};
const DEBT_TAGS = ['LongTermDebtNoncurrent', 'LongTermDebtCurrent', 'ShortTermBorrowings', 'CommercialPaper'];

const days = (start, end) => (new Date(end) - new Date(start)) / DAY;

/** Annual values from a 10-K for one tag: { [fiscal year]: { value, end, accn } }. */
function annualValues(facts, tag) {
  const units = facts?.facts?.['us-gaap']?.[tag]?.units;
  if (!units) return null;
  const list = units.USD ?? units['USD/shares'] ?? units.shares ?? Object.values(units)[0];
  const byYear = {};
  for (const entry of list) {
    if (!/^10-K/.test(entry.form ?? '')) continue;
    // Flows cover about a year; instants (balance sheet) have no start date.
    if (entry.start && (days(entry.start, entry.end) < 350 || days(entry.start, entry.end) > 380)) continue;
    const year = entry.end.slice(0, 4);
    const current = byYear[year];
    // The latest filing wins, so restated figures replace the originals.
    if (!current || entry.filed > current.filed)
      byYear[year] = { value: entry.val, end: entry.end, filed: entry.filed, accn: entry.accn };
  }
  return Object.keys(byYear).length ? byYear : null;
}

/** A US filer's annual XBRL figures by Vult line item, in units (not millions). */
export async function secFundamentals(rawTicker) {
  const ticker = cleanTicker(rawTicker);
  const company = await secCompany(ticker);
  const cik = String(company.cik).padStart(10, '0');
  const facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { 'user-agent': secAgent() },
    key: `sec-facts-${cik}`
  });
  const annual = {};
  const tags = {};
  // Companies change tags over the years (Revenues, then RevenueFromContractWithCustomer...), so each year
  // takes the first tag in order of preference that has it.
  for (const [key, candidates] of Object.entries(SEC_TAGS)) {
    for (const tag of candidates) {
      for (const [year, v] of Object.entries(annualValues(facts, tag) ?? {})) {
        annual[key] ??= {};
        tags[key] ??= {};
        if (annual[key][year] === undefined) {
          annual[key][year] = v.value;
          tags[key][year] = tag;
        }
      }
    }
  }
  const debt = {};
  for (const tag of DEBT_TAGS) {
    const values = annualValues(facts, tag);
    for (const [year, v] of Object.entries(values ?? {})) debt[year] = (debt[year] ?? 0) + v.value;
  }
  // Shares outstanding: the cover page count, else the balance sheet count, else diluted weighted average
  // (companies with several share classes tag the cover count by class, which company facts leave out).
  const latestOf = list => [...(list ?? [])].sort((a, b) => String(a.end).localeCompare(String(b.end))).at(-1);
  const cover = latestOf(facts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares);
  const balance = latestOf(facts?.facts?.['us-gaap']?.CommonStockSharesOutstanding?.units?.shares);
  const dilutedYear = Object.keys(annual['income:shares_diluted'] ?? {})
    .sort()
    .at(-1);
  const latestShares = cover
    ? { ...cover, basis: 'Cover page shares outstanding' }
    : balance
      ? { ...balance, basis: 'Balance sheet shares outstanding' }
      : dilutedYear
        ? {
            val: annual['income:shares_diluted'][dilutedYear],
            end: `${dilutedYear}`,
            basis: 'Diluted weighted-average shares'
          }
        : null;
  return {
    source: 'SEC EDGAR XBRL company facts',
    url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    cik,
    name: facts.entityName ?? company.name,
    ticker: company.ticker,
    currency: 'USD',
    annual,
    tags,
    debt,
    sharesOutstanding: latestShares
      ? { value: latestShares.val, asOf: latestShares.end, basis: latestShares.basis }
      : null
  };
}

/* ------------------------------------------------------------------ prices and beta (Yahoo chart API) */
async function chart(symbol, range = '2y', interval = '1wk') {
  const data = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    { headers: { 'user-agent': 'Mozilla/5.0' }, ttl: DAY / 8, key: `yahoo-${symbol}-${range}-${interval}` }
  );
  const result = data?.chart?.result?.[0];
  if (!result) throw new MarketError(404, `No price data for ${symbol}`);
  return result;
}

// London prices are quoted in pence (GBp); report pounds so they match the statements.
const toMajor = (value, currency) =>
  currency === 'GBp' || currency === 'GBX' ? { value: value / 100, currency: 'GBP' } : { value, currency };

export async function quote(rawSymbol) {
  const symbol = cleanTicker(rawSymbol);
  const result = await chart(symbol, '5d', '1d');
  const meta = result.meta;
  const { value, currency } = toMajor(meta.regularMarketPrice, meta.currency);
  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    price: value,
    currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    asOf: new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    source: 'Yahoo Finance chart API (unofficial)'
  };
}

const INDEX_FOR = symbol =>
  /\.L$/.test(symbol) ? '^FTAS' : /\.(PA|DE|AS|MI|MC|BR|SW)$/.test(symbol) ? '^STOXX' : '^GSPC';
const INDEX_NAME = { '^FTAS': 'FTSE All-Share', '^STOXX': 'STOXX Europe 600', '^GSPC': 'S&P 500' };

/** Weekly returns aligned by date. */
function weeklyReturns(result) {
  const times = result.timestamp ?? [];
  const closes = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
  const out = new Map();
  for (let i = 1; i < times.length; i += 1) {
    if (Number.isFinite(closes[i]) && Number.isFinite(closes[i - 1]) && closes[i - 1] > 0)
      out.set(new Date(times[i] * 1000).toISOString().slice(0, 10), closes[i] / closes[i - 1] - 1);
  }
  return out;
}

/** Raw and Blume-adjusted beta from two years of weekly returns against the home index. */
export async function beta(rawSymbol, rawIndex) {
  const symbol = cleanTicker(rawSymbol);
  const index = rawIndex ? cleanTicker(rawIndex) : INDEX_FOR(symbol);
  const [stock, market] = await Promise.all([chart(symbol), chart(index)]);
  const s = weeklyReturns(stock);
  const m = weeklyReturns(market);
  const pairs = [...s.entries()].filter(([date]) => m.has(date)).map(([date, r]) => [r, m.get(date)]);
  if (pairs.length < 52) throw new MarketError(422, `Only ${pairs.length} matching weeks of prices; need at least 52`);
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  const xs = pairs.map(p => p[1]);
  const ys = pairs.map(p => p[0]);
  const mx = mean(xs);
  const my = mean(ys);
  const cov = pairs.reduce((sum, [y, x]) => sum + (x - mx) * (y - my), 0) / (pairs.length - 1);
  const variance = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0) / (xs.length - 1);
  const raw = cov / variance;
  return {
    symbol,
    index,
    indexName: INDEX_NAME[index] ?? index,
    weeks: pairs.length,
    raw,
    adjusted: 0.67 * raw + 0.33,
    method: 'Two years of weekly returns against the home index; adjusted = 0.67 x raw + 0.33 (Blume)',
    source: 'Yahoo Finance chart API (unofficial)'
  };
}

/* ------------------------------------------------------------------ risk-free rates */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "14 Oct 2026" as 2026-10-14. */
const isoFromDayMonthYear = text => {
  const [day, month, year] = String(text).trim().split(/\s+/);
  const m = MONTHS.indexOf(String(month).slice(0, 3).toLowerCase()) + 1;
  return m ? `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}` : String(text);
};

export async function riskFree(rawCountry) {
  const country = String(rawCountry ?? 'US').toUpperCase();
  if (country === 'UK' || country === 'GB') {
    const from = new Date(Date.now() - 30 * DAY);
    // The IADB wants three-letter months ("Sep"); en-GB formatting would give "Sept".
    const fmt = d => {
      const month = MONTHS[d.getUTCMonth()];
      return `${String(d.getUTCDate()).padStart(2, '0')}/${month[0].toUpperCase()}${month.slice(1)}/${d.getUTCFullYear()}`;
    };
    const csv = await getText(
      `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=${fmt(from)}&Dateto=now&SeriesCodes=IUDMNZC&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`,
      { key: 'boe-IUDMNZC' }
    );
    const rows = csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map(line => line.split(','))
      .filter(([, v]) => Number.isFinite(Number(v)));
    const last = rows.at(-1);
    if (!last) {
      forget('boe-IUDMNZC');
      throw new MarketError(502, 'The Bank of England returned no yields');
    }
    return {
      country: 'UK',
      rate: Number(last[1]) / 100,
      asOf: isoFromDayMonthYear(last[0]),
      series: '10-year nominal zero-coupon gilt yield (IUDMNZC)',
      source: 'Bank of England statistical database'
    };
  }
  const result = await chart('^TNX', '5d', '1d');
  const meta = result.meta;
  return {
    country: 'US',
    rate: meta.regularMarketPrice / 100,
    asOf: new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    series: 'US 10-year Treasury yield (CBOE ^TNX)',
    source: 'Yahoo Finance chart API (unofficial)'
  };
}

/* ------------------------------------------------------------------ ESEF filings (UK and EU listed companies) */
// filings.xbrl.org collects the iXBRL annual reports that UK and EU listed companies must file (ESEF) and
// publishes them as xBRL-JSON. Free, no key.
const ESEF = 'https://filings.xbrl.org';
const IFRS_TAGS = {
  'income:revenue': ['ifrs-full:Revenue', 'ifrs-full:RevenueFromContractsWithCustomers'],
  'income:cost_of_revenue': ['ifrs-full:CostOfSales'],
  'income:gross_profit': ['ifrs-full:GrossProfit'],
  'income:operating_income': ['ifrs-full:ProfitLossFromOperatingActivities'],
  'income:pretax_income': ['ifrs-full:ProfitLossBeforeTax'],
  'income:income_tax': ['ifrs-full:IncomeTaxExpenseContinuingOperations'],
  'income:net_income': ['ifrs-full:ProfitLossAttributableToOwnersOfParent', 'ifrs-full:ProfitLoss'],
  'income:eps_diluted': ['ifrs-full:DilutedEarningsLossPerShare'],
  'income:shares_diluted': ['ifrs-full:AdjustedWeightedAverageShares'],
  'balance:cash_and_equivalents': ['ifrs-full:CashAndCashEquivalents'],
  'balance:current_assets': ['ifrs-full:CurrentAssets'],
  'balance:noncurrent_assets': ['ifrs-full:NoncurrentAssets'],
  'balance:total_assets': ['ifrs-full:Assets'],
  'balance:current_liabilities': ['ifrs-full:CurrentLiabilities'],
  'balance:noncurrent_liabilities': ['ifrs-full:NoncurrentLiabilities'],
  'balance:total_liabilities': ['ifrs-full:Liabilities'],
  'balance:total_equity': ['ifrs-full:Equity'],
  'cashflow:depreciation_amortization': [
    'ifrs-full:DepreciationAndAmortisationExpense',
    'ifrs-full:AdjustmentsForDepreciationAndAmortisationExpense'
  ],
  'cashflow:operating_cash_flow': ['ifrs-full:CashFlowsFromUsedInOperatingActivities'],
  'cashflow:capital_expenditure': ['ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  'cashflow:investing_cash_flow': ['ifrs-full:CashFlowsFromUsedInInvestingActivities'],
  'cashflow:financing_cash_flow': ['ifrs-full:CashFlowsFromUsedInFinancingActivities']
};
// Borrowings, current and non-current: the first tag a filer uses in each group.
const IFRS_DEBT = [
  [
    'ifrs-full:CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings',
    'ifrs-full:CurrentBorrowings',
    'ifrs-full:ShorttermBorrowings'
  ],
  [
    'ifrs-full:NoncurrentPortionOfNoncurrentBorrowings',
    'ifrs-full:NoncurrentBorrowings',
    'ifrs-full:LongtermBorrowings'
  ]
];
const LEI = /^[A-Z0-9]{18}[0-9]{2}$/;

async function esefEntity(nameOrLei) {
  const query = String(nameOrLei ?? '').trim();
  if (!query) throw new MarketError(400, 'Give a company name or LEI');
  if (LEI.test(query)) return { lei: query, name: query };
  const words = query.replace(/\b(plc|public limited company|limited|ltd|group|holdings?|the)\b/gi, ' ').trim();
  for (const term of [query, words, words.split(/\s+/)[0]].filter(Boolean)) {
    const filter = encodeURIComponent(JSON.stringify([{ name: 'name', op: 'ilike', val: `%${term}%` }]));
    const found = await getJson(`${ESEF}/api/entities?filter=${filter}&page%5Bsize%5D=10`, {
      key: `esef-entity-${term}`,
      ttl: 7 * DAY
    });
    const list = found?.data ?? [];
    if (list.length) {
      // The shortest matching name is usually the listed parent rather than a subsidiary.
      const best = [...list].sort((a, b) => a.attributes.name.length - b.attributes.name.length)[0];
      return { lei: best.attributes.identifier, name: best.attributes.name };
    }
  }
  throw new MarketError(404, `No ESEF filer matches "${query}"`);
}

// xBRL-JSON periods are exclusive at midnight: "2026-04-01T00:00:00" is the end of 31 March 2026.
const periodEnd = text => new Date(new Date(text).getTime() - DAY).toISOString().slice(0, 10);

/** A UK or EU listed company's annual IFRS figures from its latest ESEF filing, in units. */
export async function esefFundamentals(nameOrLei) {
  const entity = await esefEntity(nameOrLei);
  const filings = await getJson(`${ESEF}/api/entities/${entity.lei}/filings?sort=-period_end&page%5Bsize%5D=1`, {
    key: `esef-filings-${entity.lei}`,
    ttl: DAY
  });
  const filing = filings?.data?.[0]?.attributes;
  if (!filing?.json_url) throw new MarketError(404, `No ESEF filing with data for ${entity.name}`);
  const doc = await getJson(`${ESEF}${filing.json_url}`, {
    key: `esef-json-${entity.lei}-${filing.period_end}`,
    ttl: 30 * DAY
  });
  // Facts without dimensions are the consolidated totals.
  const plain = Object.values(doc?.facts ?? {}).filter(f => Object.keys(f.dimensions ?? {}).length <= 4);
  const valuesOf = concept => {
    const byYear = {};
    for (const f of plain) {
      if (f.dimensions.concept !== concept) continue;
      const [from, to] = String(f.dimensions.period).split('/');
      if (to && (days(from, to) < 350 || days(from, to) > 380)) continue;
      const year = periodEnd(to ?? from).slice(0, 4);
      const value = Number(f.value);
      if (Number.isFinite(value) && byYear[year] === undefined) byYear[year] = value;
    }
    return byYear;
  };
  const annual = {};
  const tags = {};
  for (const [key, concepts] of Object.entries(IFRS_TAGS))
    for (const concept of concepts)
      for (const [year, value] of Object.entries(valuesOf(concept))) {
        annual[key] ??= {};
        tags[key] ??= {};
        if (annual[key][year] === undefined) {
          annual[key][year] = value;
          tags[key][year] = concept;
        }
      }
  const debt = {};
  for (const group of IFRS_DEBT) {
    const taken = {};
    for (const concept of group)
      for (const [year, value] of Object.entries(valuesOf(concept))) if (taken[year] === undefined) taken[year] = value;
    for (const [year, value] of Object.entries(taken)) debt[year] = (debt[year] ?? 0) + Math.abs(value);
  }
  const unit =
    plain.find(f => f.dimensions.concept === 'ifrs-full:Revenue')?.dimensions.unit ??
    plain.find(f => /^iso4217:[A-Z]{3}$/.test(f.dimensions.unit ?? ''))?.dimensions.unit;
  // Shares: diluted weighted average if tagged, else shares in issue, else net income / diluted EPS.
  const latest = values =>
    Object.keys(values ?? {})
      .sort()
      .at(-1);
  const issued = valuesOf('ifrs-full:NumberOfSharesIssued');
  const ni = annual['income:net_income'] ?? {};
  const eps = annual['income:eps_diluted'] ?? {};
  const epsYear = Object.keys(eps)
    .filter(year => Number.isFinite(ni[year]) && eps[year])
    .sort()
    .at(-1);
  const sharesOutstanding = latest(annual['income:shares_diluted'])
    ? {
        value: annual['income:shares_diluted'][latest(annual['income:shares_diluted'])],
        asOf: latest(annual['income:shares_diluted']),
        basis: 'Diluted weighted-average shares'
      }
    : latest(issued)
      ? { value: issued[latest(issued)], asOf: latest(issued), basis: 'Shares in issue' }
      : epsYear
        ? { value: Math.abs(ni[epsYear] / eps[epsYear]), asOf: epsYear, basis: 'Net income / diluted EPS' }
        : null;
  return {
    source: 'ESEF annual report via filings.xbrl.org',
    url: `${ESEF}${filing.report_url ?? filing.json_url}`,
    lei: entity.lei,
    name: entity.name,
    periodEnd: filing.period_end,
    currency: String(unit ?? 'iso4217:GBP').replace('iso4217:', ''),
    annual,
    tags,
    debt,
    sharesOutstanding
  };
}

/** SEC data for a US ticker; ESEF data (found by the company's name) for a London or European one. */
export async function fundamentals(rawTicker, name) {
  const ticker = cleanTicker(rawTicker);
  if (!/\.[A-Z]{1,3}$/.test(ticker) || /\.US$/.test(ticker)) return secFundamentals(ticker);
  const company = name || (await quote(ticker)).name;
  return esefFundamentals(company);
}

/** How many units of `to` one unit of `from` buys, from Yahoo's FX quotes. */
export async function fx(from, to) {
  const a = String(from ?? '').toUpperCase();
  const b = String(to ?? '').toUpperCase();
  if (!a || !b || a === b) return { rate: 1, asOf: new Date().toISOString().slice(0, 10), source: 'same currency' };
  const result = await chart(`${a}${b}=X`, '5d', '1d');
  return {
    rate: result.meta.regularMarketPrice,
    asOf: new Date((result.meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    source: 'Yahoo Finance chart API (unofficial)'
  };
}

/* ------------------------------------------------------------------ a peer for the comps table */
const latestYear = values =>
  Object.keys(values ?? {})
    .sort()
    .at(-1);

/**
 * A peer for the comps table: market cap from price x shares, the rest from its latest annual filing.
 * Values are in units of the peer's reporting currency; the market cap is converted into it when the shares
 * trade in another currency.
 */
export async function peer(rawTicker) {
  const ticker = cleanTicker(rawTicker);
  const price = await quote(ticker);
  const f = await fundamentals(ticker, price.name);
  const a = f.annual;
  const year = latestYear(a['income:revenue']) ?? latestYear(a['income:net_income']);
  const v = key => a[key]?.[year] ?? null;
  const ebit = v('income:operating_income');
  const da = v('cashflow:depreciation_amortization');
  const debt = f.debt[year] ?? 0;
  const cash = v('balance:cash_and_equivalents') ?? 0;
  const shares = f.sharesOutstanding?.value;
  const conversion = await fx(price.currency, f.currency);
  return {
    name: f.name,
    ticker,
    currency: f.currency,
    fiscalYear: year,
    price: price.price,
    priceCurrency: price.currency,
    priceAsOf: price.asOf,
    sharesOutstanding: shares ?? null,
    sharesBasis: f.sharesOutstanding?.basis ?? null,
    marketCap: shares ? price.price * shares * conversion.rate : null,
    netDebt: debt - cash,
    revenue: v('income:revenue'),
    ebitda: Number.isFinite(ebit) && Number.isFinite(da) ? ebit + da : null,
    netIncome: v('income:net_income'),
    sources:
      `${f.source} (FY${year}); price ${price.source}, ${price.asOf}` +
      (conversion.rate !== 1 ? `; ${price.currency} to ${f.currency} at ${conversion.rate.toFixed(4)}` : '') +
      (f.sharesOutstanding?.basis ? `; shares: ${f.sharesOutstanding.basis.toLowerCase()}` : '')
  };
}
