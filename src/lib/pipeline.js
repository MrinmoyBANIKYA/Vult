/**
 * The 10-K to checked model pipeline. Each step is real work and reports progress as it goes:
 *
 *   find statements -> classify rows (model) -> read figures (code) -> Assayer -> build model
 *   -> write .xlsx -> recalculate in LibreOffice -> draft narrative (model) -> write memo and tear sheet
 *
 * `llm` is { mapRows(statement, rows), narrative(input), recalc(base64, cells) }, normally the engine client.
 */
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';
import {
  BUSINESS_HEADINGS,
  RISK_HEADINGS,
  detectCover,
  detectUnit,
  findSection,
  mappingProblems,
  resolveFacts,
  selectStatementPages,
  statementRows
} from './filing.js';
import { assay, withRecalc } from './assayer.js';
import { buildModel } from './model.js';
import { applyCorrections } from './corrections.js';
import { buildFinancialModel, buildFinancialWorkbook, detectSector, isFinancial } from './financials.js';
import { buildModelWorkbook } from './workbook.js';
import { buildMemo, buildTearSheet } from './memo.js';
import { toBase64 } from './engine-client.js';

const STATEMENT_TITLE = { income: 'Income statement', balance: 'Balance sheet', cashflow: 'Cash flow' };

export const STEPS = [
  ['locate', 'Find the financial statements'],
  ['classify', 'Classify statement rows'],
  ['read', 'Read figures from the page text'],
  ['assay', 'Run the Assayer'],
  ['model', 'Build the three-statement model and DCF'],
  ['recalc', 'Recalculate the workbook in LibreOffice'],
  ['narrative', 'Draft business and risk sections'],
  ['documents', 'Write the memo and tear sheet']
];

/**
 * Re-runs everything after extraction: used when the analyst changes an assumption or corrects a row.
 * Facts are rebuilt from the statement rows, the model's mapping and the analyst's corrections.
 */
export async function buildOutputs({ extraction, overrides, peers, narrative, llm, onStep = () => {} }) {
  const { pageTexts, unit, company, fileName, cover, llmInfo } = extraction;
  const corrections = extraction.corrections ?? [];
  const { facts, issues } = extraction.statements
    ? applyCorrections({ statements: extraction.statements, unit, corrections })
    : extraction;
  const meta = { yearEnd: cover.yearEnd, llm: llmInfo, corrections };

  onStep('model', 'running');
  let sector = extraction.sector ?? 'corporate';
  let model;
  if (isFinancial(sector)) model = buildFinancialModel({ facts, unit, overrides, sector });
  else {
    try {
      model = buildModel({ facts, unit, overrides });
    } catch (error) {
      // A balance sheet with no current/non-current split is a bank's or insurer's, even when the wording
      // did not say so; value it on equity rather than fail.
      const unclassified =
        !facts.some(f => f.key === 'current_assets') &&
        facts.some(f => f.statement === 'balance' && f.key === 'total_equity');
      if (!unclassified) throw error;
      sector = 'financial';
      model = buildFinancialModel({ facts, unit, overrides, sector });
    }
  }
  let checks = assay({
    facts,
    issues,
    pageTexts,
    unit,
    sector,
    reference: extraction.reference,
    ocrPages: extraction.ocrPages ?? []
  });
  const buildWorkbook = model.kind === 'financial' ? buildFinancialWorkbook : buildModelWorkbook;
  onStep(
    'model',
    'done',
    model.kind === 'financial'
      ? `${model.periods.length} historical years, valued on justified price to book`
      : `${model.periods.length} historical and ${model.years.length} forecast years`
  );

  onStep('recalc', 'running');
  let recalcNote;
  try {
    const bare = await buildWorkbook({
      company,
      fileName,
      facts,
      assay: checks,
      model,
      meta,
      peers,
      cache: false
    });
    const result = await llm.recalc(
      toBase64(bare.buffer),
      bare.checkCells.map(c => c.ref)
    );
    checks = withRecalc(checks, result, bare.checkCells);
    const failed = checks.checks.filter(c => c.group === 'workbook' && !c.passed).length;
    recalcNote = failed ? `${failed} cells disagree` : `${bare.checkCells.length} cells agree`;
    onStep('recalc', failed ? 'flagged' : 'done', recalcNote);
  } catch (error) {
    checks = withRecalc(checks, { error: `Not run: ${error.message}` }, []);
    onStep('recalc', 'skipped', error.status === 501 ? 'LibreOffice is not installed' : error.message);
  }
  // Rebuild so the Assayer tab inside the workbook includes the recalculation results.
  const finalWorkbook = await buildWorkbook({ company, fileName, facts, assay: checks, model, meta, peers });

  onStep('documents', 'running');
  const memo = await buildMemo({ company, fileName, meta, model, facts, assay: checks, narrative });
  const tearSheet = await buildTearSheet({ company, fileName, meta, model, facts, assay: checks });
  onStep('documents', 'done', 'Memo and tear sheet');
  return {
    extraction: { ...extraction, facts, issues },
    model,
    sector,
    assay: checks,
    workbook: finalWorkbook.buffer,
    memo,
    tearSheet
  };
}

/** Runs the whole slice from page text. */
export async function runPipeline({
  pageTexts,
  fileName,
  llm,
  overrides = {},
  peers = [],
  ocrPages = [],
  onStep = () => {}
}) {
  onStep('locate', 'running');
  const pages = selectStatementPages(pageTexts);
  const cover = detectCover(pageTexts, pages);
  const sector = detectSector(pages);
  const unit = detectUnit(pages.map(p => p.text).join('\n'));
  onStep('locate', 'done', `PDF pages ${pages.map(p => p.page).join(', ')}`);

  onStep('classify', 'running');
  const extracted = { facts: [], issues: [], statements: {} };
  let llmInfo = null;
  let nextId = 1;
  for (const statement of Object.keys(STATEMENT_KEYS)) {
    const own = pages.filter(p => p.statement.split(', ').includes(statement));
    const rows = statementRows(own, nextId);
    nextId += rows.length;
    if (!rows.length) throw new Error(`No rows were found on the ${statement} pages.`);
    onStep('classify', 'running', `${STATEMENT_TITLE[statement]}: ${rows.length} rows`);
    const sent = rows.map(row => ({ id: row.id, section: row.section, label: row.label, values: row.printed }));
    let reply = await llm.mapRows(statement, sent);
    // When code finds problems in the answer, the model gets one more attempt with them; code keeps the
    // answer with fewer problems.
    const problems = mappingProblems(statement, rows, reply.mapping, unit);
    if (problems.length) {
      onStep('classify', 'running', `${STATEMENT_TITLE[statement]}: rechecking ${problems.length} problems`);
      try {
        const second = await llm.mapRows(statement, sent, problems);
        if (mappingProblems(statement, rows, second.mapping, unit).length < problems.length) reply = second;
      } catch {
        /* the first answer stands, and the Assayer flags its problems */
      }
    }
    llmInfo = { provider: reply.provider, label: reply.label, model: reply.model, local: reply.local };
    // Rows and the model's own mapping are kept, so analyst corrections can be replayed over them later.
    extracted.statements[statement] = { rows, mapping: reply.mapping };
    const { facts, issues } = resolveFacts(statement, rows, reply.mapping, unit);
    extracted.facts.push(...facts);
    extracted.issues.push(...issues);
  }
  onStep(
    'classify',
    'done',
    llmInfo ? `${llmInfo.label} ${llmInfo.model}${llmInfo.local ? ', on this machine' : ''}` : ''
  );

  onStep('read', 'running');
  const company = cover.company || 'The company';
  onStep('read', 'done', `${extracted.facts.length} figures`);

  onStep('assay', 'running');
  const first = assay({ ...extracted, pageTexts, unit, sector });
  onStep('assay', first.flagged ? 'flagged' : 'done', `${first.passed} passed, ${first.flagged} flagged`);

  const extraction = { ...extracted, pageTexts, unit, company, fileName, cover, llmInfo, pages, sector, ocrPages };

  onStep('narrative', 'running');
  let narrative = null;
  const business = findSection(pageTexts, BUSINESS_HEADINGS, 6000);
  const risks = findSection(pageTexts, RISK_HEADINGS, 8000);
  try {
    if (business.text || risks.text) {
      const reply = await llm.narrative({ company, business: business.text, risks: risks.text });
      narrative = {
        ...reply,
        businessPages: business.pages,
        riskPages: risks.pages,
        businessSection: business.name,
        riskSection: risks.name
      };
      const found = [business.name, risks.name].filter(Boolean).join(' and ');
      onStep('narrative', 'done', `${found}, ${reply.risks.length} risks`);
    } else onStep('narrative', 'skipped', 'No business or risk section found');
  } catch (error) {
    onStep('narrative', 'skipped', error.message);
  }

  const outputs = await buildOutputs({ extraction, overrides, peers, narrative, llm, onStep });
  return { narrative, ...outputs };
}
