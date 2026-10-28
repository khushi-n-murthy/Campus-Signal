// One Socket.io connection for the whole site. Every saved test anywhere on campus arrives here.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const LiveContext = createContext({ last: null, connected: false, feed: [] });

export function LiveProvider({ children }) {
  const [state, setState] = useState({ last: null, connected: false, feed: [] });
  useEffect(() => {
    const socket = io({ reconnectionDelayMax: 10000 });
    socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
    socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
    socket.on('measurement:new', (event) => setState((s) => ({ ...s, last: { ...event, receivedAt: Date.now() } })));
    // GAME: scans and Rex runs by other players, for the live ticker
    socket.on('game:event', (event) => setState((s) => ({ ...s, feed: [{ ...event, id: `${Date.now()}-${Math.random()}`, receivedAt: Date.now() }, ...s.feed].slice(0, 5) })));
    return () => socket.close();
  }, []);
  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

// Returns a number that goes up (at most once per second) whenever a live event matches `match`.
// Pass it to useApi so the page refetches.
export function useLiveVersion(match) {
  const { last } = useLive();
  const [version, setVersion] = useState(0);
  const lastBump = useRef(0);
  const matchRef = useRef(match);
  useEffect(() => {
    matchRef.current = match; // always test events with the latest page's rule
  });
  useEffect(() => {
    if (!last || !matchRef.current(last)) return undefined;
    const wait = Math.max(0, 1000 - (Date.now() - lastBump.current));
    const t = setTimeout(() => {
      lastBump.current = Date.now();
      setVersion((v) => v + 1);
    }, wait);
    return () => clearTimeout(t);
  }, [last]);
  return version;
}
