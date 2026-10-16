import * as React from 'react';

/** App-wide state and actions. App.jsx provides it; every view reads it with useA(). */
export const Ctx = React.createContext(null);
export const useA = () => React.useContext(Ctx);

/** Subscribe to a CSS media query. */
export function useMedia(q) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = React.useState(get);
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q),
      f = () => setM(mq.matches);
    f();
    mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f);
    };
  }, [q]);
  return m;
}

/** The current time in milliseconds, refreshed on an interval so renders stay pure. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
