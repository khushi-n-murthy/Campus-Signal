// The night-time "digital twin" of campus. Buildings glow by WiFi quality; the selected building
// splits apart floor by floor so every room can be picked.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid, Sparkles, useCursor } from '@react-three/drei';
import { Label } from './Label.jsx';
import { AdditiveBlending, BoxGeometry } from 'three';
import { scoreHex, scoreWord } from '../lib/colors.js';
import { scoreColor } from './color3.js';
import { SceneLook, lookAt } from './SceneLook.jsx';

const CAMPUS_FOG = { color: '#070b16', near: 160, far: 520 };

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
      {!lite && <Sparkles count={18} scale={[4, beam, 4]} position={[0, beam / 2, 0]} size={4} speed={0.5} color={color} />}
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
          color="#0e1830"
          emissive={base}
          emissiveIntensity={hover ? 0.6 : 0.22}
          metalness={0.5}
          roughness={0.25}
          transparent
          opacity={dimmed ? 0.08 : 0.72}
          depthWrite={!dimmed}
        />
      </mesh>
      {!dimmed && (
        <group position={[0, H / 2, 0]}>
          <GlowEdges w={w} h={H} d={d} color={glow} />
        </group>
      )}
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
        <Label position={[0, H + 2.5, 0]} center distanceFactor={90} zIndexRange={[10, 0]}>
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
      {!lite && score != null && <Sparkles count={8} scale={[w, h * 1.6, d]} size={3} speed={0.3 + score / 150} color={glow} />}
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
              <meshStandardMaterial color="#132036" metalness={0.4} roughness={0.5} transparent opacity={0.9} />
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
      lookAt(controls, size, [cx, span * 0.75, cz + span * 1.05], [cx, 0, cz], true);
    }
  }, [controls, size.width, size.height, layoutKey, selected, detail?.floors]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function CampusWorld({ buildings, selected, detail, pulses, onSelect, onRoom, lite }) {
  return (
    <group>
      <SceneLook background="#070b16" fog={CAMPUS_FOG} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#7aa2ff', '#0b1020', 0.6]} />
      <directionalLight position={[60, 120, 40]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#0a1222" />
      </mesh>
      <Grid
        position={[0, -0.01, 0]}
        args={[600, 600]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#0f1a31"
        sectionSize={25}
        sectionThickness={0.9}
        sectionColor="#1a3260"
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
