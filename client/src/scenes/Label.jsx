// A label floating in the 3D scene (drei <Html>), always attached to our own overlay <div>.
// Without a fixed target, drei sometimes mounts the first label before the canvas is in the page,
// and that label never appears. The overlay div exists before the 3D scene renders, so this cannot happen.
import { createContext, useContext } from 'react';
import { Html } from '@react-three/drei';

export const LabelLayerContext = createContext(null);

export function Label(props) {
  const layer = useContext(LabelLayerContext);
  return <Html portal={layer || undefined} {...props} />;
}
