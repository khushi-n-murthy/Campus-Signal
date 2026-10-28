// Side panel for the CSE walk-through: floor + view switches, live "signal where you stand",
// and the rooms on this floor.
import { Link } from 'react-router';
import { scoreHex, scoreWord } from '../lib/colors.js';
import { CS, pickScore, roomsOnFloor } from '../scenes/csLayout.js';
import { Legend, NetLink, ScoreBadge } from './Bits.jsx';
import RoomGameBox from '../game/RoomGameBox.jsx'; // GAME

export function InteriorPanel({ name, floor, setFloor, mode, setMode, here, roomScores, details, net, onGo, practice }) {
  const rooms = roomsOnFloor(floor);
  const scores = here?.scores || {};
  const rows = Object.entries(scores)
    .filter(([c]) => net === 'All' || c === net)
    .sort((a, b) => b[1] - a[1]);
  const room = here?.room || null;
  const roomName = room ? details[room.id]?.name || room.label : null;

  return (
    <aside className="panel interior">
      <h2>{name}</h2>
      <p className="muted small">
        You're inside · Floor {floor} · {roomName || 'Corridor'}
      </p>

      <div className="switch-row">
        <div className="chips" role="group" aria-label="Floor">
          {Array.from({ length: CS.floors }, (_, f) => CS.floors - 1 - f).map((f) => (
            <button key={f} type="button" className={f === floor ? 'chip on' : 'chip'} onClick={() => setFloor(f)}>
              Floor {f}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="View">
          <button type="button" className={mode === 'walk' ? 'chip on' : 'chip'} onClick={() => setMode('walk')}>
            Walk
          </button>
          <button type="button" className={mode === 'plan' ? 'chip on' : 'chip'} onClick={() => setMode('plan')}>
            Floor plan
          </button>
        </div>
      </div>

      <h3>Signal where you're standing</h3>
      {rows.length === 0 ? (
        <p className="muted small">No tests on this floor yet. Run a test in any room to light up the map.</p>
      ) : (
        <div className="here">
          {rows.map(([carrier, s]) => (
            <div key={carrier} className="here-row" style={{ '--c': scoreHex(s), '--s': s }}>
              <span className="here-name">{carrier}</span>
              <span className="here-word">{scoreWord(s)}</span>
              <b className="here-score">{s}</b>
              <i className="here-meter" />
            </div>
          ))}
        </div>
      )}
      <p className="muted small here-note">
        {room ? 'Measured in this room.' : 'Blended from the rooms nearest you.'} The floor colour shows {net === 'All' ? 'the best network' : net} at each spot.
      </p>
      {room && (
        <div className="row gap">
          <Link className="button small" to={`/t/${room.id}`}>
            Test here
          </Link>
          <NetLink className="button small ghost" to={`/r/${room.id}`}>
            Open room
          </NetLink>
        </div>
      )}
      {room && <RoomGameBox roomId={room.id} roomName={roomName} />} {/* GAME: the room you're standing in */}

      <h3>Rooms on floor {floor}</h3>
      {rooms.map((r) => {
        const s = pickScore(roomScores[r.id], net);
        return (
          <button key={r.id} type="button" className={room?.id === r.id ? 'list-row here-room' : 'list-row'} onClick={() => onGo(r.id)}>
            <span>
              <b>{details[r.id]?.name || `${r.label} ${r.id.slice(4)}`}</b>
              <span className="muted small"> · walk there</span>
            </span>
            <ScoreBadge score={s} />
          </button>
        );
      })}

      <details className="howto" open>
        <summary>How to move around</summary>
        <ul>
          <li><b>Look</b>: drag on the view.</li>
          <li><b>Walk</b>: W A S D or the arrow keys (hold Shift to hurry).</li>
          <li><b>Go somewhere</b>: click or tap the floor, or pick a room above.</li>
          <li><b>Change floor</b>: use the floor buttons (stairs and lift are at the west end).</li>
        </ul>
      </details>
      <Legend inline practice={practice} />
    </aside>
  );
}
