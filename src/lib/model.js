/**
 * The deterministic three-statement forecast and DCF behind the generated workbook.
 *
 * Every formula written into the .xlsx has a twin here, so the app can show the same numbers and the
 * engine can confirm, by recalculating the workbook in LibreOffice, that the two agree.
 * Values are in the filing's reported unit (for example USD millions).
 */

export const FORECAST_YEARS = 5;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const ratio = (top, bottom) => (Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? top / bottom : null);

/** Balance sheet lines that are liabilities; UK filings print them in brackets. */
export const LIABILITY_KEYS = new Set([
  'debt_current',
  'debt_noncurrent',
  'lease_liabilities',
  'current_liabilities',
  'noncurrent_liabilities',
  'total_liabilities'
]);

/** Indexes facts as get(statement, key, period); multi-row keys (debt lines) are summed. */
export function factIndex(facts) {
  // Liabilities are used at their size, however the filing signs them (UK balance sheets bracket them).
  const sized = (statement, key, value) =>
    statement === 'balance' && LIABILITY_KEYS.has(key) && Number.isFinite(value) ? Math.abs(value) : value;
  const map = new Map();
  for (const fact of facts ?? []) {
    const id = `${fact.statement}:${fact.key}:${fact.period}`;
    const list = map.get(id) ?? [];
    list.push(fact);
    map.set(id, list);
  }
  return {
    has: (statement, key, period) => map.has(`${statement}:${key}:${period}`),
    facts: (statement, key, period) => map.get(`${statement}:${key}:${period}`) ?? [],
    get(statement, key, period) {
      const list = map.get(`${statement}:${key}:${period}`);
      if (!list) return null;
      // Distinct rows (parts) are summed; the same row seen twice is counted once.
      const parts = new Map(list.map(fact => [fact.part ?? 0, sized(statement, key, fact.value)]));
      return [...parts.values()].reduce((sum, value) => sum + value, 0);
    }
  };
}

/**
 * Chooses the scale of the share count, and whether EPS is printed in pence or cents, by matching
 * net income / shares to reported diluted EPS. Returns { scale, epsFactor } or null.
 */
export function reconcileShares({ netIncome, shares, eps, unitScale }) {
  if (![netIncome, shares, eps, unitScale].every(Number.isFinite) || !shares || !eps) return null;
  const options = [1, 1e3, 1e6, 1e9]
    .flatMap(scale => [1, 0.01].map(epsFactor => ({ scale, epsFactor })))
    .map(o => ({ ...o, error: Math.abs((netIncome * unitScale) / (shares * o.scale) / (eps * o.epsFactor) - 1) }))
    .sort((a, b) => a.error - b.error);
  return options[0].error < 0.03 ? { scale: options[0].scale, epsFactor: options[0].epsFactor } : null;
}

/** The share count scale alone (see reconcileShares). */
export const shareScale = input => reconcileShares(input)?.scale ?? null;

/** Reported figures in model form for each historical period. */
function historicals(index, periods) {
  const g = (statement, key, period) => index.get(statement, key, period);
  return periods.map(period => {
    const revenue = g('income', 'revenue', period);
    const cogsRaw = g('income', 'cost_of_revenue', period);
    const opexRaw = g('income', 'operating_expenses', period);
    const ebitReported = g('income', 'operating_income', period);
    const exceptional = g('income', 'exceptional_items', period);
    // Some statements (Pfizer's) print no operating income: revenue less every operating cost line gives it.
    const ebitDerived = !Number.isFinite(ebitReported) && Number.isFinite(revenue) && Number.isFinite(opexRaw);
    const ebit = ebitDerived
      ? revenue - Math.abs(cogsRaw ?? 0) - Math.abs(opexRaw) - Math.abs(exceptional ?? 0)
      : ebitReported;
    const pretax = g('income', 'pretax_income', period);
    const netIncome = g('income', 'net_income', period);
    let tax = g('income', 'income_tax', period);
    // Some statements print tax in brackets as a deduction; use the sign that reconciles to net income.
    if (
      [pretax, tax, netIncome].every(Number.isFinite) &&
      Math.abs(pretax + tax - netIncome) < Math.abs(pretax - tax - netIncome)
    )
      tax = -tax;
    const da = g('cashflow', 'depreciation_amortization', period);
    const capex = g('cashflow', 'capital_expenditure', period);
    const dividends = g('cashflow', 'dividends_paid', period);
    const repurchases = g('cashflow', 'share_repurchases', period);

    const cash = g('balance', 'cash_and_equivalents', period);
    const sti = g('balance', 'short_term_investments', period) ?? 0;
    const tca = g('balance', 'current_assets', period);
    const ppe = g('balance', 'ppe_net', period) ?? 0;
    const nca = g('balance', 'noncurrent_assets', period);
    const taReported = g('balance', 'total_assets', period);
    // UK balance sheets may print non-current and current totals without a total assets line.
    const ta = taReported ?? (Number.isFinite(tca) && Number.isFinite(nca) ? tca + nca : null);
    const debtCurrent = g('balance', 'debt_current', period) ?? 0;
    const tcl = g('balance', 'current_liabilities', period);
    const debtNoncurrent = g('balance', 'debt_noncurrent', period) ?? 0;
    const ncl = g('balance', 'noncurrent_liabilities', period);
    const equity = g('balance', 'total_equity', period);
    const tle = g('balance', 'total_liabilities_and_equity', period);
    const tlReported = g('balance', 'total_liabilities', period);
    // Redeemable interests printed between liabilities and equity count with liabilities, so the model balances.
    const mezzanine =
      [tlReported, tle, equity].every(Number.isFinite) && tle - tlReported - equity > Math.max(1, Math.abs(tle) * 1e-4);
    const tlSource = mezzanine
      ? 'tle'
      : Number.isFinite(tlReported)
        ? 'reported'
        : Number.isFinite(tle) && Number.isFinite(equity)
          ? 'tle'
          : Number.isFinite(tcl) && Number.isFinite(ncl)
            ? 'parts'
            : Number.isFinite(ta) && Number.isFinite(equity)
              ? 'assets'
              : null;
    // With no total printed (common in US filings), the balance sheet identity gives it: assets less equity.
    const tl =
      tlSource === 'reported'
        ? tlReported
        : tlSource === 'tle'
          ? tle - equity
          : tlSource === 'parts'
            ? tcl + ncl
            : tlSource === 'assets'
              ? ta - equity
              : null;
    const hasBalance = [cash, tca, ta, tcl, equity, tl].every(Number.isFinite);

    return {
      period,
      revenue,
      cogs: Number.isFinite(cogsRaw) ? Math.abs(cogsRaw) : null,
      grossProfit:
        g('income', 'gross_profit', period) ??
        (Number.isFinite(revenue) && Number.isFinite(cogsRaw) ? revenue - Math.abs(cogsRaw) : null),
      opex: Number.isFinite(opexRaw) ? Math.abs(opexRaw) : null,
      ebit,
      ebitDerived,
      da,
      ebitda: Number.isFinite(ebit) && Number.isFinite(da) ? ebit + da : null,
      otherIncome: Number.isFinite(pretax) && Number.isFinite(ebit) ? pretax - ebit : null,
      pretax,
      tax,
      netIncome,
      eps: g('income', 'eps_diluted', period),
      shares: g('income', 'shares_diluted', period),
      cfNetIncome: g('cashflow', 'net_income', period),
      cfo: g('cashflow', 'operating_cash_flow', period),
      capex: Number.isFinite(capex) ? -Math.abs(capex) : null,
      cfi: g('cashflow', 'investing_cash_flow', period),
      payout:
        (Number.isFinite(dividends) ? -Math.abs(dividends) : 0) +
        (Number.isFinite(repurchases) ? -Math.abs(repurchases) : 0),
      hasPayout: Number.isFinite(dividends) || Number.isFinite(repurchases),
      cff: g('cashflow', 'financing_cash_flow', period),
      fx: g('cashflow', 'fx_effect', period) ?? 0,
      cashChange: g('cashflow', 'cash_change', period),
      cashBeginning: g('cashflow', 'cash_beginning', period),
      cashEnding: g('cashflow', 'cash_ending', period),
      hasBalance,
      cashSti: hasBalance ? cash + sti : null,
      ncca: hasBalance ? tca - cash - sti : null,
      tca,
      ppe: hasBalance ? ppe : null,
      onca: hasBalance ? ta - tca - ppe : null,
      ta,
      debtCurrent: hasBalance ? debtCurrent : null,
      ndcl: hasBalance ? tcl - debtCurrent : null,
      tcl,
      debtNoncurrent: hasBalance ? debtNoncurrent : null,
      oncl: hasBalance ? tl - tcl - debtNoncurrent : null,
      tl,
      tlDerived: tlSource !== 'reported' && tl != null,
      tlSource,
      taDerived: taReported == null && ta != null,
      equity,
      tle: hasBalance ? tl + equity : null,
      tleReported: tle
    };
  });
}

/** Default assumptions, each with the basis shown next to it in the workbook. */
export function defaultAssumptions(hist, unitScale) {
  const base = hist.at(-1);
  const prior = hist.at(-2);
  const growth = ratio(base.revenue, prior?.revenue);
  const g1 = Number.isFinite(growth) ? clamp(growth - 1, -0.1, 0.2) : 0.03;
  const terminalGrowth = 0.025;
  const taxRates = hist.map(h => (h.pretax > 0 ? ratio(h.tax, h.pretax) : null)).filter(Number.isFinite);
  const taxRate = taxRates.length ? clamp(taxRates.reduce((a, b) => a + b, 0) / taxRates.length, 0, 0.4) : 0.25;
  const payout = base.hasPayout && base.netIncome > 0 ? clamp(-base.payout / base.netIncome, 0, 1) : 0;
  const reconciled = reconcileShares({ netIncome: base.netIncome, shares: base.shares, eps: base.eps, unitScale });
  const shares = reconciled?.scale ?? null;
  const ebitMargin = ratio(base.ebit, base.revenue) ?? 0.1;

  return {
    growth: Array.from({ length: FORECAST_YEARS }, (_, i) => g1 + ((terminalGrowth - g1) * i) / (FORECAST_YEARS - 1)),
    ebitMargin: Array(FORECAST_YEARS).fill(ebitMargin),
    daPct: Array(FORECAST_YEARS).fill(ratio(base.da, base.revenue) ?? 0.03),
    capexPct: Array(FORECAST_YEARS).fill(Math.abs(ratio(base.capex, base.revenue) ?? 0.03)),
    nccaPct: Array(FORECAST_YEARS).fill(ratio(base.ncca, base.revenue) ?? 0),
    ndclPct: Array(FORECAST_YEARS).fill(ratio(base.ndcl, base.revenue) ?? 0),
    payout: Array(FORECAST_YEARS).fill(payout),
    otherIncome: base.otherIncome ?? 0,
    taxRate,
    riskFree: 0.0425,
    erp: 0.05,
    beta: 1,
    costOfDebt: 0.0575,
    terminalGrowth,
    sharePrice: null,
    targetDebtWeight: 0.1,
    unitScale,
    shareScale: shares,
    epsFactor: reconciled?.epsFactor ?? 1,
    basis: {
      growth: Number.isFinite(growth)
        ? `Last reported growth (${((growth - 1) * 100).toFixed(1)}%), capped to -10%..20%, fading to terminal growth`
        : 'No prior year; 3% placeholder',
      ebitMargin: `Base-year operating margin`,
      daPct: 'Base-year D&A / revenue',
      capexPct: 'Base-year capex / revenue',
      nccaPct: 'Base-year non-cash current assets / revenue',
      ndclPct: 'Base-year non-debt current liabilities / revenue',
      payout: base.hasPayout
        ? 'Base-year dividends and buybacks / net income, capped at 100%'
        : 'Not reported; set to zero',
      otherIncome: 'Base-year pre-tax income less operating income, held flat',
      taxRate: taxRates.length ? `Average effective rate over ${taxRates.length} reported years` : 'Placeholder 25%',
      riskFree: 'Vult default; check against the current 10-year government yield',
      erp: 'Vult default; check against house view',
      beta: 'Vult default of 1.0; replace with an observed or peer beta',
      costOfDebt: 'Vult default; check against the company’s borrowing cost',
      terminalGrowth: 'Vult default',
      sharePrice: 'Not in the filing; enter the current price for market weights and upside',
      targetDebtWeight: 'Used only when no share price is entered',
      unitScale: 'Read from the statement headers',
      shareScale: shares
        ? `Chosen so net income / shares matches reported diluted EPS${reconciled.epsFactor === 0.01 ? ' (printed in pence or cents)' : ''}`
        : 'Could not be confirmed against EPS'
    }
  };
}

/** Runs the forecast and valuation. `overrides` replaces any default assumption. */
export function buildModel({ facts, unit, overrides = {} }) {
  const index = factIndex(facts);
  const incomePeriods = [...new Set(facts.filter(f => f.statement === 'income').map(f => f.period))].sort();
  const periods = incomePeriods.slice(-3);
  if (!periods.length) throw new Error('No income statement periods were extracted.');
  const hist = historicals(index, periods);
  const base = hist.at(-1);
  if (!base.hasBalance)
    throw new Error(`The balance sheet for ${base.period} is incomplete, so the model cannot be balanced.`);
  if (![base.revenue, base.ebit, base.netIncome].every(Number.isFinite))
    throw new Error(`Revenue, operating income and net income are needed for ${base.period}.`);

  const defaults = defaultAssumptions(hist, unit.scale);
  const a = {
    ...defaults,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined && v !== '')),
    // An override can say where it came from (for example a fetched share price and its date).
    basis: { ...defaults.basis, ...(overrides.basis ?? {}) }
  };
  const years = Array.from({ length: FORECAST_YEARS }, (_, i) => `${Number(base.period) + i + 1}`);

  // Forecast, year by year. Each line mirrors a workbook formula.
  const f = [];
  let prev = {
    revenue: base.revenue,
    cashSti: base.cashSti,
    ncca: base.ncca,
    ppe: base.ppe,
    onca: base.onca,
    debtCurrent: base.debtCurrent,
    ndcl: base.ndcl,
    debtNoncurrent: base.debtNoncurrent,
    oncl: base.oncl,
    equity: base.equity
  };
  for (let t = 0; t < FORECAST_YEARS; t += 1) {
    const revenue = prev.revenue * (1 + a.growth[t]);
    const ebit = revenue * a.ebitMargin[t];
    const da = revenue * a.daPct[t];
    const ebitda = ebit + da;
    const otherIncome = a.otherIncome;
    const pretax = ebit + otherIncome;
    const tax = pretax * a.taxRate;
    const netIncome = pretax - tax;
    const ncca = revenue * a.nccaPct[t];
    const ndcl = revenue * a.ndclPct[t];
    const capex = -revenue * a.capexPct[t];
    const payout = -netIncome * a.payout[t];
    const dNcca = -(ncca - prev.ncca);
    const dNdcl = ndcl - prev.ndcl;
    const cfo = netIncome + da + dNcca + dNdcl;
    const cfi = capex;
    const cff = payout;
    const cashChange = cfo + cfi + cff;
    const cashSti = prev.cashSti + cashChange;
    const ppe = prev.ppe - capex - da;
    const onca = prev.onca;
    const tca = cashSti + ncca;
    const ta = tca + ppe + onca;
    const debtCurrent = prev.debtCurrent;
    const debtNoncurrent = prev.debtNoncurrent;
    const oncl = prev.oncl;
    const tcl = debtCurrent + ndcl;
    const tl = tcl + debtNoncurrent + oncl;
    const equity = prev.equity + netIncome + payout;
    const tle = tl + equity;
    const growth = a.growth[t];
    f.push({
      period: years[t],
      revenue,
      growth,
      ebit,
      ebitMargin: a.ebitMargin[t],
      da,
      ebitda,
      otherIncome,
      pretax,
      tax,
      netIncome,
      ncca,
      ndcl,
      capex,
      payout,
      dNcca,
      dNdcl,
      cfo,
      cfi,
      cff,
      cashChange,
      cashBeginning: prev.cashSti,
      cashEnding: cashSti,
      cashSti,
      ppe,
      onca,
      tca,
      ta,
      debtCurrent,
      debtNoncurrent,
      oncl,
      tcl,
      tl,
      equity,
      tle,
      balanceCheck: ta - tle
    });
    prev = { revenue, cashSti, ncca, ppe, onca, debtCurrent, ndcl, debtNoncurrent, oncl, equity };
  }

  // DCF with end-of-year discounting.
  const ufcf = f.map(y => y.ebit * (1 - a.taxRate) + y.da + y.capex + y.dNcca + y.dNdcl);
  const costOfEquity = a.riskFree + a.beta * a.erp;
  const afterTaxDebt = a.costOfDebt * (1 - a.taxRate);
  const debt = base.debtCurrent + base.debtNoncurrent;
  const marketCap =
    a.sharePrice > 0 && base.shares > 0 && a.shareScale
      ? (a.sharePrice * base.shares * a.shareScale) / a.unitScale
      : null;
  const equityWeight = marketCap ? marketCap / (marketCap + debt) : 1 - a.targetDebtWeight;
  const wacc = equityWeight * costOfEquity + (1 - equityWeight) * afterTaxDebt;
  const valueAt = (w, g) => {
    const pv = ufcf.reduce((sum, cash, t) => sum + cash / (1 + w) ** (t + 1), 0);
    const tv = (ufcf.at(-1) * (1 + g)) / (w - g);
    return { pv, tv, pvTv: tv / (1 + w) ** FORECAST_YEARS, ev: pv + tv / (1 + w) ** FORECAST_YEARS };
  };
  const core = valueAt(wacc, a.terminalGrowth);
  const equityValue = core.ev - debt + base.cashSti;
  const perShare = a.shareScale && base.shares > 0 ? (equityValue * a.unitScale) / (base.shares * a.shareScale) : null;
  const upside = perShare != null && a.sharePrice > 0 ? perShare / a.sharePrice - 1 : null;

  const waccSteps = [-0.01, -0.005, 0, 0.005, 0.01].map(step => wacc + step);
  const growthSteps = [-0.005, -0.0025, 0, 0.0025, 0.005].map(step => a.terminalGrowth + step);
  const sensitivity = growthSteps.map(g =>
    waccSteps.map(w => {
      if (w <= g) return null;
      const eq = valueAt(w, g).ev - debt + base.cashSti;
      return perShare != null ? (eq * a.unitScale) / (base.shares * a.shareScale) : eq;
    })
  );

  return {
    unit,
    periods,
    years,
    hist,
    base,
    forecast: f,
    assumptions: a,
    defaults,
    dcf: {
      ufcf,
      discountFactors: ufcf.map((_, t) => 1 / (1 + wacc) ** (t + 1)),
      pvUfcf: ufcf.map((cash, t) => cash / (1 + wacc) ** (t + 1)),
      costOfEquity,
      afterTaxDebt,
      marketCap,
      debt,
      equityWeight,
      wacc,
      sumPv: core.pv,
      terminalValue: core.tv,
      pvTerminal: core.pvTv,
      ev: core.ev,
      cash: base.cashSti,
      equityValue,
      perShare,
      upside,
      tvShare: core.pvTv / core.ev,
      sensitivity: { wacc: waccSteps, growth: growthSteps, values: sensitivity, perShare: perShare != null }
    }
  };
}
