// The one 3D canvas. It stays mounted while you move campus -> building -> room, so the camera can fly.
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { NoToneMapping, ACESFilmicToneMapping } from 'three';

// Full mode: the effect composer does anti-aliasing and tone mapping itself.
// Lite mode (no effects): the browser anti-aliases and three.js tone-maps directly.
export function Stage({ lite, children }) {
  return (
    <Canvas
      shadows={!lite}
      dpr={lite ? [1, 1.5] : [1, 2]}
      camera={{ fov: 45, position: [0, 120, 160], near: 0.3, far: 2000 }}
      gl={{ antialias: lite, powerPreference: 'high-performance', toneMapping: lite ? ACESFilmicToneMapping : NoToneMapping }}
      onCreated={({ gl }) => gl.setClearColor('#040914')}
    >
      {children}
      <CameraControls makeDefault minDistance={3} maxDistance={760} maxPolarAngle={Math.PI / 2.1} smoothTime={0.6} dollySpeed={0.6} />
      {!lite && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={1.15} radius={0.75} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
