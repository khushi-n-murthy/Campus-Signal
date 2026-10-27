// Reads just enough of a .glb file to check it is valid and how big its model is.
import fs from 'node:fs';

export function inspectGlb(bufferOrPath) {
  const buf = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : fs.readFileSync(bufferOrPath);
  if (buf.length < 20) throw new Error('file is too small to be a .glb');
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a binary glTF (.glb) file; use the .glb version of the model');
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`glTF version ${version}; three.js needs version 2`);
  const jsonLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON');
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let meshes = 0;
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const acc = gltf.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      meshes += 1;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], acc.min[i]);
        max[i] = Math.max(max[i], acc.max[i]);
      }
    }
  }
  if (!meshes) throw new Error('no mesh with positions found inside');
  const external = (gltf.buffers || []).some((b) => b.uri) || (gltf.images || []).some((im) => im.uri);
  if (external) throw new Error('this .glb points at outside files; export/copy a self-contained .glb');
  // Mesh-local size; ignores node transforms, which is fine for a sanity check.
  return { size: [0, 1, 2].map((i) => max[i] - min[i]), meshes };
}

// Builds a tiny valid .glb (a box) in memory. Used to test the checker itself.
export function makeBoxGlb(w, h, d) {
  const json = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [w, h, d] }],
  };
  const bin = Buffer.alloc(36);
  [0, 0, 0, w, 0, 0, w, h, d].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  let jsonBuf = Buffer.from(JSON.stringify(json));
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const c0 = Buffer.alloc(8);
  c0.writeUInt32LE(jsonBuf.length, 0);
  c0.writeUInt32LE(0x4e4f534a, 4);
  const c1 = Buffer.alloc(8);
  c1.writeUInt32LE(bin.length, 0);
  c1.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, c0, jsonBuf, c1, bin]);
}
