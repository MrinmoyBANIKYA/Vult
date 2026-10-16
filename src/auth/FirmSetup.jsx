import * as React from 'react';
import { ArrowRight, LogOut } from 'lucide-react';
import { auth, createOrganization } from '../lib/api.js';
import { Button, Segmented } from '../components/ui.jsx';
import { Mark } from '../components/shared.jsx';
import { Field } from './SignIn.jsx';

/** First sign-in on a client project: the account belongs to no firm yet, so it sets one up and owns it. */
export function FirmSetup({ email, onCreated }) {
  const [name, setName] = React.useState('');
  const [region, setRegion] = React.useState('uk');
  const [state, setState] = React.useState({ busy: false, error: null });

  const submit = async e => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      await createOrganization(name.trim(), region);
      await onCreated();
    } catch (error) {
      setState({ busy: false, error: error.message || 'The firm could not be set up.' });
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3">
          <Mark size={34} />
          <b className="text-[22px] font-bold tracking-[-.04em]">Vult</b>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-.035em]">Set up your firm</h1>
        <p className="mt-1.5 text-[14px] text-fg2">
          Filings, models and memos you build are kept in your firm’s private workspace, and you will be its owner.
        </p>
        <form onSubmit={submit} className="card mt-6 flex flex-col gap-4 rounded-[24px]! p-6">
          <Field
            id="firm-name"
            label="Firm name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="organization"
            placeholder="Northgate Capital"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-fg2">Where the deal team works</span>
            <Segmented
              id="firm-region"
              label="Region"
              value={region}
              onChange={setRegion}
              options={[
                { v: 'uk', l: 'United Kingdom' },
                { v: 'us', l: 'United States' }
              ]}
            />
            <span className="text-[12px] text-fg3">
              Sets the default currency and accounting standard: GBP and IFRS, or USD and US GAAP.
            </span>
          </div>
          {state.error && (
            <p role="alert" className="rounded-[12px] bg-neg/12 px-3.5 py-2.5 text-[13px] text-neg">
              {state.error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="mt-1 rounded-full" disabled={state.busy}>
            Create workspace
            <ArrowRight size={16} />
          </Button>
        </form>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-fg3">
          Signed in as {email}
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => auth.signOut()}>
            <LogOut size={14} /> Sign out
          </Button>
        </p>
      </div>
    </main>
  );
}
