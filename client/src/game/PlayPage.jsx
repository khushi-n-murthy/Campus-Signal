// /play: today's missions, leaderboard, and campus exploration.
import { Link } from 'react-router';
import { useApi } from '../lib/useApi.js';
import { useLiveVersion } from '../lib/live.jsx';
import { useGame } from './GameContext.jsx';
import { Avatar, Icon } from './Sprite.jsx';
import { XpBar } from './PlayerChip.jsx';

export default function PlayPage() {
  const g = useGame();
  const version = useLiveVersion(() => true);
  const board = useApi('/api/game/leaderboard', version);
  const state = useApi('/api/game/rooms-state', version);
  const p = g?.player;
  const fogRooms = (state.data?.rooms || []).filter((r) => r.status === 'fog').slice(0, 6);
  const bounties = (state.data?.rooms || []).filter((r) => r.bounty && r.bounty.mult > 1 && r.status !== 'fog').slice(0, 4);
  return (
    <main className="page" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <h1>Signal Wars</h1>
      <p className="gm-note">Scan rooms to earn XP. Teams are your SIM network. Dead zones are Rex's home.</p>

      {!p && !g?.loading && (
        <div className="gm-box"><p>You haven't made an explorer yet.</p><button type="button" className="gm-btn ok" onClick={() => g.setScreen('title')}>Press start</button></div>
      )}

      {p && (
        <div className="gm-box">
          <div className="gm-row">
            <Avatar avatar={p.avatar} scale={2} idle />
            <div style={{ flex: 1, minWidth: 160 }}>
              <h2 style={{ margin: 0 }}>{p.nickname}</h2>
              <div className="gm-note">LV{p.level.level} {p.level.title} · streak {p.streak}</div>
              <XpBar level={p.level} />
            </div>
            <button type="button" className="gm-btn small ghost" onClick={() => g.setScreen('profile')}>Profile</button>
          </div>
          <h3>Today's missions</h3>
          {p.quests.map((q) => (
            <div key={q.id} className={`gm-quest ${q.done ? 'done' : ''}`}>
              <Icon name={q.done ? 'check' : 'clipboard'} scale={2} />
              <span>{q.label}</span>
              <b style={{ color: 'var(--yellow)', fontWeight: 400 }}>+{q.xp}</b>
              <span className="bar gm-note">{q.progress}/{q.goal}</span>
            </div>
          ))}
        </div>
      )}

      <div className="gm-box">
        <h3>Leaderboard</h3>
        {board.loading && <p className="gm-note">Loading…</p>}
        {board.data && board.data.length === 0 && <p className="gm-note">Nobody yet. Be the first!</p>}
        {board.data && board.data.length > 0 && (
          <table className="gm-table">
            <thead><tr><th>#</th><th>Explorer</th><th>Team</th><th>LV</th><th>XP</th></tr></thead>
            <tbody>
              {board.data.map((r) => (
                <tr key={r.nickname} className={p && r.nickname === p.nickname ? 'me' : ''}>
                  <td>{r.rank}</td>
                  <td><span className="gm-row" style={{ gap: 6, flexWrap: 'nowrap' }}><Avatar avatar={r.avatar} scale={1} />{r.nickname}</span></td>
                  <td>{r.team || '-'}</td><td>{r.level}</td><td>{r.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="gm-box">
        <h3>Explore</h3>
        {state.data && <p className="gm-note">{state.data.coverage.explored} of {state.data.coverage.total} rooms explored ({state.data.coverage.pct}%).</p>}
        {fogRooms.length > 0 && (<><p className="gm-note">Unexplored rooms:</p><div>{fogRooms.map((r) => <Link key={r.roomId} to={`/r/${r.roomId}`} className="gm-tag fog">{r.name}</Link>)}</div></>)}
        {bounties.length > 0 && (<><p className="gm-note">Bounties (rooms nobody has scanned lately):</p><div>{bounties.map((r) => <Link key={r.roomId} to={`/r/${r.roomId}`} className="gm-tag bounty">{r.name} x{r.bounty.mult}</Link>)}</div></>)}
        <p><Link to="/test" className="gm-btn small ok" style={{ textDecoration: 'none' }}>Scan a room</Link></p>
      </div>
    </main>
  );
}
