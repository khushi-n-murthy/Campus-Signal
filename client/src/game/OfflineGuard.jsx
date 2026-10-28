// When the phone loses its connection, show Rex instead of an error. Works because the page is already loaded.
import { useEffect, useState } from 'react';
import DinoRun from './DinoRun.jsx';
import { flushRunQueue } from './DinoRun.jsx';
import { useGame } from './GameContext.jsx';
import { Rex } from './Sprite.jsx';

const DEAD_STATS = { score: 10, lossPct: 8, jitterMs: 70, latencyMs: 400 };

export default function OfflineGuard() {
  const g = useGame();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const off = () => { setOffline(true); setDismissed(false); };
    const on = () => { setOffline(false); flushRunQueue(() => g?.refresh?.()); };
    window.addEventListener('offline', off); window.addEventListener('online', on);
    if (navigator.onLine) flushRunQueue(() => g?.refresh?.());
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!offline) return null;
  if (dismissed) return <button type="button" className="gm-btn small pink" style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 150 }} onClick={() => setDismissed(false)}>Offline: play Rex</button>;
  return (
    <>
      <div className="gm-feed" style={{ position: 'fixed', top: 10, left: 10, bottom: 'auto' }}><div><Rex scale={1} frame="stand" /> No connection. Rex is here!</div></div>
      <DinoRun kind="offline" reason="No connection, so Rex is here. Play, or press End to close." roomName="No signal" stats={DEAD_STATS} onClose={() => setDismissed(true)} />
    </>
  );
}
