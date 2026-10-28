// Draws one piece of furniture: the Kenney model if its file exists, otherwise a simple built-in shape.
import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Color, Vector3 } from 'three';
import { MODEL_BASE, MODELS } from '../config/models.js';

// Asks the server once per file whether it exists. Vite's dev server answers unknown paths with
// index.html (status 200), so an HTML answer also counts as "missing".
const availability = new Map();
function checkFile(url) {
  if (!availability.has(url)) {
    availability.set(
      url,
      fetch(url, { method: 'HEAD' })
        .then((r) => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
        .catch(() => false),
    );
  }
  return availability.get(url);
}

function useModelFile(kind) {
  const spec = MODELS[kind];
  const url = spec ? MODEL_BASE + spec.file : null;
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    if (url) checkFile(url).then((v) => alive && setOk(v));
    else setOk(false);
    return () => {
      alive = false;
    };
  }, [url]);
  return { ok, url, spec };
}

class Fallback extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function KenneyModel({ url, spec }) {
  const { scene } = useGLTF(url);
  // A private copy per instance (shares geometry), with shadows on and optional material tints.
  const object = useMemo(() => {
    const copy = scene.clone(true);
    const tinted = new Map();
    copy.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const name = o.material?.name || '';
      const tint = spec.tint?.[name];
      // Some Kenney exports mark leaves/bark as fully metallic, which renders black without
      // reflections. Anything not named "metal..." is treated as a matte surface.
      const badMetal = o.material?.metalness > 0.5 && !/^metal/i.test(name);
      if (tint || badMetal) {
        if (!tinted.has(name)) {
          const m = o.material.clone();
          if (tint) m.color = new Color(tint);
          if (badMetal) {
            m.metalness = 0;
            m.roughness = 0.85;
          }
          tinted.set(name, m);
        }
        o.material = tinted.get(name);
      }
    });
    return copy;
  }, [scene, spec]);
  // Scale: a fixed real-world factor if given, else fit the widest side to targetWidth. Stand on y = 0, centred.
  const { scale, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const s = spec.scale ?? spec.targetWidth / Math.max(size.x, size.z, 1e-6);
    const center = box.getCenter(new Vector3());
    return { scale: s, offset: [-center.x * s, -box.min.y * s, -center.z * s] };
  }, [scene, spec]);
  return (
    <group rotation={[0, ((spec.turn || 0) * Math.PI) / 180, 0]}>
      <group position={offset} scale={scale}>
        <primitive object={object} />
      </group>
    </group>
  );
}

const wood = { color: '#8a6a4c', roughness: 0.6, metalness: 0.05 };
const metal = { color: '#9aa3ad', roughness: 0.35, metalness: 0.8 };
const fabric = { color: '#2f4f73', roughness: 0.9 };

function Leg({ x, z, h, r = 0.025 }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r, h, 8]} />
      <meshStandardMaterial {...metal} />
    </mesh>
  );
}

// A full bookcase: carcass, five shelves, and rows of books of varied height/colour (deterministic).
const BOOK_COLOURS = ['#7a2e2e', '#2e4a7a', '#c9a227', '#3d6b5a', '#5a3d6b', '#b5651d', '#2b2b2b', '#8c8c8c', '#a33b3b', '#1f6f8b'];
const SHELF_BOOKS = (() => {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const shelves = [];
  for (let s = 0; s < 5; s++) {
    const books = [];
    let x = -0.44;
    while (x < 0.42) {
      const w = 0.025 + rand() * 0.035;
      if (rand() < 0.08) {
        x += w * 2; // a gap
        continue;
      }
      books.push({ x: x + w / 2, w, h: 0.2 + rand() * 0.1, c: BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)], lean: rand() < 0.05 });
      x += w + 0.003;
    }
    shelves.push(books);
  }
  return shelves;
})();

function Bookcase() {
  const H = 1.9;
  const shelfY = (s) => 0.08 + s * 0.36;
  const panel = { color: '#5c4633', roughness: 0.65 };
  return (
    <group>
      {/* back, sides, top */}
      <mesh position={[0, H / 2, -0.16]} receiveShadow>
        <boxGeometry args={[1.0, H, 0.02]} />
        <meshStandardMaterial {...panel} color="#4a3828" />
      </mesh>
      {[-0.49, 0.49].map((x) => (
        <mesh key={x} position={[x, H / 2, 0]} castShadow>
          <boxGeometry args={[0.02, H, 0.34]} />
          <meshStandardMaterial {...panel} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.01, 0]} castShadow>
        <boxGeometry args={[1.0, 0.02, 0.34]} />
        <meshStandardMaterial {...panel} />
      </mesh>
      {SHELF_BOOKS.map((books, s) => (
        <group key={s} position={[0, shelfY(s), 0]}>
          <mesh>
            <boxGeometry args={[0.96, 0.02, 0.32]} />
            <meshStandardMaterial {...panel} />
          </mesh>
          {books.map((b, i) => (
            <mesh key={i} position={[b.x, 0.01 + b.h / 2, 0.01]} rotation={[0, 0, b.lean ? 0.18 : 0]} castShadow>
              <boxGeometry args={[b.w, b.h, 0.22]} />
              <meshStandardMaterial color={b.c} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const BUILT_IN = {
  desk: (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.04, 0.65]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      {[[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]].map(([x, z]) => (
        <Leg key={`${x}${z}`} x={x} z={z} h={0.7} />
      ))}
    </group>
  ),
  chair: (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.44, 0.05, 0.42]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, 0.72, 0.19]} castShadow>
        <boxGeometry args={[0.44, 0.5, 0.04]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      {[[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].map(([x, z]) => (
        <Leg key={`${x}${z}`} x={x} z={z} h={0.44} r={0.018} />
      ))}
    </group>
  ),
  teacherDesk: (
    <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.76, 0.7]} />
      <meshStandardMaterial color="#6e5038" roughness={0.6} />
    </mesh>
  ),
  bookcase: <Bookcase />,
  plant: (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.4, 12]} />
        <meshStandardMaterial color="#d9d4ca" />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#2f5d45" roughness={0.8} flatShading />
      </mesh>
    </group>
  ),
  monitor: (
    <mesh position={[0, 0.22, 0]} castShadow>
      <boxGeometry args={[0.56, 0.34, 0.04]} />
      <meshStandardMaterial color="#1b1e22" />
    </mesh>
  ),
  keyboard: null,
  mouse: null,
  treeOak: (
    <mesh position={[0, 3, 0]} castShadow>
      <coneGeometry args={[2, 6, 7]} />
      <meshStandardMaterial color="#1f4f6a" flatShading />
    </mesh>
  ),
  treePine: (
    <mesh position={[0, 4, 0]} castShadow>
      <coneGeometry args={[1.6, 8, 7]} />
      <meshStandardMaterial color="#173f58" flatShading />
    </mesh>
  ),
};

export function Furniture({ kind, position = [0, 0, 0], rotation = 0, scale = 1 }) {
  const { ok, url, spec } = useModelFile(kind);
  const builtIn = BUILT_IN[kind] || null;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {ok ? (
        <Fallback fallback={builtIn}>
          <Suspense fallback={builtIn}>
            <KenneyModel url={url} spec={spec} />
          </Suspense>
        </Fallback>
      ) : ok === false ? (
        builtIn
      ) : null}
    </group>
  );
}
