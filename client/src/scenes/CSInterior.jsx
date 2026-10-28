// Walk-through of the CSE Dept: one floor at a time, furnished with the Kenney kit, with a signal
// heatmap on the floor built from each room's measured tests. Two modes:
//   walk  — first person at eye height: drag to look, WASD/arrows to move, click the floor to go there
//   plan  — dollhouse view of the floor from above; click the floor to move your marker
// Positions are building-local metres (see csLayout.js); the whole floor sits on the CSE footprint.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Color, LinearFilter, SRGBColorSpace, Vector3 } from 'three';
import { scoreHex } from '../lib/colors.js';
import { Furniture } from './Furniture.jsx';
import { Label } from './Label.jsx';
import { SceneLook } from './SceneLook.jsx';
import { CeilingFan, Clock, TILE_TEXTURE, TubeLight, Wall, Whiteboard, Window } from './RoomInterior.jsx';
import { CORRIDOR, CS, START, pickScore, roomAt, roomFurniture, roomSpot, roomsOnFloor, signalAt, walkable } from './csLayout.js';

const ACTION = { NONE: 0, ROTATE: 1, TRUCK: 2, DOLLY: 16, TOUCH_ROTATE: 64, TOUCH_TRUCK: 128, TOUCH_DOLLY_TRUCK: 4096 };
const DESK_TOP = 0.71; // Kenney desk at real scale
const WALL_C = '#8e9aaa';
const DADO_C = '#4b5667';

// Where you were on each floor, so coming back (e.g. from a room's detail page) resumes there.
const lastSpot = new Map();

// ---------- building shell ----------
function Partition({ x, z0, z1 }) {
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  return (
    <group position={[x, 0, zc]}>
      <mesh position={[0, CS.ceiling / 2, 0]} receiveShadow>
        <boxGeometry args={[CS.wall, CS.ceiling, len]} />
        <meshStandardMaterial color={WALL_C} roughness={0.92} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (CS.wall / 2 + 0.01), 0.5, 0]}>
            <boxGeometry args={[0.02, 1.0, len]} />
            <meshStandardMaterial color={DADO_C} roughness={0.7} />
          </mesh>
          <mesh position={[s * (CS.wall / 2 + 0.02), 0.06, 0]}>
            <boxGeometry args={[0.03, 0.12, len]} />
            <meshStandardMaterial color="#2b3240" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Corridor wall (z 7.4..7.6) with a doorway per room: wall segments, lintels, frames, an open door.
function CorridorWall({ rooms }) {
  const z = CS.roomDepth + CS.wall / 2;
  const doorH = 2.15;
  const segs = [];
  let x = CS.coreW;
  for (const r of rooms) {
    const a = r.door.x - r.door.w / 2;
    segs.push([x, a]);
    x = r.door.x + r.door.w / 2;
  }
  segs.push([x, CS.W]);
  return (
    <group>
      {segs.map(([a, b]) => (
        <group key={a} position={[(a + b) / 2, 0, z]}>
          <mesh position={[0, CS.ceiling / 2, 0]} receiveShadow>
            <boxGeometry args={[b - a, CS.ceiling, CS.wall]} />
            <meshStandardMaterial color={WALL_C} roughness={0.92} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0.5, s * (CS.wall / 2 + 0.01)]}>
              <boxGeometry args={[b - a, 1.0, 0.02]} />
              <meshStandardMaterial color={DADO_C} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      {rooms.map((r) => (
        <group key={r.id} position={[r.door.x, 0, z]}>
          {/* lintel above the doorway */}
          <mesh position={[0, (doorH + CS.ceiling) / 2, 0]}>
            <boxGeometry args={[r.door.w, CS.ceiling - doorH, CS.wall]} />
            <meshStandardMaterial color={WALL_C} roughness={0.92} />
          </mesh>
          {/* frame */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * (r.door.w + 0.06)) / 2, doorH / 2, 0]}>
              <boxGeometry args={[0.06, doorH, CS.wall + 0.04]} />
              <meshStandardMaterial color="#e3e5e8" roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, doorH + 0.03, 0]}>
            <boxGeometry args={[r.door.w + 0.12, 0.06, CS.wall + 0.04]} />
            <meshStandardMaterial color="#e3e5e8" roughness={0.5} />
          </mesh>
          {/* door leaf, swung open into the room */}
          <group position={[r.door.w / 2, 0, -CS.wall / 2]} rotation={[0, -1.35, 0]}>
            <mesh position={[-r.door.w / 2 + 0.03, doorH / 2 - 0.03, 0]} castShadow>
              <boxGeometry args={[r.door.w - 0.06, doorH - 0.06, 0.04]} />
              <meshStandardMaterial color="#6b4a32" roughness={0.55} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function Stairs() {
  const steps = 18;
  const run = 6.4 / steps;
  const rise = CS.ceiling / steps;
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => (
        <mesh key={i} position={[1.45, rise * (i + 0.5), CS.roomDepth - 0.4 - run * (i + 0.5)]} receiveShadow castShadow>
          <boxGeometry args={[2.2, rise, run]} />
          <meshStandardMaterial color={i % 2 ? '#9aa3ae' : '#a7b0ba'} roughness={0.6} />
        </mesh>
      ))}
      {/* stringer + handrail */}
      <mesh position={[2.6, CS.ceiling / 2 + 0.45, CS.roomDepth / 2 - 0.4]} rotation={[Math.atan2(CS.ceiling, 6.4), 0, 0]}>
        <boxGeometry args={[0.05, 0.05, Math.hypot(6.4, CS.ceiling)]} />
        <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 0.5) / 7;
        return (
          <mesh key={i} position={[2.6, CS.ceiling * t + 0.45 - 0.45, CS.roomDepth - 0.4 - 6.4 * t]}>
            <boxGeometry args={[0.03, 0.9, 0.03]} />
            <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

function Lift({ floor }) {
  return (
    <group position={[4.1, 0, 0]}>
      <mesh position={[0, CS.ceiling / 2, 0.9]}>
        <boxGeometry args={[2.6, CS.ceiling, 1.8]} />
        <meshStandardMaterial color="#6f7b8a" roughness={0.8} />
      </mesh>
      {[-0.42, 0.42].map((dx) => (
        <mesh key={dx} position={[dx, 1.05, 1.82]}>
          <boxGeometry args={[0.82, 2.1, 0.04]} />
          <meshStandardMaterial color="#c3cad2" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 1.82]}>
        <boxGeometry args={[0.5, 0.18, 0.02]} />
        <meshStandardMaterial color="#05121f" />
      </mesh>
      <Label position={[0, 2.35, 1.86]} center distanceFactor={6} zIndexRange={[4, 0]}>
        <div className="lift-display">{floor}</div>
      </Label>
      <mesh position={[1.0, 1.15, 1.82]}>
        <boxGeometry args={[0.1, 0.22, 0.02]} />
        <meshStandardMaterial color="#dfe3e8" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Ceiling-mounted Wi-Fi access point: white disc with a blue status ring.
function AccessPoint({ x, z }) {
  return (
    <group position={[x, CS.ceiling - 0.04, z]}>
      <mesh>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 32]} />
        <meshStandardMaterial color="#f1f3f5" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.08, 32]} />
        <meshBasicMaterial color="#2bb6ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Bench({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.45, -0.12 + i * 0.12]} castShadow>
          <boxGeometry args={[1.6, 0.04, 0.1]} />
          <meshStandardMaterial color="#8a6a4c" roughness={0.6} />
        </mesh>
      ))}
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[dx, 0.22, 0]}>
          <boxGeometry args={[0.05, 0.44, 0.4]} />
          <meshStandardMaterial color="#3a414b" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function NoticeBoard({ x, z }) {
  const notes = ['#f4f1de', '#ffd166', '#a8dadc', '#f4f1de', '#ef8a80', '#ffffff'];
  return (
    <group position={[x, 1.6, z]}>
      <mesh>
        <boxGeometry args={[1.6, 1.0, 0.03]} />
        <meshStandardMaterial color="#8b6a46" roughness={0.9} />
      </mesh>
      {notes.map((c, i) => (
        <mesh key={i} position={[-0.55 + (i % 3) * 0.55, i < 3 ? 0.2 : -0.22, -0.02]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.05]}>
          <planeGeometry args={[0.36, 0.3]} />
          <meshStandardMaterial color={c} side={2} />
        </mesh>
      ))}
    </group>
  );
}

function WaterDispenser({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.32, 1.0, 0.32]} />
        <meshStandardMaterial color="#e9ecef" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.4, 20]} />
        <meshStandardMaterial color="#7fc4ff" transparent opacity={0.6} roughness={0.05} />
      </mesh>
    </group>
  );
}

function FireExtinguisher({ x, z }) {
  return (
    <group position={[x, 0.15, z]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
        <meshStandardMaterial color="#c0392b" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

// ---------- rooms ----------
function RoomFurnishing({ room, lite }) {
  const f = useMemo(() => roomFurniture(room), [room]);
  const lab = room.kind === 'lab';
  return (
    <group>
      <group position={[f.board.x + CS.wall / 2, 0, f.board.z]}>
        <Whiteboard length={f.board.len} />
      </group>
      <group position={[f.board.x + CS.wall / 2 + 0.02, 2.7, f.board.z + f.board.len / 2 + 0.6]}>
        <Clock />
      </group>
      <group position={[f.teacher.x, 0, f.teacher.z]} rotation={[0, Math.PI / 2, 0]}>
        <Furniture kind="teacherDesk" />
        <Furniture kind="monitor" position={[-0.25, 0.63, 0.25]} rotation={Math.PI} />
      </group>
      {f.desks.map((d) =>
        d.type === 'chairOnly' ? (
          <Furniture key={`${d.x}${d.z}`} kind="chair" position={[d.x, 0, d.z]} rotation={Math.PI / 2} />
        ) : (
          <group key={`${d.x}${d.z}`}>
            <Furniture kind="desk" position={[d.x, 0, d.z]} rotation={Math.PI / 2} />
            {[-0.34, 0.34].map((dz) => (
              <group key={dz}>
                <Furniture kind="chair" position={[d.x + 0.6, 0, d.z + dz]} rotation={Math.PI / 2} />
                {lab && (!lite || dz < 0) && (
                  <>
                    <Furniture kind="monitor" position={[d.x - 0.12, DESK_TOP, d.z + dz]} rotation={Math.PI / 2} />
                    <Furniture kind="keyboard" position={[d.x + 0.16, DESK_TOP, d.z + dz]} rotation={Math.PI / 2} />
                  </>
                )}
              </group>
            ))}
          </group>
        ),
      )}
      <Furniture kind="plant" position={[room.x1 - 0.6, 0, 0.6]} />
      {/* north windows */}
      <group position={[0, 0, 0]}>
        {[room.cx - 2.2, room.cx + 2.2].map((x) => (
          <Window key={x} x={x} width={2.2} />
        ))}
      </group>
      {/* two fans, four tube lights */}
      {[room.cx - 2.2, room.cx + 2.2].map((x, i) => (
        <CeilingFan key={`f${x}`} position={[x, CS.ceiling - 0.55, room.cz]} phase={i * 0.9} />
      ))}
      {[room.cx - 2.2, room.cx + 2.2].flatMap((x) =>
        [room.cz - 1.9, room.cz + 1.9].map((z) => <TubeLight key={`t${x}${z}`} position={[x, CS.ceiling - 0.03, z]} />),
      )}
    </group>
  );
}

// ---------- heatmap ----------
const HEAT_RES = 10; // pixels per metre
function useHeatmap(floor, roomScores, net) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const w = Math.round(CS.W * HEAT_RES);
    const h = Math.round(CS.D * HEAT_RES);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const cache = new Map();
    const rgb = (hex) => {
      if (!cache.has(hex)) cache.set(hex, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
      return cache.get(hex);
    };
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / HEAT_RES;
        const z = (py + 0.5) / HEAT_RES;
        if (x < CS.coreW && z < CORRIDOR.z0) continue; // stairs/lift core
        const s = pickScore(signalAt(floor, roomScores, x, z), net);
        if (s == null) continue;
        const [r, gg, b] = rgb(scoreHex(s));
        const i = (py * w + px) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = z < CS.roomDepth ? 120 : 100;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    return tex;
  }, [floor, roomScores, net]);
}

function FloorAndHeat({ floor, roomScores, net, onFloorClick }) {
  const tiles = useMemo(() => {
    if (!TILE_TEXTURE) return null;
    const m = TILE_TEXTURE.clone();
    m.repeat.set(CS.W / 4.8, CS.D / 4.8);
    m.needsUpdate = true;
    return m;
  }, []);
  const heat = useHeatmap(floor, roomScores, net);
  useEffect(() => () => heat?.dispose(), [heat]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CS.W / 2, 0, CS.D / 2]} receiveShadow onClick={onFloorClick}>
        <planeGeometry args={[CS.W, CS.D]} />
        <meshStandardMaterial map={tiles} roughness={0.35} metalness={0.05} />
      </mesh>
      {heat && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CS.W / 2, 0.012, CS.D / 2]} renderOrder={1}>
          <planeGeometry args={[CS.W, CS.D]} />
          <meshBasicMaterial map={heat} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- you-are-here ----------
function YouMarker({ spotRef, scoreRef, mode }) {
  const g = useRef();
  const ring = useRef();
  const mat = useRef();
  const pawn = useRef();
  const col = useMemo(() => new Color(), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.position.set(spotRef.current.x, 0.03, spotRef.current.z);
    const t = clock.elapsedTime;
    ring.current.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
    col.set(scoreHex(scoreRef.current)).multiplyScalar(1.6);
    mat.current.color.copy(col);
    if (pawn.current) pawn.current.rotation.y = -spotRef.current.heading;
  });
  return (
    <group ref={g}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 48]} />
        <meshBasicMaterial ref={mat} toneMapped={false} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {mode === 'plan' && (
        <group ref={pawn}>
          <mesh position={[0, 0.9, 0]}>
            <capsuleGeometry args={[0.22, 1.1, 6, 16]} />
            <meshStandardMaterial color="#e6f2ff" emissive="#2bb6ff" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.45, 0.06, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.16, 0.35, 16]} />
            <meshBasicMaterial color="#2bb6ff" toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Route between two spots through doorways, so a click never walks you through a wall.
function route(floor, from, to) {
  const a = roomAt(floor, from.x, from.z);
  const b = roomAt(floor, to.x, to.z);
  if ((a && b && a.id === b.id) || (!a && !b)) return [to];
  const pts = [];
  const doorIn = (r) => ({ x: r.door.x, z: r.z1 - 0.7 });
  const doorOut = (r) => ({ x: r.door.x, z: CORRIDOR.z0 + 0.9 });
  if (a) pts.push(doorIn(a), doorOut(a));
  if (b) pts.push(doorOut(b), doorIn(b));
  pts.push(to);
  return pts;
}

// ---------- camera / movement ----------
function useKeys() {
  const keys = useRef(new Set());
  useEffect(() => {
    const ignore = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
    const down = (e) => {
      if (ignore(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        keys.current.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      }
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return keys;
}

function saveControls(c) {
  return {
    minDistance: c.minDistance,
    maxDistance: c.maxDistance,
    minPolarAngle: c.minPolarAngle,
    maxPolarAngle: c.maxPolarAngle,
    azimuthRotateSpeed: c.azimuthRotateSpeed,
    polarRotateSpeed: c.polarRotateSpeed,
    mouseButtons: { ...c.mouseButtons },
    touches: { ...c.touches },
  };
}
function restoreControls(c, s) {
  c.minDistance = s.minDistance;
  c.maxDistance = s.maxDistance;
  c.minPolarAngle = s.minPolarAngle;
  c.maxPolarAngle = s.maxPolarAngle;
  c.azimuthRotateSpeed = s.azimuthRotateSpeed;
  c.polarRotateSpeed = s.polarRotateSpeed;
  Object.assign(c.mouseButtons, s.mouseButtons);
  Object.assign(c.touches, s.touches);
}

function InteriorCamera({ floor, mode, origin, spotRef, walkQueue }) {
  const controls = useThree((s) => s.controls);
  const keys = useKeys();
  const tmp = useMemo(() => ({ t: new Vector3(), p: new Vector3() }), []);
  const settling = useRef(true);
  const world = (x, z, y = CS.eye) => [origin[0] + x, y, origin[1] + z];

  // take over the shared camera controls while inside; give them back on the way out
  useEffect(() => {
    if (!controls) return undefined;
    const saved = saveControls(controls);
    return () => restoreControls(controls, saved);
  }, [controls]);

  // enter / switch mode / switch floor
  useEffect(() => {
    if (!controls) return;
    const s = spotRef.current;
    settling.current = true;
    if (mode === 'walk') {
      controls.minDistance = 0.01;
      controls.maxDistance = 1000;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI - 0.2;
      controls.azimuthRotateSpeed = -0.35;
      controls.polarRotateSpeed = -0.35;
      controls.mouseButtons.left = ACTION.ROTATE;
      controls.mouseButtons.right = ACTION.NONE;
      controls.mouseButtons.middle = ACTION.NONE;
      controls.mouseButtons.wheel = ACTION.NONE;
      controls.touches.one = ACTION.TOUCH_ROTATE;
      controls.touches.two = ACTION.NONE;
      controls.touches.three = ACTION.NONE;
      const [ex, ey, ez] = world(s.x, s.z);
      const look = [ex + Math.cos(s.heading) * 0.05, ey, ez + Math.sin(s.heading) * 0.05];
      controls.setLookAt(ex, ey, ez, ...look, true).then(() => {
        controls.maxDistance = 0.05;
        controls.minDistance = 0.05;
        settling.current = false;
      });
    } else {
      controls.minDistance = 6;
      controls.maxDistance = 90;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI / 2.4;
      controls.azimuthRotateSpeed = 1;
      controls.polarRotateSpeed = 1;
      controls.mouseButtons.left = ACTION.ROTATE;
      controls.mouseButtons.right = ACTION.TRUCK;
      controls.mouseButtons.middle = ACTION.DOLLY;
      controls.mouseButtons.wheel = ACTION.DOLLY;
      controls.touches.one = ACTION.TOUCH_ROTATE;
      controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
      const [cx, , cz] = world(CS.W / 2, CS.D / 2, 0);
      controls.setLookAt(cx - 6, 34, cz + 30, cx, 0, cz + 0.5, true).then(() => {
        settling.current = false;
      });
    }
  }, [controls, mode, floor]); // eslint-disable-line react-hooks/exhaustive-deps

  // click-to-walk: follow the queued waypoints (walk mode glides the camera; plan mode slides the marker)
  useFrame((_, dt) => {
    if (!controls) return;
    const s = spotRef.current;
    const q = walkQueue.current;
    const k = keys.current;
    const step = Math.min(dt, 0.12); // cap long frames, but let slow devices still cover ground

    if (mode === 'walk' && !settling.current) {
      controls.getTarget(tmp.t);
      controls.camera.getWorldPosition(tmp.p);
      const fx = tmp.t.x - tmp.p.x;
      const fz = tmp.t.z - tmp.p.z;
      const len = Math.hypot(fx, fz) || 1;
      const dir = [fx / len, fz / len];
      s.heading = Math.atan2(dir[1], dir[0]);
      let mx = 0;
      let mz = 0;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const side = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      if (fwd || side) {
        q.length = 0; // keys override a click-walk in progress
        const speed = (k.has('shift') ? 3.6 : 1.9) * step;
        mx = (dir[0] * fwd - dir[1] * side) * speed;
        mz = (dir[1] * fwd + dir[0] * side) * speed;
      } else if (q.length) {
        const wp = q[0];
        const dx = wp.x - s.x;
        const dz = wp.z - s.z;
        const d = Math.hypot(dx, dz);
        const speed = 2.4 * step;
        if (d <= speed) {
          q.shift();
          mx = dx;
          mz = dz;
        } else {
          mx = (dx / d) * speed;
          mz = (dz / d) * speed;
        }
      }
      if (mx || mz) {
        const free = q.length > 0 && !(fwd || side); // waypoints are pre-routed through doors
        let nx = s.x + mx;
        let nz = s.z + mz;
        if (!free && !walkable(floor, nx, nz)) {
          if (walkable(floor, nx, s.z)) nz = s.z; // slide along walls
          else if (walkable(floor, s.x, nz)) nx = s.x;
          else {
            nx = s.x;
            nz = s.z;
          }
        }
        s.x = nx;
        s.z = nz;
        const [wx, wy, wz] = world(nx, nz);
        if (free) {
          // click-walk: turn smoothly to face the way you're going (head level)
          const want = Math.atan2(mz, mx);
          let d = want - s.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const h = s.heading + d * (1 - Math.exp(-6 * step));
          s.heading = h;
          controls.setLookAt(wx, wy, wz, wx + Math.cos(h) * 0.05, wy, wz + Math.sin(h) * 0.05, false);
        } else {
          controls.moveTo(wx, wy, wz, false);
        }
      }
    } else if (mode === 'plan' && q.length) {
      const wp = q[0];
      const dx = wp.x - s.x;
      const dz = wp.z - s.z;
      const d = Math.hypot(dx, dz);
      const speed = 6 * step;
      if (d > 0.01) s.heading = Math.atan2(dz, dx);
      if (d <= speed) {
        q.shift();
        s.x = wp.x;
        s.z = wp.z;
      } else {
        s.x += (dx / d) * speed;
        s.z += (dz / d) * speed;
      }
    }
    lastSpot.set(floor, { ...s });
  });
  return null;
}

// ---------- the scene ----------
export function CSInterior({ footprint, floor, mode, roomScores, net, lite, onHere, onRoom, gotoRoom }) {
  const rooms = useMemo(() => roomsOnFloor(floor), [floor]);
  const origin = useMemo(() => [footprint.x - CS.W / 2, footprint.z - CS.D / 2], [footprint.x, footprint.z]);
  const spotRef = useRef(null);
  const scoreRef = useRef(null);
  const walkQueue = useRef([]);

  // where you stand: resume on this floor, or arrive at the stair landing / entrance
  if (!spotRef.current || spotRef.current.floor !== floor) {
    const saved = lastSpot.get(floor);
    const arrive = spotRef.current ? { x: 4.0, z: CORRIDOR.z0 + 1.6, heading: 0 } : { ...START };
    spotRef.current = { ...(saved || arrive), floor };
    walkQueue.current = [];
  }

  // panel "walk to room" requests
  useEffect(() => {
    if (!gotoRoom) return;
    const r = rooms.find((x) => x.id === gotoRoom.id);
    if (!r) return;
    const target = roomSpot(r);
    walkQueue.current = route(floor, spotRef.current, target);
  }, [gotoRoom, rooms, floor]);

  // report "signal where you stand" to the panel ~5 times a second
  const lastReport = useRef({ t: 0, key: '' });
  useFrame(({ clock }) => {
    const s = spotRef.current;
    const scores = signalAt(floor, roomScores, s.x, s.z);
    scoreRef.current = pickScore(scores, net);
    if (clock.elapsedTime - lastReport.current.t < 0.2) return;
    lastReport.current.t = clock.elapsedTime;
    const room = roomAt(floor, s.x, s.z);
    const key = `${room?.id}|${JSON.stringify(scores)}`;
    if (key === lastReport.current.key) return;
    lastReport.current.key = key;
    onHere?.({ room, scores });
  });

  const onFloorClick = (e) => {
    if (e.delta > 6) return; // that was a drag to look around
    e.stopPropagation();
    const x = e.point.x - origin[0];
    const z = e.point.z - origin[1];
    if (!walkable(floor, x, z)) return;
    walkQueue.current = route(floor, spotRef.current, { x, z });
  };

  const near = (x, z) => {
    if (mode === 'plan') return true;
    const s = spotRef.current;
    return Math.hypot(s.x - x, s.z - z) < 14;
  };

  return (
    <group>
      <SceneLook background="#040914" />
      <hemisphereLight args={['#e6eefc', '#2a2f38', 0.6]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[origin[0] + CS.W / 2, 12, origin[1] + CS.D]} intensity={0.9} color="#fff4e4" />
      <group position={[origin[0], 0, origin[1]]}>
        {!lite &&
          rooms.map((r) => <pointLight key={`pl${r.id}`} position={[r.cx, CS.ceiling - 0.4, r.cz]} intensity={3} distance={9} decay={2} color="#fff1dc" />)}
        {!lite && [12, 30, 46].map((x) => <pointLight key={`cl${x}`} position={[x, CS.ceiling - 0.4, (CORRIDOR.z0 + CS.D) / 2]} intensity={2} distance={8} decay={2} color="#fff1dc" />)}

        <FloorAndHeat floor={floor} roomScores={roomScores} net={net} onFloorClick={onFloorClick} />

        {/* exterior walls */}
        <group position={[CS.W / 2, 0, 0]}>
          <Wall length={CS.W} height={CS.ceiling} axis="x" />
        </group>
        <group position={[CS.W / 2, 0, CS.D]} rotation={[0, Math.PI, 0]}>
          <Wall length={CS.W} height={CS.ceiling} axis="x" />
          {[-20, -12, -4, 4, 12, 20].map((x) => (
            <Window key={x} x={x} width={2.4} />
          ))}
        </group>
        <group position={[0, 0, CS.D / 2]}>
          <Wall length={CS.D} height={CS.ceiling} axis="z" />
        </group>
        <group position={[CS.W, 0, CS.D / 2]} rotation={[0, Math.PI, 0]}>
          <Wall length={CS.D} height={CS.ceiling} axis="z" />
        </group>

        {/* partitions between core/rooms, and the corridor wall with doors */}
        {[CS.coreW, ...rooms.map((r) => r.x1)].slice(0, rooms.length).map((x) => (
          <Partition key={x} x={x} z0={0} z1={CS.roomDepth} />
        ))}
        <CorridorWall rooms={rooms} />

        {/* core: stairs + lift */}
        <Stairs />
        <Lift floor={floor} />

        {/* rooms */}
        {rooms.map((r) => (
          <RoomFurnishing key={r.id} room={r} lite={lite} />
        ))}

        {/* corridor fittings */}
        {[8, 20, 32, 44].map((x) => (
          <TubeLight key={`ct${x}`} position={[x, CS.ceiling - 0.03, (CORRIDOR.z0 + CS.D) / 2]} />
        ))}
        {[14, 26, 38].map((x) => (
          <TubeLight key={`ct${x}`} position={[x, CS.ceiling - 0.03, (CORRIDOR.z0 + CS.D) / 2]} />
        ))}
        {[11, 29, 47].map((x) => (
          <AccessPoint key={`ap${x}`} x={x} z={(CORRIDOR.z0 + CS.D) / 2} />
        ))}
        {[16, 34].map((x) => (
          <Bench key={`b${x}`} x={x} z={CS.D - 0.45} />
        ))}
        {[10, 24, 42].map((x) => (
          <Furniture key={`p${x}`} kind="plant" position={[x, 0, CS.D - 0.5]} />
        ))}
        <group position={[2.2, 0, CS.D - 0.05]} rotation={[0, Math.PI, 0]}>
          <NoticeBoard x={0} z={0} />
        </group>
        <WaterDispenser x={CS.W - 0.5} z={CS.D - 0.5} />
        <FireExtinguisher x={CS.coreW + 0.35} z={CORRIDOR.z0 + 0.25} />

        {/* room plates beside each door (corridor side), with the room's score */}
        {rooms.map((r) => {
          const s = pickScore(roomScores[r.id], net);
          if (!near(r.door.x, CORRIDOR.z0)) return null;
          return (
            <Label key={`plate${r.id}`} position={[r.door.x - 0.95, 2.05, CORRIDOR.z0 + 0.05]} center distanceFactor={mode === 'plan' ? 40 : 3.6} zIndexRange={[8, 0]}>
              <button type="button" className="door-plate" style={{ '--c': scoreHex(s) }} onClick={() => onRoom?.(r.id)}>
                <b>{r.id.replace('CSE-', '')}</b>
                <span>{r.label}</span>
                <i>{s == null ? '–' : s}</i>
              </button>
            </Label>
          );
        })}

        {/* ceiling (walk mode only — the plan view looks in from above) */}
        {mode === 'walk' && (
          <mesh position={[CS.W / 2, CS.ceiling, CS.D / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CS.W, CS.D]} />
            <meshStandardMaterial color="#c7ced6" roughness={0.95} side={2} />
          </mesh>
        )}

        <YouMarker spotRef={spotRef} scoreRef={scoreRef} mode={mode} />
      </group>
      <InteriorCamera floor={floor} mode={mode} origin={origin} spotRef={spotRef} walkQueue={walkQueue} />
    </group>
  );
}
