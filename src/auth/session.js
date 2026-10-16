import * as React from 'react';

/** The signed-in user, or a demo stand-in when Supabase is not configured. */
export const DEMO_SESSION = { live: false, session: null, profile: null, email: null, signOut: null };
export const SessionCtx = React.createContext(DEMO_SESSION);
export const useSession = () => React.useContext(SessionCtx);
