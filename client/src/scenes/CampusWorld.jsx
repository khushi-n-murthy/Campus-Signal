// The night-time "digital twin" of campus. Buildings glow by WiFi quality; the selected building
// splits apart floor by floor so every room can be picked.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid, useCursor } from '@react-three/drei';
import { Label } from './Label.jsx';
import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { scoreHex, scoreWord } from '../lib/colors.js';
import { scoreColor } from './color3.js';
import { SceneLook, lookAt } from './SceneLook.jsx';
import { SitePlan } from './SitePlan.jsx';

const CAMPUS_FOG = { color: '#040914', near: 280, far: 820 };

export const FLOOR_HEIGHT = 3.6; // metres per storey on the campus view
export const EXPLODE_GAP = 4; // extra space between floors when a building is opened

// Glowing outline of a box (edges only), bright enough to bloom.
function GlowEdges({ w, h, d, color, opacity = 1 }) {
  const geo = useMemo(() => new BoxGeometry(w, h, d), [w, h, d]);
  return (
    <lineSegments>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} />
    </lineSegments>
  );
}

// Glowing motes drifting upward inside a box (replaces drei <Sparkles>, whose shader blanked the
// whole frame under the bloom pass). Plain points: cheap, and safe with post-processing.
function Motes({ count, scale: [sx, sy, sz], position = [0, 0, 0], color, size = 0.25, speed = 0.5 }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    let seed = count * 97 + Math.round(sx * 13 + sy * 7);
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * sx;
      pos[i * 3 + 1] = (rand() - 0.5) * sy;
      pos[i * 3 + 2] = (rand() - 0.5) * sz;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return g;
  }, [count, sx, sy, sz]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    const attr = ref.current?.geometry.attributes.position;
    if (!attr) return;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) + dt * speed;
      if (y > sy / 2) y -= sy;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geometry} position={position}>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={0.85} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function Beacon({ height, color, lite }) {
  const ring = useRef();
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.8;
  });
  const beam = 4 + height;
  return (
    <group>
      <mesh position={[0, beam / 2, 0]}>
        <cylinderGeometry args={[0.25, 0.6, beam, 16, 1, true]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position={[0, beam, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.06, 8, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {!lite && <Motes count={18} scale={[4, beam, 4]} position={[0, beam / 2, 0]} size={0.35} speed={1.2} color={color} />}
    </group>
  );
}

// Facade texture: 8 window bays (3 m each) for one storey. Some offices lit warm-white, some cool,
// some dark, with frames and a spandrel band, so buildings read as real blocks at night.
const BAY = 3;
const FACADE = (() => {
  if (typeof document === 'undefined') return null;
  const bays = 8;
  const c = document.createElement('canvas');
  c.width = 64 * bays;
  c.height = 80;
  const g = c.getContext('2d');
  let seed = 5;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < bays; i++) {
    const x = i * 64;
    const r = rand();
    const fill = r < 0.45 ? 'rgba(255, 236, 205, 0.95)' : r < 0.7 ? 'rgba(190, 225, 255, 0.85)' : 'rgba(40, 70, 105, 0.55)';
    g.fillStyle = fill;
    g.fillRect(x + 8, 18, 48, 40);
    g.fillStyle = 'rgba(10, 18, 30, 0.9)'; // mullion + transom
    g.fillRect(x + 31, 18, 2, 40);
    g.fillRect(x + 8, 30, 48, 2);
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
})();

function useFacade(length, offset) {
  return useMemo(() => {
    if (!FACADE) return null;
    const t = FACADE.clone();
    t.repeat.set(length / (BAY * 8), 1);
    t.offset.set(offset, 0);
    t.needsUpdate = true;
    return t;
  }, [length, offset]);
}

function FacadeSide({ length, position, rotation, floorH, floors, seed }) {
  const map = useFacade(length, seed);
  if (!map) return null;
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: floors }, (_, f) => (
        <mesh key={f} position={[0, f * floorH + floorH / 2, 0]}>
          <planeGeometry args={[length, floorH]} />
          <meshBasicMaterial map={map} transparent opacity={0.85} depthWrite={false} toneMapped={false} color="#c8d6e6" />
        </mesh>
      ))}
    </group>
  );
}

function Facade({ w, d, floors }) {
  const e = 0.04; // sit just outside the glass
  return (
    <group>
      <FacadeSide length={w} floors={floors} floorH={FLOOR_HEIGHT} position={[0, 0, d / 2 + e]} rotation={[0, 0, 0]} seed={0.13} />
      <FacadeSide length={w} floors={floors} floorH={FLOOR_HEIGHT} position={[0, 0, -d / 2 - e]} rotation={[0, Math.PI, 0]} seed={0.41} />
      <FacadeSide length={d} floors={floors} floorH={FLOOR_HEIGHT} position={[w / 2 + e, 0, 0]} rotation={[0, Math.PI / 2, 0]} seed={0.67} />
      <FacadeSide length={d} floors={floors} floorH={FLOOR_HEIGHT} position={[-w / 2 - e, 0, 0]} rotation={[0, -Math.PI / 2, 0]} seed={0.89} />
    </group>
  );
}

function BuildingBlock({ b, dimmed, onSelect, lite }) {
  const [hover, setHover] = useState(false);
  useCursor(hover && !dimmed);
  const H = b.floors * FLOOR_HEIGHT;
  const score = b.headline?.score ?? null;
  const base = scoreColor(score);
  const glow = useMemo(() => scoreColor(score).multiplyScalar(2.2), [score]);
  const { x, z, w, d } = b.footprint;
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, H / 2, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (!dimmed) onSelect(b._id);
        }}
      >
        <boxGeometry args={[w, H, d]} />
        <meshStandardMaterial
          color="#0a1a33"
          emissive={base}
          emissiveIntensity={hover ? 0.55 : 0.2}
          metalness={0.6}
          roughness={0.15}
          transparent
          opacity={dimmed ? 0.08 : 0.5}
          depthWrite={!dimmed}
        />
      </mesh>
      {!dimmed && (
        <group position={[0, H / 2, 0]}>
          <GlowEdges w={w} h={H} d={d} color={glow} />
        </group>
      )}
      {!dimmed && <Facade w={w} d={d} floors={b.floors} />}
      {!dimmed &&
        Array.from({ length: b.floors - 1 }, (_, f) => (
          <mesh key={f} position={[0, (f + 1) * FLOOR_HEIGHT, 0]}>
            <boxGeometry args={[w + 0.15, 0.06, d + 0.15]} />
            <meshBasicMaterial color={glow} toneMapped={false} transparent opacity={0.55} />
          </mesh>
        ))}
      {!dimmed && (
        <group position={[0, H, 0]}>
          <Beacon height={(score ?? 0) * 0.16} color={glow} lite={lite} />
        </group>
      )}
      {!dimmed && (
        <Label position={[0, H + 2.5, 0]} center distanceFactor={150} zIndexRange={[10, 0]}>
          <button type="button" className="tag" style={{ borderColor: scoreHex(score) }} onClick={() => onSelect(b._id)}>
            <b>{b.name}</b>
            <span>{score == null ? 'no data' : `${Math.round(score)} · ${scoreWord(score)}`}</span>
          </button>
        </Label>
      )}
    </group>
  );
}

function RoomTile({ room, cx, cy, cz, pulseAt, onRoom, lite }) {
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const ref = useRef();
  const score = room.headline?.score ?? null;
  const glow = useMemo(() => scoreColor(score).multiplyScalar(2), [score]);
  const w = Math.max(0.6, room.shape.w - 0.4);
  const d = Math.max(0.6, room.shape.h - 0.4);
  const h = 2.6;
  useFrame(() => {
    if (!ref.current) return;
    const age = pulseAt ? (Date.now() - pulseAt) / 1000 : 9;
    const bump = age < 1.5 ? 1 + 0.25 * Math.sin((age / 1.5) * Math.PI) : 1; // a new test just landed
    ref.current.scale.setScalar(bump);
  });
  return (
    <group position={[cx, cy + h / 2, cz]} ref={ref}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          onRoom(room._id);
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={scoreColor(score)} emissive={scoreColor(score)} emissiveIntensity={hover ? 1.1 : 0.45} transparent opacity={0.6} roughness={0.2} />
      </mesh>
      <GlowEdges w={w} h={h} d={d} color={glow} />
      {!lite && score != null && <Motes count={8} scale={[w, h * 1.6, d]} size={0.18} speed={0.3 + score / 150} color={glow} />}
      {hover && (
        <Label position={[0, h / 2 + 0.8, 0]} center zIndexRange={[30, 0]}>
          <div className="tip">
            <b>{room.name}</b>
            <div>{score == null ? 'No tests yet — be the first' : `${room.headline.carrier} ${Math.round(score)} · ${scoreWord(score)}`}</div>
            {score != null && <small>{room.headline.samples} tests · {room.headline.confidence} confidence</small>}
          </div>
        </Label>
      )}
    </group>
  );
}

function ExplodedBuilding({ b, detail, pulses, onRoom, lite }) {
  const { x, z, w, d } = b.footprint;
  const step = FLOOR_HEIGHT + EXPLODE_GAP;
  return (
    <group position={[x, 0, z]}>
      {detail.floorsDetail.map(({ floor, rooms }) => {
        const y = floor * step;
        return (
          <group key={floor}>
            <mesh position={[0, y + 0.1, 0]} receiveShadow>
              <boxGeometry args={[w + 1, 0.2, d + 1]} />
              <meshStandardMaterial color="#0d1d36" metalness={0.4} roughness={0.5} transparent opacity={0.9} />
            </mesh>
            <group position={[0, y + 0.1, 0]}>
              <GlowEdges w={w + 1} h={0.2} d={d + 1} color={scoreColor(null).multiplyScalar(1.4)} />
            </group>
            <Label position={[-w / 2 - 1.5, y + 1.4, d / 2]} center zIndexRange={[10, 0]}>
              <div className="floor-tag">Floor {floor}</div>
            </Label>
            {rooms.map((room) => (
              <RoomTile
                key={room._id}
                room={room}
                cx={-w / 2 + room.shape.x + room.shape.w / 2}
                cy={y + 0.2}
                cz={-d / 2 + room.shape.y + room.shape.h / 2}
                pulseAt={pulses[room._id]}
                onRoom={onRoom}
                lite={lite}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Moves the camera smoothly whenever the selection changes.
// Only re-aims when the selection, the layout or the screen size changes, never on a live score
// update, so a user who is orbiting around is not yanked back.
function CameraDirector({ buildings, selected, detail }) {
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);
  const layoutKey = buildings.map((b) => `${b._id}:${b.floors}:${Object.values(b.footprint).join(',')}`).join('|');
  const latest = useRef(buildings);
  latest.current = buildings;
  useEffect(() => {
    const buildings = latest.current;
    if (!controls || !buildings.length) return;
    if (selected) {
      const b = buildings.find((x) => x._id === selected);
      if (!b) return;
      const floors = detail?.floors ?? b.floors;
      const top = floors * (FLOOR_HEIGHT + EXPLODE_GAP);
      const { x, z, w, d } = b.footprint;
      const span = Math.max(w, d, top);
      lookAt(controls, size, [x + span * 0.55, top * 0.75 + span * 0.45, z + span * 1.25], [x, top * 0.42, z], true);
    } else {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const b of buildings) {
        const { x, z, w, d } = b.footprint;
        minX = Math.min(minX, x - w / 2);
        maxX = Math.max(maxX, x + w / 2);
        minZ = Math.min(minZ, z - d / 2);
        maxZ = Math.max(maxZ, z + d / 2);
      }
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ, 40);
      lookAt(controls, size, [cx, span * 0.95, cz + span * 1.2], [cx, 0, cz + span * 0.04], true);
    }
  }, [controls, size.width, size.height, layoutKey, selected, detail?.floors]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function CampusWorld({ buildings, selected, detail, pulses, onSelect, onRoom, lite }) {
  return (
    <group>
      <SceneLook background="#040914" fog={CAMPUS_FOG} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#8ec5ff', '#040914', 0.65]} />
      <directionalLight position={[60, 120, 40]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#06101f" metalness={0.2} roughness={0.85} />
      </mesh>
      <SitePlan lite={lite} />
      <Grid
        position={[0, -0.01, 0]}
        args={[600, 600]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#0e2442"
        sectionSize={25}
        sectionThickness={0.9}
        sectionColor="#1f6bb0"
        fadeDistance={420}
        fadeStrength={1.5}
        infiniteGrid
      />
      {buildings.map((b) =>
        selected === b._id && detail ? (
          <ExplodedBuilding key={b._id} b={b} detail={detail} pulses={pulses} onRoom={onRoom} lite={lite} />
        ) : (
          <BuildingBlock key={b._id} b={b} dimmed={Boolean(selected) && selected !== b._id} onSelect={onSelect} lite={lite} />
        ),
      )}
      <CameraDirector buildings={buildings} selected={selected} detail={detail} />
    </group>
  );
}
