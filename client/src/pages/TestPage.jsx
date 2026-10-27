// Opened by scanning a room's QR code: /t/<roomId>. Runs the 10-second test and saves it.
import { useState } from 'react';
import { Link } from 'react-router';
import { postJSON } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { deviceId } from '../lib/storage.js';
import { runSpeedTest } from '../lib/speedtest.js';
import { scoreHex, scoreWord } from '../lib/colors.js';
import { ScoreBadge } from '../components/Bits.jsx';

const PHASES = { ping: 'Measuring delay', download: 'Downloading', upload: 'Uploading', saving: 'Saving' };
const ORDER = ['ping', 'download', 'upload', 'saving'];

function Ring({ fraction, color }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="ring" aria-hidden="true">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fraction)} transform="rotate(-90 60 60)" />
    </svg>
  );
}

export function TestPage({ roomId }) {
  const id = (roomId || '').toUpperCase();
  const room = useApi(`/api/rooms/${encodeURIComponent(id)}`);
  const who = useApi('/api/whoami');
  const [status, setStatus] = useState({ step: 'idle' });

  async function start() {
    setStatus({ step: 'running', phase: 'ping', fraction: 0, text: '' });
    try {
      const result = await runSpeedTest(({ phase, fraction, text }) => setStatus({ step: 'running', phase, fraction, text }));
      setStatus({ step: 'running', phase: 'saving', fraction: 1, text: '' });
      const saved = await postJSON('/api/measurements', { roomId: id, device: deviceId(), ...result });
      setStatus({ step: 'done', saved });
    } catch (err) {
      setStatus({ step: 'error', message: err.message });
    }
  }

  if (room.error) {
    return (
      <main className="page">
        <h1>Room not found</h1>
        <p>This QR code points at "{id}", which is not in the campus map. Tell the team that runs CampusSignal.</p>
        <Link to="/">Open the campus map</Link>
      </main>
    );
  }
  const r = room.data;
  const overall = status.step === 'running' ? (ORDER.indexOf(status.phase) + status.fraction) / ORDER.length : status.step === 'done' ? 1 : 0;
  return (
    <main className="page test">
      <p className="eyebrow">CampusSignal · room test</p>
      <h1>{r ? r.name : '…'}</h1>
      <p className="muted">{r ? `${r.building?.name ?? r.buildingId} · Floor ${r.floor}` : ''}</p>
      <p className="who">
        You are on <b>{who.data ? who.data.carrier : '…'}</b>
        {who.data?.carrier === 'Local network' && <span className="muted small"> (testing on the same network as the server)</span>}
      </p>

      <div className="dial">
        <Ring fraction={overall} color={status.step === 'done' ? scoreHex(status.saved.score) : '#4f7dff'} />
        <div className="dial-text">
          {status.step === 'idle' && (
            <button type="button" className="go" onClick={start} disabled={!r}>
              Start
            </button>
          )}
          {status.step === 'running' && (
            <>
              <b>{PHASES[status.phase]}</b>
              <span>{status.text}</span>
            </>
          )}
          {status.step === 'done' && (
            <>
              <ScoreBadge score={status.saved.score} big />
              <span>{scoreWord(status.saved.score)}</span>
            </>
          )}
          {status.step === 'error' && <b>Not saved</b>}
        </div>
      </div>

      {status.step === 'done' && (
        <section className="result">
          <div className="metrics big">
            <span>↓ {status.saved.downMbps} Mbps</span>
            <span>↑ {status.saved.upMbps} Mbps</span>
            <span>{status.saved.latencyMs ?? '–'} ms delay</span>
            <span>{status.saved.jitterMs ?? '–'} ms jitter</span>
            <span>{status.saved.lossPct}% loss</span>
          </div>
          <p>
            Saved for <b>{status.saved.carrier}</b> in this room. Thank you!
          </p>
          <Link className="button" to={`/r/${encodeURIComponent(id)}`}>
            See this room in 3D
          </Link>
        </section>
      )}
      {status.step === 'error' && (
        <section className="result">
          <p className="error">{status.message}</p>
          <button type="button" className="button" onClick={() => setStatus({ step: 'idle' })}>
            Try again
          </button>
        </section>
      )}
      <p className="fineprint">
        Uses up to about 25 MB of data. Saves only the speed numbers, this room, the time, your network's name and a random
        phone id. No name, number or IP address is stored.
      </p>
    </main>
  );
}
