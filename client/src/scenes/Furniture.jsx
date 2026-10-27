// Draws one piece of furniture: the Kenney model if its file exists, otherwise a simple built-in shape.
import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
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

function KenneyModel({ url, targetWidth, turn = 0 }) {
  const { scene } = useGLTF(url);
  // Measure the model once and scale it so its widest side equals targetWidth metres, standing on y = 0.
  const { scale, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const s = targetWidth / Math.max(size.x, size.z, 1e-6);
    const center = box.getCenter(new Vector3());
    return { scale: s, offset: [-center.x * s, -box.min.y * s, -center.z * s] };
  }, [scene, targetWidth]);
  return (
    <group rotation={[0, (turn * Math.PI) / 180, 0]}>
      <group position={offset} scale={scale}>
        <Clone object={scene} castShadow receiveShadow />
      </group>
    </group>
  );
}

const wood = { color: '#c89f6d', roughness: 0.7 };
const metal = { color: '#5b6474', roughness: 0.4, metalness: 0.6 };
const fabric = { color: '#3d6fd9', roughness: 0.9 };

function Leg({ x, z, h, r = 0.025 }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r, h, 8]} />
      <meshStandardMaterial {...metal} />
    </mesh>
  );
}

const BUILT_IN = {
  desk: (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.04, 0.6]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      {[[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].map(([x, z]) => (
        <Leg key={`${x}${z}`} x={x} z={z} h={0.72} />
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
    <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.8, 0.7]} />
      <meshStandardMaterial color="#8a6a4a" roughness={0.6} />
    </mesh>
  ),
  bookcase: (
    <mesh position={[0, 0.9, 0]} castShadow>
      <boxGeometry args={[1.0, 1.8, 0.35]} />
      <meshStandardMaterial color="#9c7a55" roughness={0.8} />
    </mesh>
  ),
  plant: (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.4, 12]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#3f9a5a" roughness={0.8} flatShading />
      </mesh>
    </group>
  ),
};

export function Furniture({ kind, position = [0, 0, 0], rotation = 0 }) {
  const { ok, url, spec } = useModelFile(kind);
  const builtIn = BUILT_IN[kind] || null;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {ok ? (
        <Fallback fallback={builtIn}>
          <Suspense fallback={builtIn}>
            <KenneyModel url={url} targetWidth={spec.targetWidth} turn={spec.turn} />
          </Suspense>
        </Fallback>
      ) : (
        builtIn
      )}
    </group>
  );
}
