// Little "X scanned Y" ticker in the corner. Fades out on its own.
import { useEffect, useState } from 'react';
import { useLive } from '../lib/live.jsx';

export default function LiveFeed() {
  const { feed } = useLive();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(t); }, []);
  const recent = (feed || []).filter((e) => now - e.receivedAt < 9000).slice(0, 3);
  if (!recent.length) return null;
  return (
    <div className="gm-feed" aria-live="polite">
      {recent.map((e) => (
        <div key={e.id}>
          {e.type === 'run'
            ? `${e.nickname} ran ${e.distance} m with Rex`
            : `${e.nickname} scanned ${e.roomName || e.roomId}${e.first ? ' (first!)' : ''}${e.rex ? ' · Rex!' : ''}`}
        </div>
      ))}
    </div>
  );
}
