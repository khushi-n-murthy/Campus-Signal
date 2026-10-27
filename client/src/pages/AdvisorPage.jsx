// SIM Advisor: enter your weekly timetable once, get the network that works best where you actually sit.
import { useState } from 'react';
import { postJSON } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { load, save } from '../lib/storage.js';
import { ScoreBadge } from '../components/Bits.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

export function AdvisorPage() {
  const rooms = useApi('/api/rooms');
  const [slots, setSlots] = useState(() => {
    const saved = load('cs-timetable', null);
    return Array.isArray(saved) && saved.length ? saved : [{ dow: 1, hour: 9, roomId: '' }];
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const update = (next) => {
    setSlots(next);
    save('cs-timetable', next);
  };
  const setSlot = (i, patch) => update(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function ask() {
    setError(null);
    try {
      setResult(await postJSON('/api/advisor', { slots: slots.filter((s) => s.roomId) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page wide">
      <p className="eyebrow">CampusSignal</p>
      <h1>SIM Advisor</h1>
      <p className="muted">Add the rooms you sit in each week. We compare every network at those exact rooms and hours.</p>
      <table className="slots">
        <thead>
          <tr><th>Day</th><th>Hour</th><th>Room</th><th /></tr>
        </thead>
        <tbody>
          {slots.map((s, i) => (
            <tr key={i}>
              <td>
                <select value={s.dow} onChange={(e) => setSlot(i, { dow: Number(e.target.value) })}>
                  {DAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}
                </select>
              </td>
              <td>
                <select value={s.hour} onChange={(e) => setSlot(i, { hour: Number(e.target.value) })}>
                  {HOURS.map((h) => <option key={h} value={h}>{`${h}:00`}</option>)}
                </select>
              </td>
              <td>
                <select value={s.roomId} onChange={(e) => setSlot(i, { roomId: e.target.value })}>
                  <option value="">Choose room…</option>
                  {(rooms.data || []).map((r) => <option key={r._id} value={r._id}>{`${r.name} (${r._id})`}</option>)}
                </select>
              </td>
              <td>
                <button type="button" className="link" onClick={() => update(slots.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row gap">
        <button type="button" className="button ghost" onClick={() => update([...slots, { ...(slots[slots.length - 1] || { dow: 1, hour: 9, roomId: '' }) }])}>
          + Add class
        </button>
        <button type="button" className="button" onClick={ask} disabled={!slots.some((s) => s.roomId)}>
          Find my best network
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <section className="result">
          {result.recommendation ? (
            <h2>
              Best for your week: <span className="accent">{result.recommendation}</span>
            </h2>
          ) : (
            <h2>No tests in these rooms yet</h2>
          )}
          <p className="muted">
            Wins per network: {Object.entries(result.wins).map(([c, n]) => `${c} ${n}`).join(' · ') || '—'} (out of {result.slots.length} classes,
            {' '}{result.slotsWithData} with data)
          </p>
          <table className="slots">
            <thead>
              <tr><th>When</th><th>Room</th><th>Best</th><th>Based on</th></tr>
            </thead>
            <tbody>
              {result.slots.map((s, i) => (
                <tr key={i}>
                  <td>{`${DAYS[s.dow]} ${s.hour}:00`}</td>
                  <td>{s.roomId}</td>
                  <td>{s.best ? <>{s.best} <ScoreBadge score={s.scores[s.best].score} /></> : 'no data'}</td>
                  <td className="muted small">{s.best ? `${s.scores[s.best].basis}, ${s.scores[s.best].samples} tests` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
