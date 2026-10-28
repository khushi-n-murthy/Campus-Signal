// The game side of a room panel: fog / dead zone, team control, Rex, bounty, records, and the Rex button.
import { useState } from 'react';
import { useApi } from '../lib/useApi.js';
import { useLiveVersion } from '../lib/live.jsx';
import { Icon, SignalBars, barsFor } from './Sprite.jsx';
import DinoRun from './DinoRun.jsx';

const STATUS = {
  fog: { icon: 'fog', cls: 'fog', text: 'UNEXPLORED: nobody has scanned here' },
  dead: { icon: 'bug', cls: 'dead', text: 'DEAD ZONE: Rex lives here' },
  weak: { icon: 'bolt', cls: '', text: 'Weak signal' },
  strong: { icon: 'shield', cls: '', text: 'Strong signal' },
};

export default function RoomGameBox({ roomId, roomName }) {
  const version = useLiveVersion((e) => e.roomId === roomId);
  const { data: g, error } = useApi(`/api/game/room/${encodeURIComponent(roomId)}`, version);
  const [lair, setLair] = useState(false);
  if (error || !g) return null;
  const st = STATUS[g.status] || STATUS.fog;
  return (
    <div className="gm-box">
      <h3>Signal Wars</h3>
      <div className="gm-row" style={{ gap: 8 }}>
        <SignalBars lit={g.status === 'dead' ? 0 : barsFor(g.score)} dead={g.status === 'dead'} scale={2} />
        <span className={`gm-tag ${st.cls}`}><Icon name={st.icon} scale={1} /> {st.text}</span>
      </div>
      {g.controlledBy && g.status !== 'fog' && <p className="gm-note" style={{ margin: '6px 0 0' }}>Held by: <b style={{ color: 'var(--yellow)', fontWeight: 400 }}>{g.controlledBy}</b></p>}
      {g.rex !== 'none' && <p className="gm-note" style={{ margin: '4px 0 0' }}>Rex: {g.rex === 'confirmed' ? 'confirmed here' : 'sighted here'}</p>}
      {g.bounty && g.bounty.mult > 1 && <p style={{ margin: '4px 0 0' }}><span className="gm-tag bounty"><Icon name="star" scale={1} /> BOUNTY x{g.bounty.mult}: {g.bounty.label}</span></p>}
      {g.rexOpens?.total > 0 && <p className="gm-note" style={{ margin: '4px 0 0' }}>Rex opened here {g.rexOpens.total}x by {g.rexOpens.players} player{g.rexOpens.players === 1 ? '' : 's'}</p>}
      {g.records?.length > 0 && (
        <p className="gm-note" style={{ margin: '6px 0 0' }}>
          <Icon name="crown" scale={1} /> Record: {g.records[0].nickname}, {g.records[0].distance} m
        </p>
      )}
      <button type="button" className="gm-btn small ok" style={{ marginTop: 8, width: '100%' }} onClick={() => setLair(true)}>
        {g.status === 'dead' ? 'Outrun Rex here' : "Visit Rex's Lair"}
      </button>
      {lair && <DinoRun kind="manual" roomId={roomId} roomName={roomName} stats={g.track} onClose={() => setLair(false)} />}
    </div>
  );
}
