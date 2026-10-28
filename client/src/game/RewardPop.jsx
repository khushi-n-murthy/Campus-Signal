// Shown after every scan: the XP, why, and anything you unlocked.
import { useEffect } from 'react';
import { Icon } from './Sprite.jsx';
import { useGame } from './GameContext.jsx';
import { BADGE_ICON } from './ProfileCard.jsx';

export default function RewardPop() {
  const g = useGame();
  const r = g.reward;
  useEffect(() => {
    if (!r) return undefined;
    const t = setTimeout(() => g.setReward(null), 9000);
    return () => clearTimeout(t);
  }, [r]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  return (
    <div className="gm-reward px-box" role="status" aria-live="polite">
      <div className="gm-row" style={{ justifyContent: 'space-between' }}>
        <span className="xp">+{r.xp} XP</span>
        {r.leveledUp && <span className="gm-tag bounty">LEVEL UP! LV{r.level.level} {r.level.title}</span>}
      </div>
      <div className="gm-lines">
        {r.breakdown.map((b, i) => <div key={i}><span>{b.label}</span><b>+{b.xp}</b></div>)}
      </div>
      {r.newBadges.map((b) => (
        <div key={b.id} className="gm-row"><Icon name={BADGE_ICON[b.id] || 'star'} scale={2} /> <span>New badge: {b.label}</span></div>
      ))}
      <div className="gm-row end"><button type="button" className="gm-btn small" onClick={() => g.setReward(null)}>OK</button></div>
    </div>
  );
}
