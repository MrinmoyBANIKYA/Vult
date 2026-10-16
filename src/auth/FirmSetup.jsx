import * as React from 'react';
import { ArrowRight, LogOut } from 'lucide-react';
import { auth, createOrganization, joinOrganization } from '../lib/api.js';
import { Button, Segmented } from '../components/ui.jsx';
import { Mark } from '../components/shared.jsx';
import { Field } from './SignIn.jsx';

/**
 * First sign-in on a client project: the account belongs to no firm yet. An analyst joins their firm with the
 * code an owner shares; the first person at a firm sets it up and owns it.
 */
export function FirmSetup({ email, onCreated }) {
  const [mode, setMode] = React.useState('join');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [region, setRegion] = React.useState('uk');
  const [state, setState] = React.useState({ busy: false, error: null });

  const submit = async e => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      // "ab12cd34" and "AB12-CD34" are the same code.
      const plain = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (mode === 'join') await joinOrganization(`${plain.slice(0, 4)}-${plain.slice(4)}`);
      else await createOrganization(name.trim(), region);
      await onCreated();
    } catch (error) {
      setState({ busy: false, error: error.message || 'That did not work. Try again.' });
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3">
          <Mark size={34} />
          <b className="text-[22px] font-bold tracking-[-.04em]">Vult</b>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-.035em]">
          {mode === 'join' ? 'Join your firm' : 'Set up your firm'}
        </h1>
        <p className="mt-1.5 text-[14px] text-fg2">
          {mode === 'join'
            ? 'Enter the join code your firm’s owner shared with you. Your work is kept in the firm’s private workspace.'
            : 'Filings, models and memos you build are kept in your firm’s private workspace, and you will be its owner.'}
        </p>
        <Segmented
          id="firm-mode"
          label="Join a firm or set one up"
          className="mt-6"
          value={mode}
          onChange={value => {
            setMode(value);
            setState({ busy: false, error: null });
          }}
          options={[
            { v: 'join', l: 'Join with a code' },
            { v: 'create', l: 'Set up a new firm' }
          ]}
        />
        <form onSubmit={submit} className="card mt-5 flex flex-col gap-4 rounded-[24px]! p-6">
          {mode === 'join' ? (
            <Field
              id="firm-code"
              label="Join code"
              required
              pattern="[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}"
              autoComplete="off"
              spellCheck={false}
              placeholder="AB12-CD34"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
            />
          ) : (
            <>
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
            </>
          )}
          {state.error && (
            <p role="alert" className="rounded-[12px] bg-neg/12 px-3.5 py-2.5 text-[13px] text-neg">
              {state.error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="mt-1 rounded-full" disabled={state.busy}>
            {mode === 'join' ? 'Join firm' : 'Create workspace'}
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
