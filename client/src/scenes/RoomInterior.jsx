// A realistic 3D room built from the room's real size, furnished with Kenney models, with the
// signal streams flowing through it. The front and right walls are left out so the camera can look
// in (a "cutaway" view); a neon line marks the cut edges.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { Furniture } from './Furniture.jsx';
import { SignalField } from './SignalField.jsx';
import { SceneLook } from './SceneLook.jsx';
import { ROOM_HEIGHT, deskLayout, roomSize } from './layout.js';

const WALL = '#8e9aaa';
const DADO = '#4b5667';
const FRAME = '#c9ced4';

// Vitrified floor tiles (60 cm), drawn once into a canvas: subtle per-tile variation + grout lines.
export const TILE_TEXTURE = (() => {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const tiles = 8;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let seed = 3;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const t = size / tiles;
  g.fillStyle = '#3a414b';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const l = 52 + Math.floor(rand() * 8);
      g.fillStyle = `hsl(212, 9%, ${l}%)`;
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
        g.fillRect(i * t + 2 + rand() * (t - 6), j * t + 2 + rand() * (t - 6), 2 + rand() * 5, 1 + rand() * 2);
      }
    }
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
})();

function Floor({ width, depth }) {
  const map = useMemo(() => {
    if (!TILE_TEXTURE) return null;
    const m = TILE_TEXTURE.clone();
    m.repeat.set(width / 4.8, depth / 4.8);
    m.needsUpdate = true;
    return m;
  }, [width, depth]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={map} color="#ffffff" roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

// Two-tone wall: painted upper wall, darker dado band below, a rail, and skirting at the floor.
export function Wall({ length, height, axis }) {
  const rot = axis === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0];
  return (
    <group rotation={rot}>
      <mesh position={[0, height / 2, -0.05]} receiveShadow>
        <boxGeometry args={[length, height, 0.1]} />
        <meshStandardMaterial color={WALL} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.5, 0.005]} receiveShadow>
        <boxGeometry args={[length, 1.0, 0.02]} />
        <meshStandardMaterial color={DADO} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.01, 0.02]}>
        <boxGeometry args={[length, 0.03, 0.03]} />
        <meshStandardMaterial color="#d7dbe0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0.025]}>
        <boxGeometry args={[length, 0.12, 0.03]} />
        <meshStandardMaterial color="#2b3240" roughness={0.6} />
      </mesh>
    </group>
  );
}

// Aluminium window: frame, mullions, a transom, sill, and night-sky glass.
export function Window({ x, width }) {
  const h = 1.5;
  const bar = (w, hh, px, py) => (
    <mesh position={[px, py, 0.04]} castShadow>
      <boxGeometry args={[w, hh, 0.06]} />
      <meshStandardMaterial color={FRAME} metalness={0.7} roughness={0.3} />
    </mesh>
  );
  return (
    <group position={[x, 1.85, 0]}>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, h]} />
        <meshStandardMaterial color="#0d2238" emissive="#1c4d7a" emissiveIntensity={0.55} metalness={0.2} roughness={0.05} />
      </mesh>
      {bar(width + 0.1, 0.06, 0, h / 2)}
      {bar(width + 0.1, 0.06, 0, -h / 2)}
      {bar(0.06, h, -width / 2, 0)}
      {bar(0.06, h, width / 2, 0)}
      {bar(0.04, h, -width / 6, 0)}
      {bar(0.04, h, width / 6, 0)}
      {bar(width, 0.04, 0, h / 2 - 0.42)}
      <mesh position={[0, -h / 2 - 0.05, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.25, 0.04, 0.22]} />
        <meshStandardMaterial color="#d9dde2" roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Whiteboard({ length }) {
  const frameMat = <meshStandardMaterial color={FRAME} metalness={0.8} roughness={0.25} />;
  return (
    <group>
      <mesh position={[0.025, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.03, 1.2, length]} />
        <meshStandardMaterial color="#f2f4f6" roughness={0.18} metalness={0.05} emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      {[2.21, 0.99].map((y) => (
        <mesh key={y} position={[0.04, y, 0]}>
          <boxGeometry args={[0.04, 0.03, length + 0.06]} />
          {frameMat}
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.04, 1.6, (s * (length + 0.03)) / 2]}>
          <boxGeometry args={[0.04, 1.25, 0.03]} />
          {frameMat}
        </mesh>
      ))}
      <mesh position={[0.08, 0.97, 0]}>
        <boxGeometry args={[0.08, 0.02, length * 0.6]} />
        {frameMat}
      </mesh>
      {['#1f4fb5', '#c0392b', '#222222'].map((c, i) => (
        <mesh key={c} position={[0.09, 0.995, -0.25 + i * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.12, 8]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

export function Door() {
  return (
    <group>
      <mesh position={[0.02, 1.05, 0]}>
        <boxGeometry args={[0.04, 2.15, 1.05]} />
        <meshStandardMaterial color="#e3e5e8" roughness={0.5} />
      </mesh>
      <mesh position={[0.045, 1.02, 0]} castShadow>
        <boxGeometry args={[0.04, 2.05, 0.92]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.55} />
      </mesh>
      <mesh position={[0.075, 1.6, 0]}>
        <boxGeometry args={[0.01, 0.35, 0.22]} />
        <meshStandardMaterial color="#cfe6ff" emissive="#7fb6e6" emissiveIntensity={0.25} roughness={0.1} />
      </mesh>
      <mesh position={[0.09, 1.0, 0.36]}>
        <boxGeometry args={[0.05, 0.03, 0.14]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function Clock() {
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.04, 32]} />
        <meshStandardMaterial color="#1d2128" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <circleGeometry args={[0.15, 32]} />
        <meshStandardMaterial color="#f4f4f2" />
      </mesh>
      <mesh position={[0.03, 0.03, 0.024]} rotation={[0, 0, -0.8]}>
        <boxGeometry args={[0.012, 0.09, 0.004]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0.05, 0.026]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.008, 0.12, 0.004]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  );
}

export function AirConditioner() {
  return (
    <group>
      <mesh position={[0.14, 0, 0]} castShadow>
        <boxGeometry args={[0.24, 0.3, 0.95]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.35} />
      </mesh>
      <mesh position={[0.265, -0.1, 0]}>
        <boxGeometry args={[0.01, 0.05, 0.85]} />
        <meshStandardMaterial color="#9aa3ad" />
      </mesh>
      <mesh position={[0.265, 0.08, 0.38]}>
        <boxGeometry args={[0.01, 0.02, 0.04]} />
        <meshBasicMaterial color="#2bb6ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

// Ceiling fan on a downrod; blades turn slowly.
export function CeilingFan({ position, phase }) {
  const blades = useRef();
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += dt * 2.2;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
        <meshStandardMaterial color="#d6d9dd" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={blades} rotation={[0, phase, 0]}>
        <mesh>
          <cylinderGeometry args={[0.11, 0.09, 0.1, 20]} />
          <meshStandardMaterial color="#e8eaed" metalness={0.4} roughness={0.35} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[0.5, -0.02, 0]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.78, 0.012, 0.13]} />
              <meshStandardMaterial color="#e3e6ea" roughness={0.45} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// Surface-mounted LED tube light: housing + glowing diffuser (blooms in full mode).
export function TubeLight({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.25, 0.05, 0.12]} />
        <meshStandardMaterial color="#e9ecef" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[1.18, 0.02, 0.07]} />
        <meshBasicMaterial color="#fff6e6" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function RoomInterior({ room, networks, lite }) {
  const { width, depth } = roomSize(room);
  const H = ROOM_HEIGHT;
  const isLibrary = room.kind === 'library';
  const isCanteen = room.kind === 'canteen';
  const hasBoard = !isCanteen && !isLibrary;
  const desks = useMemo(() => deskLayout(width, depth, room.kind, lite ? 24 : 48), [width, depth, room.kind, lite]);
  const windows = useMemo(() => {
    const n = Math.max(1, Math.floor((width - 2) / 3.2));
    return Array.from({ length: n }, (_, i) => -width / 2 + 1 + ((width - 2) * (i + 0.5)) / n);
  }, [width]);
  // ceiling grid: fans in the middle of each cell, tube lights in rows between them
  const grid = useMemo(() => {
    const nx = Math.max(1, Math.min(3, Math.round(width / 4.5)));
    const nz = Math.max(1, Math.min(2, Math.round(depth / 5)));
    const cells = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) cells.push([-width / 2 + (width * (i + 0.5)) / nx, -depth / 2 + (depth * (j + 0.5)) / nz]);
    }
    const rows = nz + 1;
    const lights = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < rows; j++) lights.push([-width / 2 + (width * (i + 0.5)) / nx, -depth / 2 + (depth * (j + 0.5)) / rows]);
    }
    return { cells, lights };
  }, [width, depth]);

  const boardLen = Math.max(1.2, Math.min(4.5, depth - 4));
  const boardZ = Math.min(0.6, depth / 2 - boardLen / 2 - 0.6);
  const doorZ = -depth / 2 + 1.0;
  const bookcaseZs = useMemo(() => {
    if (!isLibrary) return [];
    const out = [];
    for (let z = doorZ + 1.2; z <= depth / 2 - 0.6; z += 1.05) out.push(z);
    return out;
  }, [isLibrary, doorZ, depth]);

  return (
    <group>
      <SceneLook background="#040914" />
      <hemisphereLight args={['#e6eefc', '#2a2f38', 0.55]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[width * 0.15, 9, depth * 0.25]}
        intensity={1.6}
        color="#fff4e4"
        castShadow={!lite}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-width}
        shadow-camera-right={width}
        shadow-camera-top={depth}
        shadow-camera-bottom={-depth}
      />
      {!lite && (
        <>
          {/* reflections: soft ceiling panels and the cool window wall */}
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={2.2} color="#fff6e8" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#5f9fe0" position={[0, 2, -8]} scale={[12, 3, 1]} />
            <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          </Environment>
          {grid.lights.slice(0, 4).map(([x, z]) => (
            <pointLight key={`pl${x}${z}`} position={[x, H - 0.25, z]} intensity={2.2} distance={6.5} decay={2} color="#fff1dc" />
          ))}
        </>
      )}

      <Floor width={width} depth={depth} />

      {/* back wall with windows */}
      <group position={[0, 0, -depth / 2]}>
        <Wall length={width} height={H} axis="x" />
        {windows.map((x) => (
          <Window key={x} x={x} width={2.4} />
        ))}
      </group>

      {/* left wall: whiteboard, door, clock, AC */}
      <group position={[-width / 2, 0, 0]}>
        <Wall length={depth} height={H} axis="z" />
        {hasBoard && (
          <group position={[0, 0, boardZ]}>
            <Whiteboard length={boardLen} />
          </group>
        )}
        <group position={[0, 0, doorZ]}>
          <Door />
        </group>
        <group position={[0.02, 2.72, hasBoard ? boardZ : 0]}>
          <Clock />
        </group>
        {depth > 6 && (
          <group position={[0, 2.65, depth / 2 - 1.2]}>
            <AirConditioner />
          </group>
        )}
      </group>

      {/* neon line along the cut edges, so the room reads as a cutaway */}
      <mesh position={[0, 0.02, depth / 2]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
        <meshBasicMaterial color="#1fb2ff" toneMapped={false} />
      </mesh>
      <mesh position={[width / 2, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.04, depth]} />
        <meshBasicMaterial color="#1fb2ff" toneMapped={false} />
      </mesh>

      {/* ceiling fixtures */}
      {grid.lights.map(([x, z]) => (
        <TubeLight key={`t${x}${z}`} position={[x, H - 0.03, z]} />
      ))}
      {!isLibrary && grid.cells.map(([x, z], i) => <CeilingFan key={`f${x}${z}`} position={[x, H - 0.55, z]} phase={i * 0.7} />)}

      {/* furniture */}
      {hasBoard && (
        <group position={[-width / 2 + 1.5, 0, boardZ]} rotation={[0, Math.PI / 2, 0]}>
          <Furniture kind="teacherDesk" />
          <Furniture kind="monitor" position={[-0.25, 0.63, 0.25]} rotation={Math.PI} />
          <Furniture kind="keyboard" position={[-0.25, 0.63, 0.02]} rotation={Math.PI} />
          <Furniture kind="mouse" position={[0.1, 0.63, 0.02]} rotation={Math.PI} />
        </group>
      )}
      {bookcaseZs.map((z) => (
        <Furniture key={`b${z}`} kind="bookcase" position={[-width / 2 + 0.2, 0, z]} rotation={Math.PI / 2} />
      ))}
      {desks.map((d) => (
        <group key={`${d.x}-${d.z}`}>
          <Furniture kind="desk" position={[d.x, 0, d.z]} rotation={d.rotation} />
          {d.chairs === 'one' ? (
            <Furniture kind="chair" position={[d.x + 0.55, 0, d.z]} rotation={Math.PI / 2} />
          ) : (
            <>
              <Furniture kind="chair" position={[d.x, 0, d.z + 0.55]} rotation={0} />
              <Furniture kind="chair" position={[d.x, 0, d.z - 0.55]} rotation={Math.PI} />
            </>
          )}
        </group>
      ))}
      <Furniture kind="plant" position={[width / 2 - 0.6, 0, -depth / 2 + 0.6]} />
      <Furniture kind="plant" position={[-width / 2 + 0.6, 0, depth / 2 - 0.6]} />

      {lite ? null : <ContactShadows position={[0, 0.01, 0]} scale={[width, depth]} opacity={0.45} blur={2.2} far={2.5} />}

      <SignalField networks={networks} width={width} depth={depth} height={H} lite={lite} accessPoints={room.accessPoints || []} />
    </group>
  );
}
