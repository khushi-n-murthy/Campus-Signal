// A bright, daylit 3D room built from the room's real size, with the signal streams flowing through it.
// The front and right walls are left out so the camera can look in (a "cutaway" view).
import { useMemo } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Furniture } from './Furniture.jsx';
import { SignalField } from './SignalField.jsx';
import { SceneLook } from './SceneLook.jsx';
import { ROOM_HEIGHT, deskLayout, roomSize } from './layout.js';

function Window({ x, width }) {
  return (
    <group position={[x, 1.75, 0.06]}>
      <mesh>
        <boxGeometry args={[width + 0.16, 1.66, 0.06]} />
        <meshStandardMaterial color="#f4f6f8" />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[width, 1.5]} />
        <meshStandardMaterial color="#cfe9ff" emissive="#bfe3ff" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

export function RoomInterior({ room, networks, lite }) {
  const { width, depth } = roomSize(room);
  const H = ROOM_HEIGHT;
  const desks = useMemo(() => deskLayout(width, depth, room.kind, lite ? 24 : 48), [width, depth, room.kind, lite]);
  const windows = useMemo(() => {
    const n = Math.max(1, Math.floor((width - 2) / 3.2));
    return Array.from({ length: n }, (_, i) => -width / 2 + 1 + ((width - 2) * (i + 0.5)) / n);
  }, [width]);
  const hasBoard = room.kind !== 'canteen' && room.kind !== 'library';

  return (
    <group>
      <SceneLook background="#dfe8f3" />
      <hemisphereLight args={['#ffffff', '#d9cbb3', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[width * 0.2, 8, -depth]}
        intensity={2}
        castShadow={!lite}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-width}
        shadow-camera-right={width}
        shadow-camera-top={depth}
        shadow-camera-bottom={-depth}
      />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d9c4a1" roughness={0.85} />
      </mesh>
      {/* back wall with windows */}
      <group position={[0, 0, -depth / 2]}>
        <mesh position={[0, H / 2, -0.05]} receiveShadow>
          <boxGeometry args={[width, H, 0.1]} />
          <meshStandardMaterial color="#f3efe7" />
        </mesh>
        {windows.map((x) => (
          <Window key={x} x={x} width={2.4} />
        ))}
      </group>
      {/* left wall with the board */}
      <group position={[-width / 2, 0, 0]}>
        <mesh position={[-0.05, H / 2, 0]} receiveShadow>
          <boxGeometry args={[0.1, H, depth]} />
          <meshStandardMaterial color="#efe9df" />
        </mesh>
        {hasBoard && (
          <mesh position={[0.03, 1.6, 0]}>
            <boxGeometry args={[0.04, 1.2, Math.min(4.5, depth - 1.5)]} />
            <meshStandardMaterial color="#fbfdff" roughness={0.3} />
          </mesh>
        )}
      </group>
      {/* skirting line along the cut edges, so the room reads as a box */}
      <mesh position={[0, 0.02, depth / 2]}>
        <boxGeometry args={[width, 0.04, 0.04]} />
        <meshStandardMaterial color="#b8a888" />
      </mesh>
      <mesh position={[width / 2, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.04, depth]} />
        <meshStandardMaterial color="#b8a888" />
      </mesh>

      {hasBoard && <Furniture kind="teacherDesk" position={[-width / 2 + 1.6, 0, 0]} rotation={Math.PI / 2} />}
      {room.kind === 'library' &&
        windows.map((x) => <Furniture key={`b${x}`} kind="bookcase" position={[x, 0, -depth / 2 + 0.35]} />)}
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
      <Furniture kind="plant" position={[width / 2 - 0.7, 0, -depth / 2 + 0.7]} />
      <Furniture kind="plant" position={[-width / 2 + 0.7, 0, depth / 2 - 0.7]} />

      {lite ? null : <ContactShadows position={[0, 0.01, 0]} scale={[width, depth]} opacity={0.35} blur={2.4} far={3} />}

      <SignalField networks={networks} width={width} depth={depth} height={H} lite={lite} accessPoints={room.accessPoints || []} />
    </group>
  );
}
