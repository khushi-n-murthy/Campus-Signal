// The flat campus site under the buildings, traced from the official map (config/siteplan.js):
// boundary, roads with dashed centre lines, the football & cricket ground, parking, gardens with
// trees, and a few landmarks. Purely visual: nothing here is clickable, so it never steals
// clicks from the buildings above it.
import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Shape } from 'three';
import { SITE } from '../config/siteplan.js';
import { Label } from './Label.jsx';
import { Furniture } from './Furniture.jsx';

const NEON = '#2bb6ff';
const ROAD_W = 6.5;
const Y = { slab: 0.02, garden: 0.05, road: 0.07, mark: 0.1 };

// A flat rectangle lying on the ground, centred on (x, z).
function Patch({ x, z, w, d, y, color, opacity = 1 }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

// Outline of a rectangle as a glowing line.
function Outline({ x, z, w, d, y = Y.mark, color = NEON, opacity = 0.5, width = 1, inset = 0 }) {
  const hw = w / 2 - inset;
  const hd = d / 2 - inset;
  const pts = [
    [x - hw, y, z - hd],
    [x + hw, y, z - hd],
    [x + hw, y, z + hd],
    [x - hw, y, z + hd],
    [x - hw, y, z - hd],
  ];
  return <Line points={pts} color={color} lineWidth={width} transparent opacity={opacity} toneMapped={false} />;
}

function ellipse(cx, cz, rx, rz, y, n = 64) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz];
  });
}

function SiteSlab() {
  const shape = useMemo(() => {
    const s = new Shape();
    SITE.boundary.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    s.closePath();
    return s;
  }, []);
  const outline = useMemo(() => [...SITE.boundary, SITE.boundary[0]].map(([x, z]) => [x, Y.mark, z]), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y.slab, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#071326" roughness={0.85} metalness={0.2} />
      </mesh>
      <Line points={outline} color={NEON} lineWidth={1.6} transparent opacity={0.75} toneMapped={false} />
    </group>
  );
}

function Road({ pts }) {
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    segs.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, len, rot: Math.atan2(x1 - x0, z1 - z0) });
  }
  const centre = pts.map(([x, z]) => [x, Y.mark, z]);
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, Y.road, s.z]} rotation={[-Math.PI / 2, 0, s.rot]}>
          <planeGeometry args={[ROAD_W, s.len]} />
          <meshStandardMaterial color="#0c1a2f" roughness={0.75} metalness={0.25} />
        </mesh>
      ))}
      {/* round joints so corners don't show a notch */}
      {pts.map(([x, z], i) => (
        <mesh key={`j${i}`} position={[x, Y.road, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[ROAD_W / 2, 20]} />
          <meshStandardMaterial color="#0c1a2f" roughness={0.75} metalness={0.25} />
        </mesh>
      ))}
      <Line points={centre} color="#6fbfff" lineWidth={1} dashed dashSize={2.2} gapSize={2.2} transparent opacity={0.55} toneMapped={false} />
    </group>
  );
}

function SportsGround({ g }) {
  const { x, z, w, d } = g;
  const fw = w - 16; // football pitch inside the cricket oval
  const fd = d - 18;
  const y = Y.mark;
  return (
    <group>
      <Patch x={x} z={z} w={w} d={d} y={Y.garden} color="#0a1d33" />
      <Outline x={x} z={z} w={w} d={d} opacity={0.35} />
      {/* cricket boundary + pitch */}
      <Line points={ellipse(x, z, w / 2 - 1.5, d / 2 - 1.5, y)} color={NEON} lineWidth={1.2} transparent opacity={0.55} toneMapped={false} />
      {/* football pitch */}
      <Outline x={x} z={z} w={fw} d={fd} opacity={0.75} width={1.2} />
      <Line points={[[x, y, z - fd / 2], [x, y, z + fd / 2]]} color={NEON} lineWidth={1.2} transparent opacity={0.75} toneMapped={false} />
      <Line points={ellipse(x, z, 4.5, 4.5, y, 40)} color={NEON} lineWidth={1.2} transparent opacity={0.75} toneMapped={false} />
      <Outline x={x - fw / 2 + 3.5} z={z} w={7} d={fd * 0.45} opacity={0.75} width={1.2} />
      <Outline x={x + fw / 2 - 3.5} z={z} w={7} d={fd * 0.45} opacity={0.75} width={1.2} />
      <Patch x={x} z={z} w={1.4} d={8} y={y + 0.01} color="#1b4f7a" />
      <Label position={[x, 1, z - d / 2 + 4]} center zIndexRange={[5, 0]}>
        <div className="site-tag">Football &amp; cricket ground</div>
      </Label>
    </group>
  );
}

function Parking({ p }) {
  const { x, z, w, d } = p;
  const stalls = Math.floor(w / 2.6);
  const lines = Array.from({ length: stalls + 1 }, (_, i) => x - w / 2 + (i * w) / stalls);
  return (
    <group>
      <Patch x={x} z={z} w={w} d={d} y={Y.garden} color="#0b1a2e" />
      {lines.map((lx) => (
        <Line key={lx} points={[[lx, Y.mark, z - d / 2], [lx, Y.mark, z + d / 2 - 1.2]]} color="#4a90c8" lineWidth={1} transparent opacity={0.5} toneMapped={false} />
      ))}
      <Outline x={x} z={z} w={w} d={d} opacity={0.35} />
    </group>
  );
}

// Deterministic tree positions inside each garden (computed once when the module loads).
const TREES = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out = [];
  for (const g of SITE.gardens) {
    const step = 6.5;
    for (let gx = -g.w / 2 + step / 2; gx < g.w / 2; gx += step) {
      for (let gz = -g.d / 2 + step / 2; gz < g.d / 2; gz += step) {
        if (rand() < 0.35) continue;
        out.push({ x: g.x + gx + (rand() - 0.5) * 2, z: g.z + gz + (rand() - 0.5) * 2, s: 0.7 + rand() * 0.6 });
      }
    }
  }
  return out;
})();

// Kenney Nature Kit trees (oak + pine, tinted for night), with a cone fallback if a file is missing.
// Lite mode keeps every other tree to save draw calls on slower phones.
function Trees({ lite }) {
  const trees = lite ? TREES.filter((_, i) => i % 2 === 0) : TREES;
  return (
    <group>
      {trees.map((t, i) => (
        <Furniture key={i} kind={i % 3 === 0 ? 'treePine' : 'treeOak'} position={[t.x, Y.garden, t.z]} rotation={t.s * 9} scale={t.s} />
      ))}
    </group>
  );
}

function Landmark({ r, h, label }) {
  return (
    <group position={[r.x, 0, r.z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[r.w, h, r.d]} />
        <meshStandardMaterial color="#10223d" emissive="#0b4a7a" emissiveIntensity={0.25} metalness={0.5} roughness={0.3} transparent opacity={0.8} />
      </mesh>
      <Outline x={0} z={0} w={r.w} d={r.d} y={h + 0.02} opacity={0.7} />
      {label && (
        <Label position={[0, h + 1.5, 0]} center zIndexRange={[5, 0]}>
          <div className="site-tag">{label}</div>
        </Label>
      )}
    </group>
  );
}

export function SitePlan({ lite }) {
  const [sx, sz] = SITE.statue;
  const [ex, ez] = SITE.entrance;
  return (
    <group>
      <SiteSlab />
      {SITE.gardens.map((g, i) => (
        <group key={i}>
          <Patch {...g} y={Y.garden} color="#0a2236" />
          <Outline {...g} opacity={0.22} color="#5ab0e0" />
        </group>
      ))}
      {SITE.roads.map((pts, i) => (
        <Road key={i} pts={pts} />
      ))}
      <SportsGround g={SITE.ground} />
      <Parking p={SITE.parking} />
      <Landmark r={SITE.temple} h={2.4} />
      <Landmark r={SITE.security} h={2.6} />
      {/* founder statue */}
      <group position={[sx, 0, sz]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.6, 1.9, 1, 24]} />
          <meshStandardMaterial color="#132a48" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.35, 0.5, 2.4, 12]} />
          <meshStandardMaterial color="#2a5d8f" emissive="#1a6fb0" emissiveIntensity={0.4} metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
      {/* main entrance gate */}
      <group position={[ex, 0, ez]}>
        {[-6, 6].map((dx) => (
          <mesh key={dx} position={[dx, 2, 0]}>
            <boxGeometry args={[0.9, 4, 0.9]} />
            <meshStandardMaterial color="#163055" emissive={NEON} emissiveIntensity={0.25} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 4.1, 0]}>
          <boxGeometry args={[13, 0.25, 0.4]} />
          <meshBasicMaterial color={NEON} toneMapped={false} />
        </mesh>
        <Label position={[0, 6, 0]} center zIndexRange={[5, 0]}>
          <div className="site-tag entrance">Main entrance</div>
        </Label>
      </group>
      <Trees lite={lite} />
    </group>
  );
}
