// Campus panel extras: how much of the campus is explored, today's missions, link to the full game screen.
import { Link } from 'react-router';
import { useApi } from '../lib/useApi.js';
import { useLiveVersion } from '../lib/live.jsx';
import { useGame } from './GameContext.jsx';
import { Icon } from './Sprite.jsx';

export default function CampusGameBox() {
  const g = useGame();
  const version = useLiveVersion(() => true);
  const { data } = useApi('/api/game/rooms-state', version);
  const c = data?.coverage;
  return (
    <div className="gm-box">
      <h3>Signal Wars</h3>
      {c && (
        <>
          <div className="gm-row" style={{ justifyContent: 'space-between' }}><span><Icon name="fog" scale={1} /> Explored</span><b style={{ color: 'var(--yellow)', fontWeight: 400 }}>{c.explored}/{c.total} rooms</b></div>
          <div className="gm-xp" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Campus explored" style={{ marginTop: 4 }}>
            {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.round(c.pct / 5) ? 'on' : ''} />)}
          </div>
        </>
      )}
      {g?.player ? (
        <Link to="/play" className="gm-btn small ok" style={{ display: 'block', textAlign: 'center', marginTop: 8, textDecoration: 'none' }}>Missions &amp; leaderboard</Link>
      ) : (
        <button type="button" className="gm-btn small ok" style={{ width: '100%', marginTop: 8 }} onClick={() => g?.setScreen('title')}>Create your explorer</button>
      )}
    </div>
  );
}
