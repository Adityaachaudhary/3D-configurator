export function splitARIndices(positions: Float32Array, indices: Uint32Array) {
  const legAxes: Array<[number, number]> = [];

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      let x = 0;
      let z = 0;
      let count = 0;
      for (let index = 0; index < positions.length / 3; index += 1) {
        const px = positions[index * 3]!;
        const py = positions[index * 3 + 1]!;
        const pz = positions[index * 3 + 2]!;
        if (py < -0.37 && px * sx > 0.7 && pz * sz > 0.2) {
          x += px;
          z += pz;
          count += 1;
        }
      }
      if (count) legAxes.push([x / count, z / count]);
    }
  }

  const triangleCount = indices.length / 3;
  const isLeg = new Uint8Array(triangleCount);
  let legIndexCount = 0;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = indices[offset]!;
    const b = indices[offset + 1]!;
    const c = indices[offset + 2]!;
    const x = (positions[a * 3]! + positions[b * 3]! + positions[c * 3]!) / 3;
    const y =
      (positions[a * 3 + 1]! + positions[b * 3 + 1]! + positions[c * 3 + 1]!) / 3;
    const z = (positions[a * 3 + 2]! + positions[b * 3 + 2]! + positions[c * 3 + 2]!) / 3;
    if (y < -0.3085 && legAxes.some(([axisX, axisZ]) => Math.hypot(x - axisX, z - axisZ) < 0.0335)) {
      isLeg[triangle] = 1;
      legIndexCount += 3;
    }
  }

  const result =
    positions.length / 3 <= 65_535
      ? new Uint16Array(indices.length)
      : new Uint32Array(indices.length);
  let upholsteryOffset = 0;
  let legOffset = indices.length - legIndexCount;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const destination = isLeg[triangle] ? legOffset : upholsteryOffset;
    const sourceOffset = triangle * 3;
    result[destination] = indices[sourceOffset]!;
    result[destination + 1] = indices[sourceOffset + 1]!;
    result[destination + 2] = indices[sourceOffset + 2]!;
    if (isLeg[triangle]) legOffset += 3;
    else upholsteryOffset += 3;
  }

  return { indices: result, upholsteryIndexCount: indices.length - legIndexCount };
}
