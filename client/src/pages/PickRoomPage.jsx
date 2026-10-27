// "I'm here now" without a QR code: choose building -> floor -> room, then run the test.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../lib/useApi.js';

export function PickRoomPage() {
  const rooms = useApi('/api/rooms');
  const campus = useApi('/api/campus');
  const navigate = useNavigate();
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const list = useMemo(() => rooms.data || [], [rooms.data]);
  const floors = useMemo(() => [...new Set(list.filter((r) => r.buildingId === building).map((r) => r.floor))].sort((a, b) => a - b), [list, building]);
  const choices = list.filter((r) => r.buildingId === building && String(r.floor) === floor);
  return (
    <main className="page">
      <p className="eyebrow">CampusSignal</p>
      <h1>Where are you?</h1>
      <p className="muted">Scanning the QR code on the wall is quickest. If there isn't one, pick the room here.</p>
      <label>
        Building
        <select value={building} onChange={(e) => { setBuilding(e.target.value); setFloor(''); }}>
          <option value="">Choose…</option>
          {(campus.data || []).map((b) => (
            <option key={b._id} value={b._id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label>
        Floor
        <select value={floor} onChange={(e) => setFloor(e.target.value)} disabled={!building}>
          <option value="">Choose…</option>
          {floors.map((f) => (
            <option key={f} value={String(f)}>Floor {f}</option>
          ))}
        </select>
      </label>
      <div className="room-list">
        {choices.map((r) => (
          <button key={r._id} type="button" className="button" onClick={() => navigate(`/t/${encodeURIComponent(r._id)}`)}>
            {r.name}
          </button>
        ))}
      </div>
    </main>
  );
}
