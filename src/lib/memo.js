/**
 * Builds the investment memo and the one-page tear sheet as .docx files.
 *
 * Every reported figure carries a footnote to the PDF page and printed row it came from. Model outputs
 * cite the workbook tab that computes them. Narrative sections come from a language model, which is
 * told to use no figures; any sentence with a digit is removed before it gets here.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  FootnoteReferenceRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import { describeCorrection } from './corrections.js';

const SERIF = 'Georgia';
const INK = '14202B';
const MUTED = '6B7785';
const ACCENT = '1F6FEB';
const LINE = 'D9DEE5';

const SYMBOL = { USD: '$', GBP: '£', EUR: '€' };
const SUFFIX = { 1e9: 'bn', 1e6: 'm', 1e3: 'k', 1: '' };

export function money(value, unit, digits = 0) {
  if (!Number.isFinite(value)) return 'n/a';
  const text = new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(
    Math.abs(value)
  );
  const out = `${SYMBOL[unit.currency] ?? ''}${text}${SUFFIX[unit.scale] ?? ''}`;
  return value < 0 ? `(${out})` : out;
}
export const perShareText = (value, unit) =>
  Number.isFinite(value) ? `${SYMBOL[unit.currency] ?? ''}${value.toFixed(2)}` : 'n/a';
/** Reported EPS as printed: pence or cents when the filing prints it that way, otherwise in currency units. */
export const epsText = (eps, assumptions, unit) =>
  !Number.isFinite(eps)
    ? 'n/a'
    : assumptions?.epsFactor === 0.01
      ? `${eps.toFixed(1)}${unit.currency === 'GBP' ? 'p' : 'c'}`
      : perShareText(eps, unit);
export const pct = (value, digits = 1) => (Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : 'n/a');

/** Collects footnotes and hands out ids, one per distinct source. */
function footnoteBook(fileName) {
  const notes = {};
  const ids = new Map();
  let next = 1;
  const add = text => {
    if (ids.has(text)) return ids.get(text);
    const id = next++;
    ids.set(text, id);
    notes[id] = { children: [new Paragraph({ children: [new TextRun({ text, size: 16, font: SERIF })] })] };
    return id;
  };
  return {
    notes,
    fact: fact => add(`${fileName}, PDF page ${fact.page}: “${String(fact.quote).replace(/\s+/g, ' ').trim()}”`),
    text: add
  };
}

const run = (text, options = {}) => new TextRun({ text, font: SERIF, color: INK, size: 21, ...options });
const para = (children, options = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, children, ...options });
const heading = text =>
  new Paragraph({
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    children: [run(text, { bold: true, size: 26, color: ACCENT })]
  });
const bullet = children => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 290 }, children });

function cell(text, { bold = false, align = AlignmentType.RIGHT, shade, size = 18, color = INK, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: shade ? { type: ShadingType.CLEAR, color: 'auto', fill: shade } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold, size, color, font: SERIF })] })]
  });
}

function table(headerRow, rows, { firstWidth = 34, size = 18 } = {}) {
  const others = (100 - firstWidth) / (headerRow.length - 1);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerRow.map((text, i) =>
          cell(text, {
            bold: true,
            align: i ? AlignmentType.RIGHT : AlignmentType.LEFT,
            shade: 'EEF3FB',
            size,
            width: i ? others : firstWidth
          })
        )
      }),
      ...rows.map(
        values =>
          new TableRow({
            children: values.map((value, i) =>
              cell(String(value), {
                align: i ? AlignmentType.RIGHT : AlignmentType.LEFT,
                size,
                width: i ? others : firstWidth,
                bold: i === 0 && /^(Revenue|EBIT|Net income|Free cash flow)$/.test(value)
              })
            )
          })
      )
    ]
  });
}

/** Facts by statement, key and period, so prose can cite the exact rows it uses. */
function finder(facts) {
  return (statement, key, period) =>
    facts.filter(f => f.statement === statement && f.key === key && f.period === period);
}

function summaryBullets({ model, facts, notes, unit }) {
  const find = finder(facts);
  const cite = list => list.map(f => new FootnoteReferenceRun(notes.fact(f)));
  const b = model.base;
  const prior = model.hist.at(-2);
  const out = [];
  const growth = prior && Number.isFinite(prior.revenue) ? b.revenue / prior.revenue - 1 : null;
  out.push(
    bullet([
      run(`Revenue of ${money(b.revenue, unit)} in FY${b.period}`),
      ...cite(find('income', 'revenue', b.period)),
      run(growth === null ? '.' : `, ${growth >= 0 ? 'up' : 'down'} ${pct(Math.abs(growth))} on FY${prior.period}`),
      ...(growth === null ? [] : cite(find('income', 'revenue', prior.period))),
      ...(growth === null ? [] : [run('.')])
    ])
  );
  out.push(
    bullet([
      run(`Operating income of ${money(b.ebit, unit)}, a margin of ${pct(b.ebit / b.revenue)}`),
      ...cite(find('income', 'operating_income', b.period)),
      run(`; net income of ${money(b.netIncome, unit)}`),
      ...cite(find('income', 'net_income', b.period)),
      run('.')
    ])
  );
  if (Number.isFinite(b.cfo) && Number.isFinite(b.capex))
    out.push(
      bullet([
        run(`Operating cash flow of ${money(b.cfo, unit)}`),
        ...cite(find('cashflow', 'operating_cash_flow', b.period)),
        run(` and capital expenditure of ${money(Math.abs(b.capex), unit)}`),
        ...cite(find('cashflow', 'capital_expenditure', b.period)),
        run(`, leaving ${money(b.cfo + b.capex, unit)} of free cash flow.`)
      ])
    );
  const netDebt = b.debtCurrent + b.debtNoncurrent - b.cashSti;
  out.push(
    bullet([
      run(
        `${netDebt >= 0 ? 'Net debt' : 'Net cash'} of ${money(Math.abs(netDebt), unit)} at the FY${b.period} year end: debt of ${money(b.debtCurrent + b.debtNoncurrent, unit)}`
      ),
      ...cite([...find('balance', 'debt_current', b.period), ...find('balance', 'debt_noncurrent', b.period)]),
      run(` against cash and short-term investments of ${money(b.cashSti, unit)}`),
      ...cite([
        ...find('balance', 'cash_and_equivalents', b.period),
        ...find('balance', 'short_term_investments', b.period)
      ]),
      run('.')
    ])
  );
  const d = model.dcf;
  const values = d.sensitivity.values.flat().filter(Number.isFinite);
  if (d.perShare != null) {
    out.push(
      bullet([
        run(
          `Base-case DCF value of ${perShareText(d.perShare, unit)} per share, with a range of ${perShareText(Math.min(...values), unit)} to ${perShareText(Math.max(...values), unit)} across WACC and terminal growth sensitivities` +
            (d.upside != null
              ? `, ${d.upside >= 0 ? 'above' : 'below'} the ${perShareText(model.assumptions.sharePrice, unit)} share price by ${pct(Math.abs(d.upside))}.`
              : '. No share price was entered, so no upside is shown.')
        ),
        new FootnoteReferenceRun(
          notes.text(
            'Vult model, DCF tab. Assumptions are on the Inputs tab; risk-free rate, equity risk premium and beta are Vult defaults until replaced.'
          )
        )
      ])
    );
  } else {
    out.push(
      bullet([
        run(
          `Base-case DCF equity value of ${money(d.equityValue, unit)}. Per-share value is not shown because the share count could not be reconciled to reported EPS.`
        ),
        new FootnoteReferenceRun(notes.text('Vult model, DCF tab.'))
      ])
    );
  }
  return out;
}

function performanceTable(model, unit) {
  const cols = model.hist.map(h => `FY${h.period}`);
  const row = (name, fn) => [name, ...model.hist.map(h => fn(h))];
  return table(
    [`${unit.label}`, ...cols],
    [
      row('Revenue', h => money(h.revenue, unit)),
      row('Growth', (h, i = model.hist.indexOf(h)) =>
        i > 0 && Number.isFinite(model.hist[i - 1].revenue) ? pct(h.revenue / model.hist[i - 1].revenue - 1) : ''
      ),
      row('Gross profit', h => money(h.grossProfit, unit)),
      row('EBIT', h => money(h.ebit, unit)),
      row('EBIT margin', h => pct(h.ebit / h.revenue)),
      row('EBITDA', h => money(h.ebitda, unit)),
      row('Net income', h => money(h.netIncome, unit)),
      row('Operating cash flow', h => money(h.cfo, unit)),
      row('Capital expenditure', h => money(h.capex, unit)),
      row('Free cash flow', h =>
        Number.isFinite(h.cfo) && Number.isFinite(h.capex) ? money(h.cfo + h.capex, unit) : 'n/a'
      )
    ]
  );
}

function sensitivityTable(model, unit) {
  const s = model.dcf.sensitivity;
  const show = v => (v == null ? '' : s.perShare ? perShareText(v, unit) : money(v, unit));
  return table(
    ['Growth / WACC', ...s.wacc.map(w => pct(w))],
    s.growth.map((g, r) => [pct(g, 2), ...s.values[r].map(show)]),
    { firstWidth: 20 }
  );
}

/** Summary bullets for a bank or insurer, valued on justified price to book. */
function financialSummary({ model, facts, notes, unit }) {
  const find = finder(facts);
  const cite = list => list.map(f => new FootnoteReferenceRun(notes.fact(f)));
  const b = model.base;
  const v = model.valuation;
  return [
    bullet([
      run(`Total income of ${money(b.revenue, unit)} and net income of ${money(b.netIncome, unit)} in FY${b.period}`),
      ...cite([...find('income', 'revenue', b.period), ...find('income', 'net_income', b.period)]),
      run(Number.isFinite(b.roe) ? `, a return on equity of ${pct(b.roe)}.` : '.')
    ]),
    bullet([
      run(`Book equity of ${money(b.equity, unit)} against total assets of ${money(b.ta, unit)}`),
      ...cite([...find('balance', 'total_equity', b.period), ...find('balance', 'total_assets', b.period)]),
      run('.')
    ]),
    bullet([
      run(
        v.pb == null
          ? 'No justified price to book: the cost of equity does not exceed long-run growth.'
          : `Justified price to book of ${v.pb.toFixed(2)}x (ROE ${pct(model.assumptions.roe)}, cost of equity ${pct(v.costOfEquity)}, growth ${pct(model.assumptions.growth)}), an equity value of ${money(v.equityValue, unit)}` +
              (v.perShare != null ? ` or ${perShareText(v.perShare, unit)} per share` : '') +
              (v.upside != null
                ? `, ${v.upside >= 0 ? 'above' : 'below'} the ${perShareText(model.assumptions.sharePrice, unit)} share price by ${pct(Math.abs(v.upside))}.`
                : '.')
      ),
      new FootnoteReferenceRun(
        notes.text(
          'Vult workbook, Valuation and Inputs tabs. Risk-free rate, equity risk premium and beta are Vult defaults until replaced.'
        )
      )
    ])
  ];
}

function financialPerformanceTable(model, unit) {
  return table(
    [unit.label, ...model.hist.map(h => `FY${h.period}`)],
    [
      ['Total income', ...model.hist.map(h => money(h.revenue, unit))],
      ['Net income', ...model.hist.map(h => money(h.netIncome, unit))],
      ['Return on equity', ...model.hist.map(h => pct(h.roe))],
      ['Total equity', ...model.hist.map(h => money(h.equity, unit))],
      ['Total assets', ...model.hist.map(h => money(h.ta, unit))],
      ['Diluted EPS', ...model.hist.map(h => epsText(h.eps, model.assumptions, unit))]
    ]
  );
}

function financialSensitivityTable(model, unit) {
  const s = model.valuation.sensitivity;
  const show = v => (v == null ? '' : s.perShare ? perShareText(v, unit) : money(v, unit));
  return table(
    ['ROE / cost of equity', ...s.coe.map(c => pct(c))],
    s.roe.map((roe, r) => [pct(roe), ...s.values[r].map(show)]),
    { firstWidth: 20 }
  );
}

function pageRange(pages) {
  if (!pages?.length) return '';
  return pages.length === 1 ? `PDF page ${pages[0]}` : `PDF pages ${pages[0]} to ${pages.at(-1)}`;
}

function makeDoc(notes, children, title) {
  return new Document({
    creator: 'Vult',
    title,
    styles: { default: { document: { run: { font: SERIF, size: 21, color: INK } } } },
    footnotes: notes.notes,
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }]
  });
}

/** The investment memo. Returns an ArrayBuffer. */
export async function buildMemo({ company, fileName, meta = {}, model, facts, assay, narrative }) {
  const unit = model.unit;
  const notes = footnoteBook(fileName);
  const fin = model.kind === 'financial';
  const d = model.dcf;
  const a = model.assumptions;
  const flagged = assay.checks.filter(check => !check.passed);
  const children = [
    para([run(`${company}: investment memo`, { bold: true, size: 40 })], { spacing: { after: 60 } }),
    para([
      run(
        `Draft for analyst review. Prepared by Vult from ${fileName}${meta.yearEnd ? ` (fiscal year ended ${meta.yearEnd})` : ''}. Figures in ${unit.label} unless stated.`,
        { color: MUTED, size: 18 }
      )
    ]),
    para(
      [
        run('How this memo was made. ', { bold: true, size: 18 }),
        run(
          `Figures were read from the filing by code and each one footnotes the page and row it came from. The Assayer ran ${assay.total} deterministic checks: ${assay.passed} passed and ${assay.flagged} are flagged for review. ` +
            (narrative?.business
              ? `The business and risk sections were drafted by ${meta.llm ? `${meta.llm.label} ${meta.llm.model}` : 'a language model'} from the filing text and contain no figures. `
              : '') +
            'An analyst should review this memo before it is circulated.',
          { size: 18 }
        )
      ],
      {
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F6FA' },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } }
      }
    ),
    heading('Summary'),
    ...(fin ? financialSummary({ model, facts, notes, unit }) : summaryBullets({ model, facts, notes, unit }))
  ];

  if (narrative?.business) {
    children.push(heading('Business'));
    children.push(
      para([
        run(narrative.business),
        new FootnoteReferenceRun(
          notes.text(
            `${fileName}, ${narrative.businessSection || 'Item 1 (Business)'}, ${pageRange(narrative.businessPages)}. Drafted by a language model; figures removed.`
          )
        )
      ])
    );
  }

  children.push(heading('Financial performance'));
  children.push(
    para([
      run('Reported figures. Each line is sourced from the primary statements', { color: MUTED, size: 18 }),
      ...[...new Set(facts.filter(f => f.statement !== 'balance').map(f => f.page))].map(
        page => new FootnoteReferenceRun(notes.text(`${fileName}, PDF page ${page}: primary financial statement.`))
      ),
      run('.', { color: MUTED, size: 18 })
    ])
  );
  children.push(fin ? financialPerformanceTable(model, unit) : performanceTable(model, unit));

  children.push(heading('Valuation'));
  if (fin) {
    const v = model.valuation;
    children.push(
      para([
        run(
          `A corporate DCF does not apply to ${model.sector === 'insurer' ? 'an insurer' : 'a bank'}, so value is book equity times the justified price to book, (ROE - g) / (cost of equity - g). ` +
            `The cost of equity is ${pct(v.costOfEquity)}, sustainable ROE ${pct(a.roe)} and long-run growth ${pct(a.growth)}, giving ${v.pb != null ? `${v.pb.toFixed(2)}x book and an equity value of ${money(v.equityValue, unit)}` : 'no meaningful multiple'}` +
            (v.perShare != null ? `, or ${perShareText(v.perShare, unit)} per share.` : '.')
        ),
        new FootnoteReferenceRun(notes.text('Vult workbook, Valuation and Inputs tabs.'))
      ])
    );
    children.push(para([run('Value by return on equity and cost of equity:', { color: MUTED, size: 18 })]));
    children.push(financialSensitivityTable(model, unit));
  } else {
    children.push(
      para([
        run(
          `A five-year unlevered DCF discounts free cash flow at a WACC of ${pct(d.wacc)} (cost of equity ${pct(d.costOfEquity)}, after-tax cost of debt ${pct(d.afterTaxDebt)}, equity weight ${pct(d.equityWeight)}) with terminal growth of ${pct(a.terminalGrowth)}. ` +
            `Revenue growth starts at ${pct(a.growth[0])} and fades to ${pct(a.growth.at(-1))}; the operating margin is held at ${pct(a.ebitMargin[0])} and the tax rate at ${pct(a.taxRate)}. ` +
            `This gives an enterprise value of ${money(d.ev, unit)} and an equity value of ${money(d.equityValue, unit)}` +
            (d.perShare != null ? `, or ${perShareText(d.perShare, unit)} per share.` : '.') +
            ` The terminal value is ${pct(d.tvShare)} of enterprise value.`
        ),
        new FootnoteReferenceRun(
          notes.text(
            'Vult model, DCF and Inputs tabs. Change any blue input in the workbook and the valuation recalculates.'
          )
        )
      ])
    );
    children.push(
      para([
        run(
          d.sensitivity.perShare
            ? 'Value per share by WACC and terminal growth:'
            : `Equity value (${unit.label}) by WACC and terminal growth:`,
          {
            color: MUTED,
            size: 18
          }
        )
      ])
    );
    children.push(sensitivityTable(model, unit));
  }

  if (narrative?.risks?.length) {
    children.push(heading('Key risks'));
    narrative.risks.forEach((risk, i) =>
      children.push(
        bullet([
          run(risk),
          ...(i === 0
            ? [
                new FootnoteReferenceRun(
                  notes.text(
                    `${fileName}, ${narrative.riskSection || 'Item 1A (Risk Factors)'}, ${pageRange(narrative.riskPages)}. Drafted by a language model; figures removed.`
                  )
                )
              ]
            : [])
        ])
      )
    );
  }

  children.push(heading('What to check before relying on this'));
  const defaults = ['Replace the risk-free rate, equity risk premium and beta (Vult defaults) with your house view.'];
  if (!(a.sharePrice > 0))
    defaults.push('Enter the current share price on the Inputs tab to use market weights and see upside.');
  if (fin)
    defaults.push(
      'Regulatory capital, credit quality and reserves are not extracted yet; check them in the filing before relying on the value.'
    );
  else defaults.push('Enter peers on the Comps tab from a market data source you trust.');
  defaults.forEach(text => children.push(bullet([run(text)])));
  if (flagged.length) {
    children.push(
      para([run(`The Assayer flagged ${flagged.length} item${flagged.length === 1 ? '' : 's'}:`, { bold: true })], {
        spacing: { before: 120, after: 60 }
      })
    );
    flagged.slice(0, 20).forEach(check => children.push(bullet([run(`${check.title}. ${check.detail}`)])));
  } else {
    children.push(
      bullet([
        run(
          'No Assayer checks are flagged. The checks confirm the figures match the filing and tie arithmetically; they are not a review of judgement.'
        )
      ])
    );
  }
  const corrections = meta.corrections ?? [];
  if (corrections.length) {
    children.push(
      para(
        [
          run(
            `Analysts made ${corrections.length} correction${corrections.length === 1 ? '' : 's'} to the extraction:`,
            {
              bold: true
            }
          )
        ],
        { spacing: { before: 120, after: 60 } }
      )
    );
    corrections.forEach(c => children.push(bullet([run(describeCorrection(c))])));
  }

  return Packer.toArrayBuffer(makeDoc(notes, children, `${company} investment memo`));
}

/** One-page tear sheet. Returns an ArrayBuffer. */
export async function buildTearSheet({ company, fileName, meta = {}, model, facts, assay }) {
  const unit = model.unit;
  const notes = footnoteBook(fileName);
  const fin = model.kind === 'financial';
  const d = model.dcf;
  const v = model.valuation;
  const b = model.base;
  const pages = statement => [...new Set(facts.filter(f => f.statement === statement).map(f => f.page))];
  const small = (text, options = {}) => run(text, { size: 17, ...options });
  const kpis = fin
    ? [
        ['Total income', h => money(h.revenue, unit)],
        ['Net income', h => money(h.netIncome, unit)],
        ['Return on equity', h => pct(h.roe)],
        ['Total equity', h => money(h.equity, unit)],
        ['Diluted EPS', h => epsText(h.eps, model.assumptions, unit)]
      ]
    : [
        ['Revenue', h => money(h.revenue, unit)],
        ['EBIT', h => money(h.ebit, unit)],
        ['EBIT margin', h => pct(h.ebit / h.revenue)],
        ['Net income', h => money(h.netIncome, unit)],
        ['Diluted EPS', h => epsText(h.eps, model.assumptions, unit)],
        ['Operating cash flow', h => money(h.cfo, unit)],
        [
          'Free cash flow',
          h => (Number.isFinite(h.cfo) && Number.isFinite(h.capex) ? money(h.cfo + h.capex, unit) : 'n/a')
        ]
      ];
  const valuation = fin
    ? [
        ['Cost of equity', pct(v.costOfEquity)],
        ['Sustainable ROE', pct(model.assumptions.roe)],
        ['Justified price to book', v.pb != null ? `${v.pb.toFixed(2)}x` : 'n/a'],
        ['Equity value', money(v.equityValue, unit)],
        ['Value per share', v.perShare != null ? perShareText(v.perShare, unit) : 'n/a'],
        [
          'Share price',
          model.assumptions.sharePrice > 0 ? perShareText(model.assumptions.sharePrice, unit) : 'not entered'
        ],
        ['Upside / (downside)', v.upside != null ? pct(v.upside) : 'n/a']
      ]
    : [
        ['WACC', pct(d.wacc)],
        ['Terminal growth', pct(model.assumptions.terminalGrowth)],
        ['Enterprise value', money(d.ev, unit)],
        ['Equity value', money(d.equityValue, unit)],
        ['Value per share', d.perShare != null ? perShareText(d.perShare, unit) : 'n/a'],
        [
          'Share price',
          model.assumptions.sharePrice > 0 ? perShareText(model.assumptions.sharePrice, unit) : 'not entered'
        ],
        ['Upside / (downside)', d.upside != null ? pct(d.upside) : 'n/a']
      ];
  const balance = fin
    ? [
        ['Total equity', money(b.equity, unit)],
        ['Total assets', money(b.ta, unit)]
      ]
    : [
        ['Cash and short-term investments', money(b.cashSti, unit)],
        ['Total debt', money(b.debtCurrent + b.debtNoncurrent, unit)],
        ['Total equity', money(b.equity, unit)],
        ['Total assets', money(b.ta, unit)]
      ];
  const children = [
    para([run(company, { bold: true, size: 34 })], { spacing: { after: 40 } }),
    para(
      [
        small(
          `Tear sheet, FY${b.period}. ${unit.label}. From ${fileName}${meta.yearEnd ? `, year ended ${meta.yearEnd}` : ''}.`,
          { color: MUTED }
        )
      ],
      { spacing: { after: 120 } }
    ),
    para([
      small('Reported performance', { bold: true, color: ACCENT, size: 20 }),
      new FootnoteReferenceRun(
        notes.text(
          `${fileName}: income statement PDF page ${pages('income').join(', ')}; cash flow statement PDF page ${pages('cashflow').join(', ')}.`
        )
      )
    ]),
    table(
      ['', ...model.hist.map(h => `FY${h.period}`)],
      kpis.map(([name, fn]) => [name, ...model.hist.map(fn)]),
      { size: 17 }
    ),
    para(
      [
        small('Balance sheet', { bold: true, color: ACCENT, size: 20 }),
        new FootnoteReferenceRun(notes.text(`${fileName}: balance sheet PDF page ${pages('balance').join(', ')}.`))
      ],
      { spacing: { before: 160, after: 60 } }
    ),
    table(['', `FY${b.period}`], balance, { firstWidth: 60, size: 17 }),
    para(
      [
        small(fin ? 'Valuation, justified price to book' : 'DCF valuation', { bold: true, color: ACCENT, size: 20 }),
        new FootnoteReferenceRun(
          notes.text(
            'Vult model, DCF tab. Risk-free rate, equity risk premium and beta are Vult defaults until replaced.'
          )
        )
      ],
      { spacing: { before: 160, after: 60 } }
    ),
    table(['', 'Base case'], valuation, { firstWidth: 60, size: 17 }),
    para(
      [
        small(
          `Assayer: ${assay.passed} checks passed, ${assay.flagged} flagged. Figures read from the filing by code; a flag needs an analyst to look at it. Draft for analyst review.`,
          { color: MUTED }
        )
      ],
      { spacing: { before: 160 } }
    )
  ];
  return Packer.toArrayBuffer(makeDoc(notes, children, `${company} tear sheet`));
}
