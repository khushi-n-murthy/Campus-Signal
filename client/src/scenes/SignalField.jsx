// The glowing signal streams inside a room. (Normal blending, not additive: additive light turns
// white against the bright classroom walls and the colour would be lost.)
// Every visual property is driven by a measured number:
//   colour + glow    = score (blue strong ... red dead)
//   particle speed   = download Mbps
//   wobble / flicker = jitter
//   particles dying mid-flight = packet loss
//   faintness        = how few tests back the number (confidence)
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from './Label.jsx';
import { CatmullRomCurve3, Matrix4, NormalBlending, Vector3 } from 'three';
import { scoreHex } from '../lib/colors.js';
import { scoreColor } from './color3.js';
import { clamp01, streamParams } from './streamParams.js';

// Seeded random numbers: the same room always draws the same streams.
function rng(seedText) {
  let a = 0;
  for (const ch of seedText) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LUT = 160; // points sampled along each curve

function NetworkStreams({ net, source, targets, lite, seed, labelLift = 0 }) {
  const meshRef = useRef();
  const p = streamParams(net);
  const color = useMemo(() => scoreColor(net.score).multiplyScalar(1.8), [net.score]); // > 1 = glows under bloom, low enough to keep its hue
  const perStream = lite ? 14 : 28;

  const { curves, tables, state } = useMemo(() => {
    const rand = rng(seed);
    const cs = targets.map((tgt) => {
      const side = new Vector3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(1.6);
      const m1 = source.clone().lerp(tgt, 0.33).add(new Vector3(0, 0.7, 0)).add(side);
      const m2 = source.clone().lerp(tgt, 0.66).add(new Vector3(0, 0.35, 0)).sub(side.clone().multiplyScalar(0.5));
      return new CatmullRomCurve3([source.clone(), m1, m2, tgt.clone()]);
    });
    const tbs = cs.map((c) => c.getSpacedPoints(LUT - 1));
    const n = cs.length * perStream;
    const s = { t: new Float32Array(n), phase: new Float32Array(n), death: new Float32Array(n), size: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      s.t[i] = rand();
      s.phase[i] = rand() * Math.PI * 2;
      s.death[i] = rand() < p.deathChance ? 0.2 + rand() * 0.7 : 2;
      s.size[i] = 0.03 + rand() * 0.03;
    }
    return { curves: cs, tables: tbs, state: s };
  }, [source, targets, seed, perStream, p.deathChance]);

  const m = useMemo(() => new Matrix4(), []);
  const pos = useMemo(() => new Vector3(), []);
  // Start every particle invisible (scale 0) so nothing flashes at the room centre on the first frame.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, zero);
    mesh.instanceMatrix.needsUpdate = true;
  }, [curves, perStream]);
  const rerollRand = useMemo(() => rng(`${seed}-reroll`), [seed]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const time = clock.elapsedTime;
    const n = state.t.length;
    for (let i = 0; i < n; i++) {
      let t = state.t[i] + p.speed * dt * (0.85 + 0.3 * Math.sin(state.phase[i]));
      if (t >= 1) {
        t -= 1;
        state.death[i] = rerollRand() < p.deathChance ? 0.2 + rerollRand() * 0.7 : 2;
      }
      state.t[i] = t;
      const table = tables[Math.floor(i / perStream)];
      const f = t * (LUT - 1);
      const k = Math.min(LUT - 2, Math.floor(f));
      pos.lerpVectors(table[k], table[k + 1], f - k);
      const ph = state.phase[i];
      pos.x += Math.sin(time * 6 + ph) * p.wobble;
      pos.y += Math.cos(time * 5 + ph * 1.3) * p.wobble * 0.6;
      pos.z += Math.sin(time * 4 + ph * 0.7) * p.wobble * 0.5;
      let s = state.size[i];
      s *= clamp01(t / 0.08) * clamp01((1 - t) / 0.08); // fade in at the source, out at the desk
      if (t > state.death[i]) s *= clamp01(1 - (t - state.death[i]) / 0.05); // a lost packet
      m.makeScale(s, s, s);
      m.setPosition(pos);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, curves.length * perStream]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={p.opacity} depthWrite={false} blending={NormalBlending} />
      </instancedMesh>
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 48, 0.012, 5, false]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.16 * p.opacity} depthWrite={false} blending={NormalBlending} />
        </mesh>
      ))}
      <mesh position={source}>
        <sphereGeometry args={[0.14, 20, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {!lite && <pointLight position={source} color={scoreColor(net.score)} intensity={1.5 + net.score / 25} distance={7} decay={2} />}
      <Label position={[source.x, source.y + 0.45 + labelLift, source.z]} center zIndexRange={[20, 0]}>
        <div className="source-tag" style={{ borderColor: scoreHex(net.score) }}>
          <b>{net.carrier}</b> {Math.round(net.score)}
          {net.confidence === 'low' ? <i> · few tests</i> : null}
        </div>
      </Label>
    </group>
  );
}

// networks: rows from GET /api/rooms/:id (already filtered to what should be shown).
export function SignalField({ networks, width, depth, height, lite, accessPoints = [] }) {
  // Positions depend only on the room and WHICH networks are shown, not on their latest numbers,
  // so a live update changes colour/speed smoothly instead of redrawing every stream.
  const carriers = networks.map((n) => n.carrier).join('|');
  const ap = accessPoints[0];
  const apX = ap?.x;
  const apY = ap?.y;
  const layout = useMemo(() => {
    const names = carriers ? carriers.split('|') : [];
    const rand = rng(`targets-${width}-${depth}`);
    const streams = lite ? 4 : 8;
    return names.map((carrier, i) => {
      const useAp = carrier === 'Campus WiFi' && apX != null;
      const source = useAp
        ? new Vector3(apX - width / 2, height - 0.3, apY - depth / 2) // real AP position from campus.json
        : new Vector3(-width / 2 + (width * (i + 1)) / (names.length + 1), height - 0.4, -depth / 2 + 0.4);
      const targets = Array.from({ length: streams }, () =>
        new Vector3((rand() - 0.5) * (width - 2), 0.85 + rand() * 0.3, -depth / 2 + 2 + rand() * (depth - 3)),
      );
      return { carrier, source, targets };
    });
  }, [carriers, width, depth, height, lite, apX, apY]);

  // labelLift: every second label sits higher, so neighbouring labels never overlap.
  return layout.map(({ carrier, source, targets }, i) => {
    const net = networks.find((n) => n.carrier === carrier);
    return net ? (
      <NetworkStreams
        key={carrier}
        net={net}
        source={source}
        targets={targets}
        lite={lite}
        seed={`${carrier}-${width}-${depth}`}
        labelLift={i % 2 ? 0.55 : 0}
      />
    ) : null;
  });
}
