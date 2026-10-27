// Puts the camera at the open corner of the room, looking in.
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ROOM_HEIGHT } from './layout.js';
import { lookAt } from './SceneLook.jsx';

export function RoomCamera({ width, depth, roomId }) {
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!controls) return;
    const span = Math.max(width, depth);
    lookAt(controls, size, [width * 0.6, ROOM_HEIGHT + span * 0.5, depth * 0.55 + span * 0.7], [-width * 0.05, 0.9, -depth * 0.05], false);
  }, [controls, size, width, depth, roomId]);
  return null;
}
