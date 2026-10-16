import * as React from 'react';
import { isLive } from '../lib/supabase.js';
import { auth, ensureDemoAccess, getProfile } from '../lib/api.js';
import { SessionCtx, DEMO_SESSION } from './session.js';
import { SignIn } from './SignIn.jsx';
import { Mark } from '../components/shared.jsx';

/**
 * Without Supabase keys, Vult opens straight into the demo.
 * With keys, it asks the user to sign in, grants the demo workspaces, then renders the app.
 */
export function AuthGate({ children }) {
  if (!isLive) return <SessionCtx.Provider value={DEMO_SESSION}>{children}</SessionCtx.Provider>;
  return <LiveGate>{children}</LiveGate>;
}

function LiveGate({ children }) {
  const [session, setSession] = React.useState(undefined); // undefined while we ask Supabase
  const [ready, setReady] = React.useState({ userId: null, profile: null });

  React.useEffect(() => {
    let alive = true;
    auth.getSession().then(({ data }) => alive && setSession(data.session ?? null));
    const sub = auth.onChange(s => setSession(s ?? null));
    return () => {
      alive = false;
      sub.unsubscribe();
    };
  }, []);

  const userId = session ? session.user.id : null;
  React.useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    ensureDemoAccess()
      .catch(err => console.warn('[vult] demo access', err))
      .then(() => getProfile(userId))
      .catch(() => null)
      .then(profile => alive && setReady({ userId, profile }));
    return () => {
      alive = false;
    };
  }, [userId]);

  const value = React.useMemo(
    () =>
      session
        ? { live: true, session, profile: ready.profile, email: session.user.email, signOut: () => auth.signOut() }
        : null,
    [session, ready.profile]
  );

  if (session === undefined || (session && ready.userId !== userId)) return <Splash />;
  if (!session) return <SignIn />;
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

function Splash() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-label="Loading Vult">
      <div className="flex flex-col items-center gap-4">
        <Mark size={44} className="animate-pulse2" />
        <span className="text-[13px] text-fg3">Opening your workspace</span>
      </div>
    </div>
  );
}
