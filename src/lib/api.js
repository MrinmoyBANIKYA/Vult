/**
 * Every call Vult makes to Supabase lives here, so views never touch the client directly.
 * Rows are mapped into the same shapes the demo data uses, which keeps the UI identical in both modes.
 */
import { supabase } from './supabase.js';
import { ago, clockLabel } from './format.js';

const STATUS_TO_UI = { draft: 'draft', running: 'run', paused: 'paused', in_review: 'rev', delivered: 'ok' };

function must({ data, error }) {
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ auth */
export const auth = {
  getSession: () => supabase.auth.getSession(),
  onChange: cb => supabase.auth.onAuthStateChange((_event, session) => cb(session)).data.subscription,
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signUp: (email, password, fullName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin }
    }),
  magicLink: email => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }),
  signOut: () => supabase.auth.signOut()
};

export async function getProfile(userId) {
  return must(await supabase.from('profiles').select('full_name, title').eq('id', userId).maybeSingle());
}

/** Gives a new account access to the seeded demo workspaces. Safe to call on every sign-in. */
export async function ensureDemoAccess() {
  return must(await supabase.rpc('join_demo_workspaces'));
}

/* ------------------------------------------------------------------ workspace */
export async function loadWorkspace(region) {
  const org = must(
    await supabase
      .from('organizations')
      .select('id, slug, name, region')
      .eq('region', region)
      .order('created_at')
      .limit(1)
      .maybeSingle()
  );
  if (!org) return null;

  const [eng, appr, mon, brief, dismissed] = await Promise.all([
    supabase
      .from('engagements')
      .select('id, name, target_label, type, status, progress, owner_name, is_flagship, updated_at')
      .eq('org_id', org.id)
      .order('is_flagship', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('approvals')
      .select('id, kind, agent, title, why, diff, created_at, engagement:engagements(name)')
      .eq('org_id', org.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('monitors')
      .select('id, name, scope, trigger_label, schedule_label, enabled, runs_count, last_run_at')
      .eq('org_id', org.id)
      .order('position'),
    supabase
      .from('brief_items')
      .select('id, kind, tone, agent, title, body, impact, action, occurred_at')
      .eq('org_id', org.id)
      .order('position'),
    supabase.from('brief_dismissals').select('brief_id')
  ]);
  const engagements = must(eng),
    hidden = new Set(must(dismissed).map(r => r.brief_id));
  const flagship = engagements.find(e => e.is_flagship) || null;

  return {
    orgId: org.id,
    flagshipId: flagship ? flagship.id : null,
    // The first entry stands for the flagship engagement, which the app renders in full.
    engagements: [
      { k: 'main', id: flagship && flagship.id },
      ...engagements
        .filter(e => !e.is_flagship)
        .map(e => ({
          id: e.id,
          n: e.name,
          t: e.target_label,
          ty: e.type,
          s: STATUS_TO_UI[e.status] || 'draft',
          p: e.status === 'running' || e.status === 'paused' ? Math.round(Number(e.progress)) : undefined,
          o: e.owner_name,
          u: ago(e.updated_at)
        }))
    ],
    approvals: must(appr).map(a => ({
      id: a.id,
      kind: a.kind,
      who: a.agent,
      eng: a.engagement ? a.engagement.name : '',
      age: ago(a.created_at),
      title: a.title,
      why: a.why,
      diff: a.diff
    })),
    monitors: must(mon).map(x => ({
      id: x.id,
      n: x.name,
      scope: x.scope,
      trig: x.trigger_label,
      last: clockLabel(x.last_run_at),
      next: x.schedule_label,
      on: x.enabled,
      runs: x.runs_count
    })),
    brief: must(brief)
      .filter(b => !hidden.has(b.id))
      .map(b => ({
        id: b.id,
        kind: b.kind,
        tone: b.tone,
        agent: b.agent,
        when: clockLabel(b.occurred_at),
        title: b.title,
        body: b.body,
        impact: b.impact,
        act: [b.action.label, b.action.view, b.action.tab].filter(Boolean)
      }))
  };
}

/** Re-runs `onChange` whenever approvals, briefings or engagements change for this organisation. */
export function subscribeToWorkspace(orgId, onChange) {
  const filter = `org_id=eq.${orgId}`;
  const channel = supabase
    .channel(`org:${orgId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'brief_items', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'engagements', filter }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ actions */
export async function decideApproval(id, approve) {
  return must(await supabase.rpc('decide_approval', { p_approval: id, p_approve: approve }));
}

export async function setMonitorEnabled(id, enabled) {
  return must(await supabase.from('monitors').update({ enabled }).eq('id', id).select('id').single());
}

export async function dismissBrief(id) {
  return must(
    await supabase
      .from('brief_dismissals')
      .upsert({ brief_id: id }, { onConflict: 'brief_id,user_id', ignoreDuplicates: true })
  );
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

/** Records a run server-side; the edge function prices it and stores the plan. */
export const startRun = ({ engagementId, deliverables, priority }) =>
  invoke('start-run', { engagement_id: engagementId, deliverables, priority });

/** Asks the co-pilot edge function, which answers from this engagement's evidence. */
export const askVult = ({ engagementId, question }) => invoke('ask-vult', { engagement_id: engagementId, question });

/* ------------------------------------------------------------------ Filing desk runs */
// The extraction is a row in desk_runs; the PDF and its page text sit in the private `sources` bucket under
// {org_id}/desk/, so the storage rules for the organisation apply. Versions are append-only.

const deskPath = (orgId, runId, ext) => `${orgId}/desk/${runId}${ext}`;

export async function listDeskRuns(orgId) {
  const rows = must(
    await supabase
      .from('desk_runs')
      .select(
        'id, company, file_name, sector, summary, created_by_name, created_at, updated_at, desk_run_versions(count)'
      )
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(50)
  );
  return rows.map(r => ({
    id: r.id,
    company: r.company,
    fileName: r.file_name,
    sector: r.sector,
    createdBy: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    versions: r.desk_run_versions?.[0]?.count ?? 0,
    summary: r.summary
  }));
}

export async function getDeskRun(id) {
  const row = must(await supabase.from('desk_runs').select('*').eq('id', id).single());
  const versions = must(
    await supabase
      .from('desk_run_versions')
      .select('n, note, by_name, summary, overrides, corrections, created_at')
      .eq('run_id', id)
      .order('n')
  );
  const texts = row.texts_path ? must(await supabase.storage.from('sources').download(row.texts_path)) : null;
  return {
    record: {
      ...row.record,
      versions: versions.map(v => ({
        n: v.n,
        note: v.note,
        by: v.by_name,
        at: v.created_at,
        summary: v.summary,
        overrides: v.overrides,
        corrections: v.corrections
      }))
    },
    pageTexts: texts ? JSON.parse(await texts.text()) : null,
    hasPdf: Boolean(row.pdf_path)
  };
}

export async function getDeskRunPdf(id) {
  const row = must(await supabase.from('desk_runs').select('pdf_path').eq('id', id).single());
  if (!row.pdf_path) throw new Error('The PDF for this run is not saved');
  const blob = must(await supabase.storage.from('sources').download(row.pdf_path));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Saves a run. The first save uploads the PDF and page text; later saves update the record. Every save
 * appends the newest version, so the history is kept even though the record is overwritten.
 */
export async function saveDeskRun(orgId, { record, pageTexts, pdf }) {
  const { versions = [], ...rest } = record;
  const latest = versions.at(-1);
  const existing = must(await supabase.from('desk_runs').select('id').eq('id', record.id).maybeSingle());
  if (!existing) {
    const pdfPath = pdf ? deskPath(orgId, record.id, '.pdf') : null;
    const textsPath = pageTexts ? deskPath(orgId, record.id, '.texts.json') : null;
    if (pdf) must(await supabase.storage.from('sources').upload(pdfPath, pdf, { contentType: 'application/pdf' }));
    if (pageTexts)
      must(
        await supabase.storage
          .from('sources')
          .upload(textsPath, new Blob([JSON.stringify(pageTexts)], { type: 'application/json' }))
      );
    must(
      await supabase.from('desk_runs').insert({
        id: record.id,
        org_id: orgId,
        created_by_name: record.createdBy ?? '',
        company: record.company ?? '',
        file_name: record.fileName ?? '',
        sector: record.sector ?? 'corporate',
        summary: latest?.summary ?? {},
        record: rest,
        pdf_path: pdfPath,
        texts_path: textsPath
      })
    );
  } else {
    must(
      await supabase
        .from('desk_runs')
        .update({ summary: latest?.summary ?? {}, record: rest, company: record.company ?? '' })
        .eq('id', record.id)
    );
  }
  if (latest)
    must(
      await supabase.from('desk_run_versions').upsert(
        {
          run_id: record.id,
          org_id: orgId,
          n: latest.n,
          note: latest.note ?? '',
          by_name: latest.by ?? '',
          summary: latest.summary ?? {},
          overrides: latest.overrides ?? {},
          corrections: latest.corrections ?? []
        },
        { onConflict: 'run_id,n', ignoreDuplicates: true }
      )
    );
  return { id: record.id, saved: true };
}

/** Deletes a run, its versions and its stored PDF and page text. Admins only, under row-level security. */
export async function deleteDeskRun(id) {
  const row = must(await supabase.from('desk_runs').select('pdf_path, texts_path').eq('id', id).single());
  const paths = [row.pdf_path, row.texts_path].filter(Boolean);
  if (paths.length) must(await supabase.storage.from('sources').remove(paths));
  return must(await supabase.from('desk_runs').delete().eq('id', id));
}
