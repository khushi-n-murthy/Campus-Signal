// Rex's Lair: a runner where the track comes from the room's real network numbers.
// Controls: Space / Up / tap = jump, Down / hold = duck. Works offline once loaded.
import { useCallback, useEffect, useRef, useState } from 'react';
import PxModal from './PxModal.jsx';
import { useGame } from './GameContext.jsx';
import { postJSON } from '../lib/api.js';
import { deviceId, load, save } from '../lib/storage.js';
import { rexCanvas, iconCanvas } from './pixel.js';
import * as E from './dinoEngine.js';

const QUEUE_KEY = 'cs-run-queue';

// Runs finished with no connection wait here and are sent when the phone is back online.
export async function flushRunQueue(onReward) {
  const queue = load(QUEUE_KEY, []);
  if (!queue.length) return;
  const left = [];
  for (const run of queue) {
    try {
      const out = await postJSON('/api/game/runs', { ...run, device: deviceId() });
      onReward?.(out);
    } catch (err) {
      if (err.status == null || err.status >= 500) left.push(run); // keep only if it might work later
    }
  }
  save(QUEUE_KEY, left);
}

function draw(ctx, g, frameTick, dead) {
  const { H, GROUND } = E; const W = ctx.canvas.width;
  ctx.fillStyle = '#061046'; ctx.fillRect(0, 0, W, H);
  // stars scroll slowly
  ctx.fillStyle = '#2f6bff';
  for (let i = 0; i < 18; i++) { const x = ((i * 97 - g.x * 0.1) % W + W) % W; ctx.fillRect(Math.floor(x), 10 + ((i * 37) % 60), 2, 2); }
  // ground
  const gy = H - (H - GROUND) ;
  ctx.fillStyle = '#2de2ff'; ctx.fillRect(0, gy, W, 2);
  ctx.fillStyle = '#2f6bff';
  for (let i = 0; i < 24; i++) { const x = ((i * 53 - g.x) % W + W) % W; ctx.fillRect(Math.floor(x), gy + 6 + (i % 3) * 6, 10 + (i % 4) * 4, 2); }
  // obstacles
  for (const o of g.obstacles) {
    const sx = Math.floor(o.x - g.x), sy = gy - o.h - o.y;
    if (o.kind === 'cactus') {
      const c = iconCanvas(o.h > 20 ? 'cactus' : 'cactusLow');
      ctx.drawImage(c, sx - 1, gy - c.height + 1 - o.y);
    } else {
      const c = iconCanvas(Math.floor(o.flap) % 2 ? 'bug' : 'bug2');
      ctx.drawImage(c, sx - 1, sy - 1);
    }
  }
  // Rex
  const d = g.dino;
  const air = d.y > 0;
  const frame = air ? 'stand' : Math.floor(frameTick / 5) % 2 ? 'a' : 'b';
  const rx = rexCanvas(dead ? 'stand' : frame, dead);
  const duck = d.ducking && !air;
  const h = duck ? Math.round(rx.height * 0.62) : rx.height;
  ctx.drawImage(rx, 0, 0, rx.width, rx.height, E.DINO_X - 2, Math.round(gy - h - d.y + 1), rx.width, h);
}

export default function DinoRun({ roomId, roomName, stats, onClose, kind = 'manual', reason = '' }) {
  const game = useGame();
  const viewW = typeof window !== 'undefined' && window.innerWidth < 640 ? 440 : E.W; // narrower view on phones so the dino stays big
  const canvas = useRef(null);
  const state = useRef(null);
  const tick = useRef(0);
  const [phase, setPhase] = useState('ready'); // ready | run | over
  const [meters, setMeters] = useState(0);
  const [result, setResult] = useState(null);
  const [sync, setSync] = useState('');
  const eventId = useRef(null);
  const played = useRef(false);
  const [best, setBest] = useState(() => load('cs-dino-best', 0));

  // Count every time Rex opens (also for guests), so we know how often a room sends people here.
  useEffect(() => {
    if (navigator.onLine === false) return;
    postJSON('/api/game/rex-open', { device: deviceId(), roomId: roomId || undefined, kind })
      .then((out) => { eventId.current = out.id; }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const end = useCallback(() => {
    if (eventId.current) postJSON('/api/game/rex-close', { device: deviceId(), id: eventId.current, played: played.current }).catch(() => {});
    onClose();
  }, [onClose]);

  const start = useCallback(() => {
    played.current = true;
    state.current = E.createGame({ seed: E.hashSeed(`${roomId || 'lair'}:${Date.now() >> 12}`), stats, viewW: viewW });
    setResult(null); setSync(''); setMeters(0); setPhase('run');
  }, [roomId, stats, viewW]);

  const finish = useCallback(async (g) => {
    const run = E.runResult(g, roomId);
    setPhase('over');
    setResult({ ...run, cause: g.cause });
    if (run.distance > best) { setBest(run.distance); save('cs-dino-best', run.distance); }
    if (!game.player) { setSync('guest'); return; }
    if (run.distance < 10) { setSync('short'); return; }
    try {
      const out = await postJSON('/api/game/runs', { ...run, device: deviceId() });
      game.applyReward(out.reward);
      setSync({ ok: true, isRecord: out.isRecord, personalBest: out.personalBest, record: out.record, xp: out.reward.xp });
    } catch (err) {
      if (err.status == null || err.status >= 500) {
        save(QUEUE_KEY, [...load(QUEUE_KEY, []), run].slice(-10));
        setSync('queued');
      } else setSync({ error: err.message });
    }
  }, [roomId, game, best]);

  // input
  useEffect(() => {
    const down = (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (phase === 'run') E.press(state.current, 'jump'); else if (!e.repeat) start(); }
      if (['ArrowDown', 'KeyS'].includes(e.code) && phase === 'run') { e.preventDefault(); E.press(state.current, 'duckStart'); }
    };
    const up = (e) => { if (['ArrowDown', 'KeyS'].includes(e.code) && state.current) E.press(state.current, 'duckEnd'); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [phase, start]);

  // loop
  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    let raf, last = performance.now(), shown = -1;
    const frame = (now) => {
      const g = state.current;
      if (g) {
        if (phase === 'run') {
          E.step(g, (now - last) / 1000); tick.current++;
          const m = E.distanceM(g);
          if (m !== shown) { shown = m; setMeters(m); }
          if (g.over) finish(g);
        }
        draw(ctx, g, tick.current, phase === 'over' && !g.won);
      } else {
        draw(ctx, E.createGame({ seed: 1, stats, viewW }), 0, false);
      }
      last = now; raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish, stats, viewW]);

  const tap = () => { if (phase === 'run') E.press(state.current, 'jump'); else start(); };

  return (
    <PxModal title="Rex's Lair" onClose={end} wide tone="dino">
      <div className="gm-dino-wrap">
        <h2>Rex's Lair{roomName ? `: ${roomName}` : ''}</h2>
        {reason && <p className="gm-err" style={{ color: 'var(--yellow)' }}>{reason}</p>}
        <p className="gm-note">The track is built from this room's real numbers: more packet loss means more cacti, more jitter means more bugs. Reach 1000 m to reconnect!</p>
        <div className="gm-hud"><span>{meters} m</span><span>BEST {best} m</span></div>
        <canvas ref={canvas} width={viewW} height={E.H} onPointerDown={tap} aria-label="Rex runner game. Press space or tap to jump, down arrow to duck." role="img" />
        <div className="gm-row center">
          <button type="button" className="gm-btn" onPointerDown={(e) => { e.preventDefault(); tap(); }}>Jump</button>
          <button type="button" className="gm-btn ghost" onPointerDown={(e) => { e.preventDefault(); if (phase === 'run') E.press(state.current, 'duckStart'); }} onPointerUp={() => state.current && E.press(state.current, 'duckEnd')} onPointerLeave={() => state.current && E.press(state.current, 'duckEnd')}>Duck</button>
        </div>
        {phase === 'ready' && <div className="gm-press">PRESS SPACE OR TAP TO START</div>}
        {phase === 'over' && result && (
          <div className="gm-box" role="status">
            <h3>{result.won ? 'RECONNECTED!' : `Rex tripped on a ${result.cause === 'bug' ? 'bug' : 'cactus'}`}</h3>
            <div className="gm-stats"><div><span>Distance</span><b>{result.distance} m</b></div></div>
            {sync === 'guest' && <p className="gm-note">Make an explorer to earn XP and records.</p>}
            {sync === 'short' && <p className="gm-note">Run at least 10 m to count.</p>}
            {sync === 'queued' && <p className="gm-note">You're offline. This run will be saved when you reconnect.</p>}
            {sync?.error && <p className="gm-err">{sync.error}</p>}
            {sync?.ok && (
              <>
                <p>+{sync.xp} XP{sync.isRecord ? ' · NEW ROOM RECORD!' : sync.personalBest ? ' · your best here' : ''}</p>
                {sync.record && <p className="gm-note">Room record: {sync.record.nickname}, {sync.record.distance} m</p>}
              </>
            )}
            <div className="gm-row"><button type="button" className="gm-btn ok" onClick={start}>Run again</button><button type="button" className="gm-btn ghost" onClick={end}>End game</button></div>
          </div>
        )}
        {phase !== 'over' && <div className="gm-row end"><button type="button" className="gm-btn pink" onClick={end}>End game</button></div>}
      </div>
    </PxModal>
  );
}
