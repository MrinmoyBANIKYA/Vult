/**
 * A client firm's own work, read from its saved Filing desk runs (Supabase, under the firm's RLS). Nothing
 * here is scripted: every number is counted from runs the firm built.
 */
import * as React from 'react';
import { ArrowRight, FileSpreadsheet, Search, ShieldCheck, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui.jsx';
import { PageHead, SecHead } from '../components/shared.jsx';
import { useA } from '../lib/context.js';
import { ago } from '../lib/format.js';
import { requestOpenRun, runStore } from '../lib/run-store.js';

function useFirmRuns() {
  const { live } = useA();
  const [state, setState] = React.useState({ loading: true, runs: [], error: '' });
  React.useEffect(() => {
    let alive = true;
    runStore({ live: live?.connected, orgId: live?.orgId })
      .list()
      .then(runs => alive && setState({ loading: false, runs, error: '' }))
      .catch(error => alive && setState({ loading: false, runs: [], error: error.message }));
    return () => {
      alive = false;
    };
  }, [live?.connected, live?.orgId]);
  return state;
}

// The base-case value per share, in the filing's currency.
const valueOf = summary => (Number.isFinite(summary?.perShare) ? `${summary.perShare.toFixed(2)} per share` : '');

function Checks({ summary }) {
  if (!summary) return <span className="text-fg3">n/a</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-pos">{summary.passed} passed</span>
      {summary.flagged > 0 && <span className="text-warn">{summary.flagged} flagged</span>}
    </span>
  );
}

function RunsTable({ runs, onOpen }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-180 text-left text-[13px]">
        <thead className="border-b border-line text-[12px] text-fg3">
          <tr>
            <th className="px-5 py-3 font-medium">Company</th>
            <th className="px-3 py-3 font-medium">Source</th>
            <th className="px-3 py-3 font-medium">Checks</th>
            <th className="px-3 py-3 font-medium">Value</th>
            <th className="px-3 py-3 font-medium">Analyst</th>
            <th className="px-5 py-3 text-right font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr
              key={run.id}
              onClick={() => onOpen(run.id)}
              className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-fg/4"
            >
              <td className="px-5 py-3">
                <b className="font-semibold">{run.company || 'Untitled'}</b>
                {run.summary?.unit && <div className="text-[12px] text-fg3">{run.summary.unit}</div>}
              </td>
              <td className="max-w-55 truncate px-3 py-3 text-fg2">{run.fileName}</td>
              <td className="px-3 py-3">
                <Checks summary={run.summary} />
              </td>
              <td className="px-3 py-3 text-fg2">{valueOf(run.summary) || 'n/a'}</td>
              <td className="px-3 py-3 text-fg2">{run.createdBy || 'n/a'}</td>
              <td className="px-5 py-3 text-right text-fg3">{ago(run.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ onStart }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-gold/12 text-gold">
        <FileSpreadsheet size={22} />
      </span>
      <b className="text-[16px]">No reports yet</b>
      <p className="max-w-md text-[13.5px] text-fg2">
        Search a US-listed company or upload an annual report in the Filing desk. Every report your firm builds is
        listed here.
      </p>
      <Button variant="primary" className="mt-1 rounded-full" onClick={onStart}>
        <Search size={15} /> Open the Filing desk
      </Button>
    </div>
  );
}

/** Every report the firm has built, newest first. */
export function FirmEngagements() {
  const { go, d } = useA();
  const { loading, runs, error } = useFirmRuns();
  const open = id => {
    requestOpenRun(id);
    go('desk');
  };
  return (
    <div className="mx-auto w-full max-w-350 px-4 pb-16 pt-6 sm:px-7">
      <PageHead
        title="Engagements"
        sub={
          loading
            ? `Loading ${d.org}’s reports`
            : `${d.org} has ${runs.length} report${runs.length === 1 ? '' : 's'}, built from real filings.`
        }
        right={
          <Button variant="primary" className="rounded-full" onClick={() => go('desk')}>
            <Search size={15} /> New report
          </Button>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-neg/10 px-4 py-3 text-[13px] text-neg">{error}</p>}
      {!loading && !runs.length ? <Empty onStart={() => go('desk')} /> : <RunsTable runs={runs} onOpen={open} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-[12.5px] text-fg3">
        <Icon size={15} /> {label}
      </div>
      <div className="mt-2 text-[28px] font-bold tracking-[-.02em]">{value}</div>
      {sub && <div className="mt-0.5 text-[12.5px] text-fg2">{sub}</div>}
    </div>
  );
}

/** The firm's real numbers and recent work. */
export function FirmHome() {
  const { go, d } = useA();
  const { loading, runs } = useFirmRuns();
  const companies = new Set(runs.map(r => r.company).filter(Boolean)).size;
  const passed = runs.reduce((sum, r) => sum + (r.summary?.passed ?? 0), 0);
  const flagged = runs.reduce((sum, r) => sum + (r.summary?.flagged ?? 0), 0);
  const open = id => {
    requestOpenRun(id);
    go('desk');
  };
  return (
    <div className="mx-auto w-full max-w-350 px-4 pb-16 pt-6 sm:px-7">
      <PageHead
        title={`Good to see you, ${d.me.n.split(' ')[0]}`}
        sub={`${d.org}. Every figure on this page is counted from reports your firm built.`}
        right={
          <Button variant="primary" className="rounded-full" onClick={() => go('desk')}>
            <Search size={15} /> Search a company
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FileSpreadsheet} label="Reports built" value={loading ? '…' : runs.length} />
        <Stat icon={Building2} label="Companies covered" value={loading ? '…' : companies} />
        <Stat icon={ShieldCheck} label="Checks passed" value={loading ? '…' : passed.toLocaleString('en-GB')} />
        <Stat
          icon={AlertTriangle}
          label="Flagged for review"
          value={loading ? '…' : flagged}
          sub={flagged ? 'Open a report’s Checks tab to review them' : 'Nothing waiting'}
        />
      </div>
      <SecHead
        title="Recent reports"
        right={
          runs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => go('engagements')}>
              All engagements <ArrowRight size={14} />
            </Button>
          )
        }
      />
      {!loading && !runs.length ? (
        <Empty onStart={() => go('desk')} />
      ) : (
        <RunsTable runs={runs.slice(0, 6)} onOpen={open} />
      )}
    </div>
  );
}

/** Marks a scripted page for a client firm, so nobody mistakes its figures for theirs. */
export function DemoBanner() {
  const { go } = useA();
  return (
    <div className="mx-auto w-full max-w-350 px-4 pt-5 sm:px-7">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn/8 px-4 py-3 text-[13px]">
        <b className="text-warn">Demo preview.</b>
        <span className="min-w-0 flex-1 text-fg2">
          Everything on this page is fictional and shows where Vult is going. Your firm’s real work is in the Filing
          desk and Engagements.
        </span>
        <Button size="sm" variant="ghost" onClick={() => go('desk')}>
          Open the Filing desk <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
