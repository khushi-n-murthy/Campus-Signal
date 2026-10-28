// Everything 3D: the canvas, the campus/building/room scenes and their side panels.
// Loaded on demand (React.lazy) so the QR test page does not have to download three.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApi } from './lib/useApi.js';
import { useLive, useLiveVersion } from './lib/live.jsx';
import { withNet } from './lib/api.js';
import { scoreWord } from './lib/colors.js';
import { Stage } from './scenes/Stage.jsx';
import { CampusWorld } from './scenes/CampusWorld.jsx';
import { CSInterior } from './scenes/CSInterior.jsx';
import { CS, roomsOnFloor } from './scenes/csLayout.js';
import { InteriorPanel } from './components/InteriorPanel.jsx';
import { useRoomScores } from './lib/useRoomScores.js';
import { RoomInterior } from './scenes/RoomInterior.jsx';
import { roomSize } from './scenes/layout.js';
import { RoomCamera } from './scenes/RoomCamera.jsx';
import { PanelAwareView } from './scenes/SceneLook.jsx';
import { LabelLayerContext } from './scenes/Label.jsx';
import { Legend, NetLink, NetworkCard, NetworkFilter, ScoreBadge } from './components/Bits.jsx';
import { ForecastStrip } from './components/ForecastStrip.jsx';
import PlayerChip from './game/PlayerChip.jsx'; // GAME
import RoomGameBox from './game/RoomGameBox.jsx'; // GAME
import CampusGameBox from './game/CampusGameBox.jsx'; // GAME
import LiveFeed from './game/LiveFeed.jsx'; // GAME

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function TopBar({ view, building, room }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="dot" /> CampusSignal
      </Link>
      <nav className="crumbs" aria-label="Breadcrumb">
        <NetLink to="/">Campus</NetLink>
        {(view.kind === 'building' || view.kind === 'room') && building && (
          <>
            <span>›</span>
            <NetLink to={`/b/${building._id}`}>{building.name}</NetLink>
          </>
        )}
        {view.kind === 'room' && room && (
          <>
            <span>›</span>
            <span>{room.name}</span>
          </>
        )}
      </nav>
      <NetworkFilter />
      <div className="actions">
        <PlayerChip /> {/* GAME */}
        <Link to="/test" className="button small">I'm here: test</Link>
        <Link to="/advisor" className="link">SIM Advisor</Link>
        <Link to="/admin" className="link">IT report</Link>
      </div>
    </header>
  );
}

function CampusPanel({ campus, practice }) {
  const sorted = [...campus].sort((a, b) => (b.headline.score ?? -1) - (a.headline.score ?? -1));
  return (
    <aside className="panel">
      <h2>Campus</h2>
      <p className="muted small">Tap a building to open its floors.</p>
      <CampusGameBox /> {/* GAME */}
      {sorted.map((b) => (
        <NetLink key={b._id} to={`/b/${b._id}`} className="list-row">
          <span>
            <b>{b.name}</b>
            <span className="muted small"> · {plural(b.floors, 'floor')} · {plural(b.rooms, 'room')}</span>
          </span>
          <ScoreBadge score={b.headline.score} />
        </NetLink>
      ))}
      <Legend inline practice={practice} />
    </aside>
  );
}

function BuildingPanel({ detail, practice }) {
  return (
    <aside className="panel">
      <h2>{detail.name}</h2>
      <p className="muted small">
        Best network here: {detail.headline.carrier ?? '—'} · {scoreWord(detail.headline.score)}
      </p>
      {[...detail.floorsDetail].reverse().map((f) => (
        <div key={f.floor} className="floor-block">
          <h3>Floor {f.floor}</h3>
          <div className="room-chips">
            {f.rooms.map((r) => (
              <NetLink key={r._id} to={`/r/${r._id}`} className="room-chip">
                {r.name} <ScoreBadge score={r.headline.score} />
              </NetLink>
            ))}
            {f.rooms.length === 0 && <span className="muted small">No rooms mapped</span>}
          </div>
        </div>
      ))}
      <Legend inline practice={practice} />
    </aside>
  );
}

function RoomPanel({ room, forecast, shown, practice }) {
  return (
    <aside className="panel">
      <h2>{room.name}</h2>
      <p className="muted small">
        {room.building?.name} · Floor {room.floor} · {room.totalSamples} tests in the last {room.windowDays} days
      </p>
      <Link to={`/t/${room._id}`} className="button">I'm in this room: test now</Link>
      <RoomGameBox roomId={room._id} roomName={room.name} /> {/* GAME */}
      {room.networks.length === 0 && <p>No tests here yet. Be the first!</p>}
      {room.networks.map((n) => (
        <NetworkCard key={n.carrier} n={n} />
      ))}
      <h3>Network forecast</h3>
      <ForecastStrip hours={forecast?.hours} />
      <details className="howto">
        <summary>How to read the light streams</summary>
        <ul>
          <li><b>Colour and glow</b>: score, blue is strong, red is a dead zone.</li>
          <li><b>Speed</b>: download Mbps. Fast particles = fast network.</li>
          <li><b>Wobble</b>: jitter. Shaky streams = unsteady calls and games.</li>
          <li><b>Particles vanishing mid-air</b>: packet loss.</li>
          <li><b>Faint streams</b>: few tests so far, so less certain.</li>
        </ul>
        <p className="muted small">Showing: {shown.join(', ') || 'nothing yet'}. Without router positions, streams are a picture of measured quality, not real radio waves.</p>
      </details>
      <Legend inline practice={practice} />
    </aside>
  );
}

export default function ThreeView({ view, net, lite }) {
  const navigate = useNavigate();
  const { last } = useLive();
  const [pulses, setPulses] = useState({});
  const labelLayer = useRef(null);
  useEffect(() => {
    if (last) setPulses((p) => ({ ...p, [last.roomId]: last.receivedAt }));
  }, [last]);

  const campusVersion = useLiveVersion(() => true);
  const buildingId = view.kind === 'building' ? view.id : null;
  const roomId = view.kind === 'room' ? view.id : null;
  const buildingVersion = useLiveVersion((e) => e.buildingId === buildingId);
  const roomVersion = useLiveVersion((e) => e.roomId === roomId);

  const campus = useApi(withNet('/api/campus', net), campusVersion);
  const building = useApi(buildingId ? withNet(`/api/buildings/${encodeURIComponent(buildingId)}`, net) : null, buildingVersion);
  const room = useApi(roomId ? `/api/rooms/${encodeURIComponent(roomId)}` : null, roomVersion);
  const forecast = useApi(roomId ? `/api/rooms/${encodeURIComponent(roomId)}/forecast` : null, roomVersion);
  const health = useApi('/api/health');

  const roomBuilding = room.data?.building || null;
  const shownNetworks = useMemo(() => {
    const all = room.data?.networks || [];
    const real = all.filter((n) => n.carrier !== 'Local network'); // 'Local network' only appears while testing at home
    return net === 'All' ? real.slice(0, 4) : real.filter((n) => n.carrier === net);
  }, [room.data, net]);

  // CSE has a walk-through interior instead of the exploded-floors view.
  const isCS = buildingId === CS.id;
  const [csFloor, setCsFloor] = useState(0);
  const [csMode, setCsMode] = useState('walk');
  const [csHere, setCsHere] = useState(null);
  const [csGoto, setCsGoto] = useState(null);
  const csIds = useMemo(() => (isCS ? roomsOnFloor(csFloor).map((r) => r.id) : []), [isCS, csFloor]);
  const csRooms = useRoomScores(csIds, buildingVersion);

  const error = campus.error || building.error || room.error;
  const go = (path) => navigate(net === 'All' ? path : `${path}?net=${encodeURIComponent(net)}`);

  return (
    <>
      <div className="canvas-wrap">
        {/* key: switching lite mode rebuilds the canvas so renderer settings take effect */}
        <LabelLayerContext.Provider value={labelLayer}>
        <Stage key={lite ? 'lite' : 'full'} lite={lite}>
          {view.kind === 'room' && room.data ? (
            <>
              <RoomInterior room={room.data} networks={shownNetworks} lite={lite} />
              <RoomCamera {...roomSize(room.data)} roomId={room.data._id} />
            </>
          ) : isCS && building.data ? (
            <CSInterior
              footprint={building.data.footprint}
              floor={csFloor}
              mode={csMode}
              roomScores={csRooms.scores}
              net={net}
              lite={lite}
              onHere={setCsHere}
              onRoom={(id) => go(`/r/${id}`)}
              gotoRoom={csGoto}
            />
          ) : view.kind !== 'room' && campus.data ? (
            <CampusWorld
              buildings={campus.data}
              selected={buildingId}
              detail={building.data}
              pulses={pulses}
              lite={lite}
              onSelect={(id) => go(`/b/${id}`)}
              onRoom={(id) => go(`/r/${id}`)}
            />
          ) : null}
          <PanelAwareView panelOpen />
        </Stage>
        </LabelLayerContext.Provider>
        <div className="label-layer" ref={labelLayer} />
      </div>
      <TopBar view={view} building={view.kind === 'room' ? roomBuilding : building.data} room={room.data} />
      {error && <div className="toast error">{error.status === 404 ? 'That place is not on the map.' : error.message}</div>}
      {view.kind === 'campus' && campus.data && <CampusPanel campus={campus.data} practice={health.data?.practiceData} />}
      {view.kind === 'building' && building.data && !isCS && <BuildingPanel detail={building.data} practice={health.data?.practiceData} />}
      {isCS && building.data && (
        <InteriorPanel
          name={building.data.name}
          floor={csFloor}
          setFloor={(f) => {
            setCsFloor(f);
            setCsGoto(null);
          }}
          mode={csMode}
          setMode={setCsMode}
          here={csHere}
          roomScores={csRooms.scores}
          details={csRooms.details}
          net={net}
          onGo={(id) => setCsGoto({ id, at: Date.now() })}
          practice={health.data?.practiceData}
        />
      )}
      {isCS && csMode === 'walk' && <div className="walk-hint">Drag to look · W A S D to walk · click the floor to go there</div>}
      {view.kind === 'room' && room.data && <RoomPanel room={room.data} forecast={forecast.data} shown={shownNetworks.map((n) => n.carrier)} practice={health.data?.practiceData} />}
      <Legend practice={health.data?.practiceData} />
      <LiveFeed /> {/* GAME */}
    </>
  );
}
