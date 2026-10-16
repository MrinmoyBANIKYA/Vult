// POST /functions/v1/start-run
// Body: { engagement_id: string, deliverables: string[], priority?: boolean }
// Prices and plans a run on the server, then records it. Returns { run }.
import { json, preflight, readJson } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { DELIVERABLE_KEYS, planRun, type Region } from '../_shared/pricing.ts';

interface Body {
  engagement_id?: unknown;
  deliverables?: unknown;
  priority?: unknown;
}

Deno.serve(async req => {
  const early = preflight(req);
  if (early) return early;

  const supabase = userClient(req);
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in to start a run' }, 401);

  const body = await readJson<Body>(req);
  if (!body) return json({ error: 'Send a JSON body' }, 400);
  const { engagement_id, deliverables, priority } = body;
  if (typeof engagement_id !== 'string') return json({ error: 'engagement_id is required' }, 400);
  if (
    !Array.isArray(deliverables) ||
    deliverables.length === 0 ||
    deliverables.some(k => typeof k !== 'string' || !DELIVERABLE_KEYS.includes(k))
  ) {
    return json({ error: `deliverables must list one or more of: ${DELIVERABLE_KEYS.join(', ')}` }, 400);
  }

  // Row-level security means this only finds engagements in the caller's organisations.
  const { data: engagement, error: engagementError } = await supabase
    .from('engagements')
    .select('id, org_id, organizations(region, currency)')
    .eq('id', engagement_id)
    .maybeSingle();
  if (engagementError) return json({ error: engagementError.message }, 400);
  if (!engagement) return json({ error: 'Engagement not found' }, 404);

  const org = engagement.organizations as unknown as { region: Region; currency: string };
  const plan = planRun(new Set(deliverables as string[]), org.region, priority === true);

  const { data: last } = await supabase
    .from('runs')
    .select('run_no')
    .eq('engagement_id', engagement_id)
    .order('run_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: run, error: runError } = await supabase
    .from('runs')
    .insert({
      org_id: engagement.org_id,
      engagement_id,
      run_no: (last?.run_no ?? 0) + 1,
      status: 'running',
      priority: priority === true,
      deliverables,
      plan,
      price: plan.price,
      currency: org.currency,
      minutes_planned: plan.total,
      started_at: new Date().toISOString()
    })
    .select('id, run_no, status, price, currency, minutes_planned, started_at')
    .single();
  if (runError) return json({ error: runError.message }, runError.code === '42501' ? 403 : 400);

  return json({ run, plan });
});
