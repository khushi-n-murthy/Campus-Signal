// The "dossier" card (reference image 1): picture, stats, badges, recovery code.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import PxModal from './PxModal.jsx';
import { Avatar, Icon } from './Sprite.jsx';
import { XpBar } from './PlayerChip.jsx';
import { useGame, recoveryCode } from './GameContext.jsx';

export const BADGE_ICON = { 'first-scan': 'star', 'explorer-5': 'fog', 'explorer-15': 'crown', 'rex-spotter': 'bug', 'streak-3': 'bolt', 'rex-runner': 'trophy', reconnected: 'shield', 'level-5': 'crown' };

export default function ProfileCard() {
  const g = useGame();
  const p = g.player;
  const [showCode, setShowCode] = useState(false);
  const navigate = useNavigate();
  if (!p) return null;
  const close = () => g.setScreen(null);
  return (
    <PxModal title="Explorer profile" onClose={close} wide>
      <div className="gm-dossier">
        <div className="gm-dossier-head"><span>EXPLORER FILE</span><span>{p.team ? `TEAM ${p.team.toUpperCase()}` : 'NO TEAM'}</span></div>
        <div className="gm-dossier-main">
          <div className="gm-stage"><Avatar avatar={p.avatar} scale={4} idle label={p.nickname} /></div>
          <div>
            <h2 style={{ marginBottom: 4 }}>{p.nickname}</h2>
            <div className="gm-note">LV{p.level.level} {p.level.title}</div>
            <XpBar level={p.level} />
            <div className="gm-note" style={{ marginBottom: 8 }}>{p.level.next == null ? 'MAX LEVEL' : `${p.xp} / ${p.level.next} XP`}</div>
            <div className="gm-stats">
              <div><span>Scans</span><b>{p.scans}</b></div>
              <div><span>Rooms explored</span><b>{p.roomsExplored}</b></div>
              <div><span>Rex sightings</span><b>{p.rexSightings}</b></div>
              <div><span>Day streak</span><b>{p.streak}</b></div>
              <div><span>Best Rex run</span><b>{p.dinoBest} m</b></div>
            </div>
          </div>
        </div>
        <h3>Badges</h3>
        <div className="gm-badges">
          {p.allBadges.map((b) => (
            <span key={b.id} className={`gm-badge ${b.got ? '' : 'off'}`} title={b.label} aria-label={`${b.label}${b.got ? '' : ' (locked)'}`}>
              <Icon name={BADGE_ICON[b.id] || 'star'} scale={2} />
            </span>
          ))}
        </div>
        <div className="gm-row">
          <button type="button" className="gm-btn small" onClick={() => g.setScreen('edit')}>Change look</button>
          <button type="button" className="gm-btn small ghost" onClick={() => setShowCode((v) => !v)}>{showCode ? 'Hide code' : 'Recovery code'}</button>
          <button type="button" className="gm-btn small ok" onClick={() => { close(); navigate('/play'); }}>Missions</button>
          <button type="button" className="gm-btn small ghost" onClick={close}>Close</button>
        </div>
        {showCode && (
          <p className="gm-note">Keep this private. Anyone with it can use your explorer.<br /><code style={{ color: 'var(--yellow)', wordBreak: 'break-all' }}>{recoveryCode()}</code></p>
        )}
      </div>
    </PxModal>
  );
}
