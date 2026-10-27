// Sets the scene's background colour and fog. (A <color attach="background"> inside a <group>
// would attach to the group, not the scene, and silently do nothing; this sets the scene directly.)
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';

export function SceneLook({ background, fog = null }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.background = new Color(background);
    scene.fog = fog ? new Fog(fog.color, fog.near, fog.far) : null;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background, fog]); // pass a constant fog object (see CampusWorld) so this runs once
  return null;
}

// Shifts the picture so the subject sits in the part of the screen the side panel does not cover:
// left of the panel on wide screens, above the bottom sheet on phones.
export function PanelAwareView({ panelOpen }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!panelOpen) {
      camera.clearViewOffset();
    } else if (size.width > 760) {
      camera.setViewOffset(size.width, size.height, 180, 0, size.width, size.height);
    } else {
      // Phone: the top bar covers ~170 px and the bottom sheet the lower 42%. Centre the picture
      // in the gap between them: shift = (0.42 h - 170) / 2 pixels upward.
      const shift = Math.max(0, (0.42 * size.height - 170) / 2);
      camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, panelOpen]);
  return null;
}

// Portrait phones see a much narrower slice of the scene; move the camera back to compensate.
export function distanceBoost(size) {
  const aspect = size.width / Math.max(size.height, 1);
  return aspect < 1 ? Math.min(2.4, 1.2 / aspect) : 1;
}

// setLookAt, but with the camera pushed back along its line of sight by distanceBoost.
export function lookAt(controls, size, [px, py, pz], [tx, ty, tz], smooth) {
  const k = distanceBoost(size);
  controls.setLookAt(tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k, tx, ty, tz, smooth);
}
