// The little explorer badge in the top bar. Opens the profile card, or the sign-up if there is no explorer yet.
import { Avatar } from './Sprite.jsx';
import { useGame } from './GameContext.jsx';

export default function PlayerChip() {
  const g = useGame();
  if (!g || g.loading) return null;
  if (!g.player) {
    return <button type="button" className="gm-btn small ok" onClick={() => g.setScreen('title')}>Play</button>;
  }
  const p = g.player;
  return (
    <button type="button" className="gm-chip" onClick={() => g.setScreen('profile')} aria-label={`${p.nickname}, level ${p.level.level}. Open profile`}>
      <Avatar avatar={p.avatar} scale={1} className="crop" />
      <span>
        <span className="gm-chip-name">{p.nickname}</span>
        <XpBar level={p.level} small />
      </span>
      <span className="gm-chip-lv">LV{p.level.level}</span>
    </button>
  );
}

const SEGMENTS = 10;
export function XpBar({ level, small = false }) {
  const on = Math.round((level.pct / 100) * SEGMENTS);
  return (
    <span className={`gm-xp ${small ? 'sm' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.pct)} aria-label="XP to next level" style={{ display: 'flex', minWidth: small ? 70 : 140 }}>
      {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}
