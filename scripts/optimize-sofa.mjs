import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';

export const RETAIN_RATIO = 0.8;
export const JOIN_PLANES = [-0.7, -0.35, 0, 0.35, 0.7];
export const MAX_ERROR_METERS = 0.001;

export function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('Expected a GLB');
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const accessor = (id) => {
    const a = json.accessors[id], view = json.bufferViews[a.bufferView];
    if (view.byteStride || a.sparse) throw new Error('Expected tightly packed sofa attributes');
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
    const ArrayType = a.componentType === 5126 ? Float32Array : Uint32Array;
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const copy = Uint8Array.from(binary.subarray(start, start + a.count * size * 4));
    return new ArrayType(copy.buffer);
  };
  return { json, binary, accessor };
}

export function protectedVertices(positions, indices) {
  const locked = new Uint8Array(positions.length / 3);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  for (let i = 0; i < locked.length; i++) {
    // Preserve all legs, the base welt, and extreme silhouette bands.
    if (positions[i * 3 + 1] < -0.265 || min.some((v, k) => positions[i * 3 + k] < v + 0.006 || positions[i * 3 + k] > max[k] - 0.006)) locked[i] = 1;
  }
  for (let i = 0; i < indices.length; i += 3) {
    const tri = [indices[i], indices[i + 1], indices[i + 2]];
    const xs = tri.map((v) => positions[v * 3]);
    // Lock whole crossing triangles, not just vertices already on a plane.
    if (JOIN_PLANES.some((plane) => Math.min(...xs) <= plane + 0.015 && Math.max(...xs) >= plane - 0.015)) {
      for (const v of tri) locked[v] = 1;
    }
  }
  return locked;
}

export async function optimizeSofa(input, output, reportPath) {
  await MeshoptSimplifier.ready;
  const bytes = fs.readFileSync(input);
  const { json, binary, accessor } = readGlb(bytes);
  const primitive = json.meshes[0].primitives[0];
  const positions = accessor(primitive.attributes.POSITION);
  const normals = accessor(primitive.attributes.NORMAL);
  const indices = accessor(primitive.indices);
  const locks = protectedVertices(positions, indices);
  const target = Math.floor(indices.length / 3 * RETAIN_RATIO) * 3;
  const [result, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, normals, 3, [0.5, 0.5, 0.5], locks, target, MAX_ERROR_METERS, ['LockBorder', 'ErrorAbsolute']);
  if (result.length > target + 6) throw new Error(`Curve protection prevented target: ${result.length / 3} triangles`);
  const used = new Set(result);
  for (let i = 0; i < locks.length; i++) if (locks[i] && !used.has(i) && indices.includes(i)) throw new Error(`Protected vertex ${i} was removed`);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(result);
  const replacements = new Map();
  replacements.set(json.accessors[primitive.indices].bufferView, Buffer.from(result.buffer, result.byteOffset, result.byteLength));
  json.accessors[primitive.indices].count = result.length;
  for (const id of Object.values(primitive.attributes)) {
    const a = json.accessors[id], source = accessor(id);
    const stride = source.length / a.count;
    const values = new Float32Array(vertexCount * stride);
    for (let i = 0; i < remap.length; i++) if (remap[i] < vertexCount) values.set(source.subarray(i * stride, (i + 1) * stride), remap[i] * stride);
    replacements.set(a.bufferView, Buffer.from(values.buffer));
    a.count = vertexCount;
  }
  const chunks = []; let offset = 0;
  json.bufferViews.forEach((view, id) => {
    const data = replacements.get(id) ?? binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    view.byteOffset = offset; view.byteLength = data.length;
    chunks.push(data, Buffer.alloc((4 - data.length % 4) % 4));
    offset += data.length + (4 - data.length % 4) % 4;
  });
  json.buffers[0].byteLength = offset;
  let jsonBytes = Buffer.from(JSON.stringify(json));
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonBytes.length + offset, 8);
  header.writeUInt32LE(jsonBytes.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(output, Buffer.concat([header, jsonBytes, binHeader, ...chunks]));
  const report = { originalTriangles: indices.length / 3, optimizedTriangles: result.length / 3, retainRatio: RETAIN_RATIO, removedPercent: (1 - result.length / indices.length) * 100, originalVertices: positions.length / 3, optimizedVertices: vertexCount, protectedVertices: locks.reduce((sum, v) => sum + v, 0), protectedVerticesRetained: true, joinPlanes: JOIN_PLANES, maxErrorMeters: MAX_ERROR_METERS, measuredErrorMeters: error, originalBytes: bytes.length, optimizedBytes: fs.statSync(output).size };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output, report] = process.argv;
  if (!input || !output || !report) throw new Error('Usage: bun scripts/optimize-sofa.mjs input.glb output.glb report.json');
  await optimizeSofa(input, output, report);
}