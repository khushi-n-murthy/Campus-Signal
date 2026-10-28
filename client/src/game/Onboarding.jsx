// First visit: PRESS START -> build your explorer -> done. Also used to edit the look later.
import { useState } from 'react';
import PxModal from './PxModal.jsx';
import CharacterCreator from './CharacterCreator.jsx';
import { Avatar, Rex } from './Sprite.jsx';
import { useGame, recoveryCode } from './GameContext.jsx';
import { PRESETS, normalizeAvatar, randomAvatar } from './pixel.js';

export default function Onboarding() {
  const g = useGame();
  const editing = g.screen === 'edit';
  const [step, setStep] = useState(editing ? 'create' : g.screen === 'create' ? 'create' : 'title');
  const [avatar, setAvatar] = useState(() => (editing && g.player ? normalizeAvatar(g.player.avatar) : randomAvatar()));
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [restoring, setRestoring] = useState(false);
  const close = () => g.setScreen(null);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editing) { await g.updateAvatar(avatar); close(); }
      else { await g.create({ nickname, avatar }); setStep('done'); }
    } catch (err) {
      setError(err.status == null ? 'Cannot reach the server. Check your connection and try again.' : err.message);
    } finally { setBusy(false); }
  }

  async function doRestore(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await g.restore(code); close(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (step === 'title') {
    return (
      <PxModal title="Welcome to CampusSignal" onClose={close}>
        <div className="gm-col" style={{ textAlign: 'center' }}>
          <div className="gm-title">SIGNAL<br />WARS</div>
          <div className="gm-row center" style={{ gap: 18 }}>
            <Avatar avatar={PRESETS[2].a} scale={3} idle />
            <Rex scale={4} frame="stand" />
            <Avatar avatar={PRESETS[1].a} scale={3} idle />
          </div>
          <p className="gm-note">Scan rooms, map the campus, find the dead zones, and outrun Rex.</p>
          <button type="button" className="gm-btn ok" data-autofocus onClick={() => setStep('create')}>Press start</button>
          {!restoring ? (
            <button type="button" className="link" onClick={() => setRestoring(true)}>I already have an explorer (use my code)</button>
          ) : (
            <form className="gm-field" onSubmit={doRestore}>
              <label htmlFor="rc">Recovery code</label>
              <input id="rc" type="text" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck="false" />
              <div className="gm-err" role="alert">{error}</div>
              <button type="submit" className="gm-btn small" disabled={busy}>Load explorer</button>
            </form>
          )}
          <button type="button" className="link" onClick={g.skipAsGuest}>Skip for now</button>
        </div>
      </PxModal>
    );
  }

  if (step === 'done') {
    const p = g.player;
    return (
      <PxModal title="Explorer created" onClose={close}>
        <div className="gm-col" style={{ textAlign: 'center' }}>
          <h2>Explorer ready!</h2>
          <div className="gm-row center"><Avatar avatar={p?.avatar || avatar} scale={4} idle /></div>
          <div className="gm-title" style={{ fontSize: 14 }}>{p?.nickname}</div>
          {p?.team && <div><span className="gm-team">TEAM {p.team.toUpperCase()}</span></div>}
          <p className="gm-note">Your team comes from your SIM network. Save this code to get your explorer back on another phone:</p>
          <code style={{ color: 'var(--yellow)', fontSize: 20, wordBreak: 'break-all' }}>{recoveryCode()}</code>
          <button type="button" className="gm-btn ok" data-autofocus onClick={close}>Start exploring</button>
        </div>
      </PxModal>
    );
  }

  return (
    <PxModal title={editing ? 'Change look' : 'Create your explorer'} onClose={close} wide>
      <form className="gm-col" onSubmit={submit}>
        <h2>{editing ? 'Change your look' : 'Create your explorer'}</h2>
        {!editing && (
          <div className="gm-field">
            <label htmlFor="nick">Nickname (3-16 letters, numbers, _)</label>
            <input id="nick" type="text" data-autofocus value={nickname} maxLength={16} onChange={(e) => setNickname(e.target.value)} autoComplete="off" spellCheck="false" required minLength={3} />
          </div>
        )}
        <CharacterCreator avatar={avatar} onChange={setAvatar} />
        <div className="gm-err" role="alert">{error}</div>
        <div className="gm-row end">
          <button type="button" className="gm-btn ghost small" onClick={close}>Cancel</button>
          <button type="submit" className="gm-btn ok" disabled={busy || (!editing && nickname.trim().length < 3)}>{editing ? 'Save' : 'Confirm'}</button>
        </div>
      </form>
    </PxModal>
  );
}
