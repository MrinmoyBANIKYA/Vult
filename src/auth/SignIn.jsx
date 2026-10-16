import * as React from 'react';
import { ArrowRight, Mail, ShieldCheck, Timer, FileCheck2 } from 'lucide-react';
import { auth } from '../lib/api.js';
import { cn } from '../lib/utils.js';
import { Button, Segmented } from '../components/ui.jsx';
import { Mark } from '../components/shared.jsx';

const PROOF = [
  [Timer, 'A checked first draft', 'Upload a 10-K and get a linked model, memo and tear sheet in minutes.'],
  [FileCheck2, 'Every figure traced', 'One click from any number to the page it came from.'],
  [
    ShieldCheck,
    'Checked, then reviewed',
    'Code checks every figure against the filing and flags what your analyst should look at.'
  ]
];

export function Field({ id, label, ...props }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-fg2">{label}</span>
      <input
        id={id}
        className="h-11 rounded-[14px] border border-line2 bg-inset px-4 text-[14px] text-fg outline-hidden transition-[border-color,box-shadow] placeholder:text-fg3 focus:border-gold/60 focus:shadow-[0_0_0_4px_hsl(var(--gold)/.14)]"
        {...props}
      />
    </label>
  );
}

export function SignIn() {
  const [mode, setMode] = React.useState('in');
  const [form, setForm] = React.useState({ name: '', email: '', password: '' });
  const [state, setState] = React.useState({ busy: false, error: null, info: null });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setState({ busy: true, error: null, info: null });
    const { error, data } =
      mode === 'in'
        ? await auth.signIn(form.email, form.password)
        : await auth.signUp(form.email, form.password, form.name.trim());
    if (error) return setState({ busy: false, error: error.message, info: null });
    if (mode === 'up' && !data.session)
      return setState({ busy: false, error: null, info: 'Check your inbox to confirm your email, then sign in.' });
    setState({ busy: false, error: null, info: null });
  };
  const magic = async () => {
    if (!form.email) return setState({ busy: false, error: 'Enter your work email first.', info: null });
    setState({ busy: true, error: null, info: null });
    const { error } = await auth.magicLink(form.email);
    setState({
      busy: false,
      error: error ? error.message : null,
      info: error ? null : 'We sent a sign-in link to ' + form.email + '.'
    });
  };

  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] max-lg:grid-cols-1">
      <aside className="relative flex flex-col justify-between overflow-hidden border-r border-line/70 p-12 max-lg:hidden">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent2/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[420px] w-[420px] rounded-full bg-[hsl(262_80%_60%/.16)] blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <Mark size={38} />
          <b className="text-[24px] font-bold tracking-[-.04em]">Vult</b>
        </div>
        <div className="relative max-w-[520px]">
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-.045em]">
            The research desk that works while you sleep.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg2">
            Financial models, comps, competitor, company and market analysis for UK and US deal teams. Your analysts
            stop building and start checking: every number clicks back to the page it came from.
          </p>
          <ul className="mt-9 flex flex-col gap-4">
            {PROOF.map(([I, t, b]) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/[.14] text-gold">
                  <I size={18} />
                </span>
                <span>
                  <b className="block text-[14px] font-semibold">{t}</b>
                  <span className="text-[13px] text-fg3">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-fg3">
          Concept product. Every company, client and figure here is fictional.
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Mark size={34} />
            <b className="text-[22px] font-bold tracking-[-.04em]">Vult</b>
          </div>
          <h2 className="text-[28px] font-bold tracking-[-.035em]">
            {mode === 'in' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-[14px] text-fg2">
            {mode === 'in' ? 'Sign in to your deal team’s workspace.' : 'Then set up your firm’s private workspace.'}
          </p>
          <Segmented
            id="auth-mode"
            label="Sign in or create an account"
            className="mt-6"
            value={mode}
            onChange={v => {
              setMode(v);
              setState({ busy: false, error: null, info: null });
            }}
            options={[
              { v: 'in', l: 'Sign in' },
              { v: 'up', l: 'Create account' }
            ]}
          />
          <form onSubmit={submit} className="card mt-5 flex flex-col gap-4 rounded-[24px]! p-6">
            {mode === 'up' && (
              <Field
                id="name"
                label="Full name"
                autoComplete="name"
                placeholder="Alex Morgan"
                value={form.name}
                onChange={set('name')}
              />
            )}
            <Field
              id="email"
              label="Work email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@firm.com"
              value={form.email}
              onChange={set('email')}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              placeholder="At least 8 characters"
              value={form.password}
              onChange={set('password')}
            />
            {(state.error || state.info) && (
              <p
                role={state.error ? 'alert' : 'status'}
                className={cn(
                  'rounded-[12px] px-3.5 py-2.5 text-[13px]',
                  state.error ? 'bg-neg/12 text-neg' : 'bg-pos/12 text-pos'
                )}
              >
                {state.error || state.info}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" className="mt-1 rounded-full" disabled={state.busy}>
              {mode === 'in' ? 'Sign in' : 'Create account'}
              <ArrowRight size={16} />
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" onClick={magic} disabled={state.busy}>
              <Mail size={15} />
              Email me a sign-in link instead
            </Button>
          </form>
          <p className="mt-6 text-center text-[12px] text-fg3 lg:hidden">
            Concept product. Every company, client and figure here is fictional.
          </p>
        </div>
      </main>
    </div>
  );
}
