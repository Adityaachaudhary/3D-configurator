import * as THREE from "three";
import { boucleHeightField, leatherHeightField } from "./leather-grain";

export function createSurfaceMaps(kind: string) {
  const size = kind === "leather" ? 512 : 256;
  const grain = kind === "leather" ? leatherHeightField(size) : null;
  const grainB = kind === "boucle" ? boucleHeightField(size) : null;
  const colour = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const noise = Math.sin(u * 73 + Math.sin(v * 41)) * Math.sin(v * 67 + Math.cos(u * 29));
      let height: number;
      if (kind === "wood")
        height =
          0.5 +
          0.28 * Math.sin(u * 18 + 1.6 * Math.sin(v * 2) + 0.5 * Math.sin(v * 5)) +
          noise * 0.06;
      else if (kind === "steel") height = 0.5 + 0.2 * Math.sin(u * 95) + noise * 0.05;
      else if (kind === "loop")
        height =
          0.5 +
          0.23 * Math.sin(u * 9 + Math.sin(v * 11)) * Math.cos(v * 11 + Math.sin(u * 9)) +
          noise * 0.1;
      else if (kind === "boucle") height = grainB?.[y * size + x] ?? 0.5;
      else if (kind === "velvet") height = 0.5 + noise * 0.12;
      else if (kind === "leather") height = 0.15 + 0.7 * (grain?.[y * size + x] ?? 0.5);
      else {
        const warp = Math.cos(u * 32);
        const weft = Math.cos(v * 32);
        const over = kind === "twill" ? Math.sin((u + v) * 8) : Math.sin(u * 16) * Math.sin(v * 16);
        height = 0.5 + 0.22 * (over > 0 ? warp : weft) + noise * 0.06;
      }
      const i = (y * size + x) * 4;
      const contrast =
        kind === "wood"
          ? 0.3
          : kind === "steel"
            ? 0.1
            : kind === "leather"
              ? 0.2
              : kind === "velvet"
                ? 0.045
                : kind === "boucle"
                  ? 0.2
                  : kind === "loop"
                    ? 0.5
                    : 0.32;
      const value = Math.round(255 * THREE.MathUtils.clamp(0.94 + (height - 0.5) * contrast, 0, 1));
      height = THREE.MathUtils.clamp(height, 0, 1);
      for (let k = 0; k < 3; k++) {
        colour[i + k] = value;
        relief[i + k] = Math.round(height * 255);
        rough[i + k] = Math.round(
          255 * (kind === "leather" ? 0.78 + (1 - height) * 0.22 : 0.88 + height * 0.12),
        );
      }
      colour[i + 3] = relief[i + 3] = rough[i + 3] = 255;
    }
  }

  const make = (data: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(data, size, size);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };

  return { map: make(colour, true), bumpMap: make(relief), roughnessMap: make(rough) };
}

export function projectSurface(
  material: THREE.MeshPhysicalMaterial,
  density: number,
  tufted = false,
) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 surfacePosition;
      varying vec3 surfaceNormal;
      varying float surfaceBaseY;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      surfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      surfaceBaseY = position.y;
      surfaceNormal = normalize(vec3(
        dot(normal, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)),
        dot(normal, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)),
        dot(normal, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))
      ));`,
    );
    if (tufted) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        uniform float arTuftDensity;
        float arTuftProfile(vec2 uv) {
          vec2 cell = fract(vec2(uv.x + uv.y, uv.x - uv.y));
          vec2 edge = min(cell, 1.0 - cell);
          float radius = dot(edge, edge);
          float crown = pow(max(0.0, sin(cell.x * 3.14159265) * sin(cell.y * 3.14159265)), 1.3);
          float pleat = 1.0 - exp(-min(edge.x, edge.y) / 0.035);
          return clamp(0.30 + 0.62 * crown + 0.08 * pleat
            - 0.34 * exp(-radius / 0.0055) + 0.22 * exp(-radius / 0.0011), 0.0, 1.0);
        }`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec3 arTuftWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec3 arTuftNormal = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
        vec3 arTuftWeights = pow(abs(arTuftNormal), vec3(12.0));
        arTuftWeights /= max(dot(arTuftWeights, vec3(1.0)), 0.0001);
        float arTuftPadding = dot(vec3(
          arTuftProfile(arTuftWorld.zy * arTuftDensity),
          arTuftProfile(arTuftWorld.xz * arTuftDensity),
          arTuftProfile(arTuftWorld.xy * arTuftDensity)), arTuftWeights);
        float arTuftMask = smoothstep(0.64, 0.78,
          max(abs(arTuftNormal.x), max(abs(arTuftNormal.y), abs(arTuftNormal.z))))
          * smoothstep(-0.320, -0.265, position.y);
        vec3 arTuftOffset = -arTuftNormal * 0.004 * arTuftMask * (1.0 - arTuftPadding);
        vec3 arTuftX = modelMatrix[0].xyz;
        vec3 arTuftY = modelMatrix[1].xyz;
        vec3 arTuftZ = modelMatrix[2].xyz;
        transformed += vec3(
          dot(arTuftOffset, arTuftX) / max(dot(arTuftX, arTuftX), 0.000001),
          dot(arTuftOffset, arTuftY) / max(dot(arTuftY, arTuftY), 0.000001),
          dot(arTuftOffset, arTuftZ) / max(dot(arTuftZ, arTuftZ), 0.000001));
        #include <project_vertex>`,
      );
    }

    shader.fragmentShader = `varying vec3 surfacePosition;
      varying vec3 surfaceNormal;
      varying float surfaceBaseY;
      uniform float surfaceDensity;
      vec4 surfaceSample(sampler2D tex, vec3 p) {
        vec3 weights = pow(abs(normalize(surfaceNormal)), vec3(6.0));
        weights /= max(weights.x + weights.y + weights.z, 0.0001);
        vec3 tileP = p * surfaceDensity;
        return texture2D(tex, tileP.zy) * weights.x
          + texture2D(tex, tileP.xz) * weights.y
          + texture2D(tex, tileP.xy) * weights.z;
      }\n${shader.fragmentShader}`;
    shader.uniforms["surfaceDensity"] = { value: density };
    if (tufted) {
      shader.uniforms["arTuftDensity"] = { value: 4.5 };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform float arTuftDensity;
        float arTuftProfile(vec2 uv, float detail, vec2 footprint) {
          vec2 cell = fract(vec2(uv.x + uv.y, uv.x - uv.y));
          vec2 edge = min(cell, 1.0 - cell);
          vec2 filterWidth = min(footprint, vec2(0.12));
          edge = sqrt(edge * edge + filterWidth * filterWidth * 0.25);
          float radius = dot(edge, edge);
          float crown = pow(max(0.0, sin(cell.x * 3.14159265) * sin(cell.y * 3.14159265)), 1.3);
          float edgeWidth = max(max(filterWidth.x, filterWidth.y), 0.00001);
          float pleat = (1.0 - exp(-min(edge.x, edge.y) / 0.035))
            * smoothstep(0.0, edgeWidth, min(edge.x, edge.y));
          return clamp(0.30 + 0.62 * crown + 0.08 * pleat
            - 0.34 * exp(-radius / 0.0055) + 0.22 * detail * exp(-radius / 0.0011), 0.0, 1.0);
        }
        float arTuftHeight(vec3 p) {
          vec3 weights = pow(abs(normalize(surfaceNormal)), vec3(12.0));
          weights /= max(dot(weights, vec3(1.0)), 0.0001);
          float detail = 1.0 - smoothstep(0.03, 0.09,
            length(fwidth(surfacePosition)) * arTuftDensity);
          vec2 armUV = p.zy * arTuftDensity;
          vec2 seatUV = p.xz * arTuftDensity;
          vec2 backUV = p.xy * arTuftDensity;
          vec3 height = vec3(
            arTuftProfile(armUV, detail, fwidth(vec2(armUV.x + armUV.y, armUV.x - armUV.y))),
            arTuftProfile(seatUV, detail, fwidth(vec2(seatUV.x + seatUV.y, seatUV.x - seatUV.y))),
            arTuftProfile(backUV, detail, fwidth(vec2(backUV.x + backUV.y, backUV.x - backUV.y))));
          return dot(height, weights);
        }
        float arTuftMask() {
          return smoothstep(0.64, 0.78, max(abs(surfaceNormal.x),
            max(abs(surfaceNormal.y), abs(surfaceNormal.z))))
            * smoothstep(-0.320, -0.265, surfaceBaseY);
        }`,
      );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_fragment>", THREE.ShaderChunk.map_fragment)
      .replace(
        "#include <roughnessmap_fragment>",
        `${THREE.ShaderChunk.roughnessmap_fragment}${
          tufted
            ? `
          roughnessFactor = clamp(roughnessFactor * mix(1.22, 0.88,
            arTuftHeight(surfacePosition)), 0.04, 1.0);`
            : ""
        }`,
      )
      .replace("#include <bumpmap_pars_fragment>", THREE.ShaderChunk.bumpmap_pars_fragment)
      .replace("texture2D( map, vMapUv )", "surfaceSample(map, surfacePosition)")
      .replace(
        "texture2D( roughnessMap, vRoughnessMapUv )",
        "surfaceSample(roughnessMap, surfacePosition)",
      )
      .replace("vec2 dSTdx = dFdx( vBumpMapUv );", "vec3 dSTdx = dFdx(surfacePosition);")
      .replace("vec2 dSTdy = dFdy( vBumpMapUv );", "vec3 dSTdy = dFdy(surfacePosition);")
      .replace("texture2D( bumpMap, vBumpMapUv ).x", "surfaceSample(bumpMap, surfacePosition).x")
      .replace(
        "texture2D( bumpMap, vBumpMapUv + dSTdx ).x",
        "surfaceSample(bumpMap, surfacePosition + dSTdx).x",
      )
      .replace(
        "texture2D( bumpMap, vBumpMapUv + dSTdy ).x",
        "surfaceSample(bumpMap, surfacePosition + dSTdy).x",
      );
    if (tufted) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <color_fragment>",
          `${THREE.ShaderChunk.color_fragment}
          float arTuftShade = arTuftHeight(surfacePosition);
          diffuseColor.rgb *= mix(1.0,
            0.45 + 0.55 * smoothstep(0.0, 0.85, arTuftShade), arTuftMask());`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `${THREE.ShaderChunk.normal_fragment_maps}
          vec3 arTuftNormal = normalize(surfaceNormal);
          vec3 arTuftAbsNormal = abs(arTuftNormal);
          int arTuftPanel = arTuftAbsNormal.y >= arTuftAbsNormal.x
            && arTuftAbsNormal.y >= arTuftAbsNormal.z ? 1
            : (arTuftAbsNormal.z >= arTuftAbsNormal.x ? 2 : 0);
          vec3 arTuftAxisU = arTuftPanel == 0 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
          vec3 arTuftAxisV = arTuftPanel == 1 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
          float arTuftStep = 0.003;
          float arTuftH1 = arTuftHeight(surfacePosition + arTuftAxisU * arTuftStep)
            - arTuftHeight(surfacePosition - arTuftAxisU * arTuftStep);
          float arTuftH2 = arTuftHeight(surfacePosition + arTuftAxisV * arTuftStep)
            - arTuftHeight(surfacePosition - arTuftAxisV * arTuftStep);
          vec3 arTuftGradient = (arTuftAxisU * arTuftH1 + arTuftAxisV * arTuftH2)
            * (0.085 / (2.0 * arTuftStep));
          vec3 arTuftGradientView = (viewMatrix * vec4(arTuftGradient, 0.0)).xyz;
          arTuftGradientView -= dot(arTuftGradientView, normal) * normal;
          normal = normalize(normal - arTuftGradientView * arTuftMask());`,
        );
    }
  };
  material.customProgramCacheKey = () =>
    `ar-physical-surface-${density}-${tufted ? "tufted" : "plain"}`;
}

export function isFloorSurfaceTransform(
  transform: ArrayLike<number>,
  floorY = 0,
  heightTolerance = 0.35,
) {
  const matrix = new THREE.Matrix4().fromArray(transform);
  const orientation = new THREE.Quaternion();
  matrix.decompose(new THREE.Vector3(), orientation, new THREE.Vector3());
  return (
    new THREE.Vector3(0, 1, 0).applyQuaternion(orientation).y >= 0.85 &&
    Math.abs(matrix.elements[13]! - floorY) <= heightTolerance
  );
}

export function alignToFloor(scene: THREE.Group, floor: THREE.Vector3) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  scene.position.x += floor.x - center.x;
  scene.position.y += floor.y - bounds.min.y;
  scene.position.z += floor.z - center.z;
}

export function splitSofaGeometry(source: THREE.BufferGeometry) {
  const geometry = source.clone();
  const position = geometry.getAttribute("position");
  const sourceIndex = geometry.index;
  const triangleCount = sourceIndex ? sourceIndex.count / 3 : position.count / 3;

  const legAxes = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]
    .map(([sx, sz]) => {
      let x = 0;
      let z = 0;
      let count = 0;
      for (let index = 0; index < position.count; index += 1) {
        const px = position.getX(index);
        const pz = position.getZ(index);
        if (position.getY(index) < -0.37 && px * (sx ?? 1) > 0.7 && pz * (sz ?? 1) > 0.2) {
          x += px;
          z += pz;
          count += 1;
        }
      }
      return count ? ([x / count, z / count] as const) : null;
    })
    .filter((axis): axis is readonly [number, number] => axis !== null);

  const upholstery: number[] = [];
  const legs: number[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const indices = [0, 1, 2].map((corner) =>
      sourceIndex ? sourceIndex.getX(triangle * 3 + corner) : triangle * 3 + corner,
    );
    const centerX = indices.reduce((sum, index) => sum + position.getX(index), 0) / 3;
    const centerY = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
    const centerZ = indices.reduce((sum, index) => sum + position.getZ(index), 0) / 3;
    const isLeg =
      centerY < -0.3085 && legAxes.some(([x, z]) => Math.hypot(centerX - x, centerZ - z) < 0.0335);
    (isLeg ? legs : upholstery).push(...indices);
  }

  geometry.setIndex([...upholstery, ...legs]);
  geometry.clearGroups();
  geometry.addGroup(0, upholstery.length, 0);
  geometry.addGroup(upholstery.length, legs.length, 1);
  geometry.userData["arMaterialGroups"] = true;
  return geometry;
}

export function splitSofaGeometryAsync(source: THREE.BufferGeometry): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/ar-geometry.worker.ts", import.meta.url), {
      type: "module",
    });
    const position = source.getAttribute("position");
    const positions = new Float32Array(position.array as ArrayLike<number>);
    const sourceIndex = source.index?.array;
    const indices = sourceIndex
      ? Uint32Array.from(sourceIndex)
      : Uint32Array.from({ length: position.count }, (_, index) => index);

    worker.onmessage = (
      event: MessageEvent<{ indices?: ArrayBuffer; upholsteryIndexCount?: number; error?: string }>,
    ) => {
      worker.terminate();
      if (!event.data.indices || event.data.upholsteryIndexCount === undefined) {
        reject(new Error(event.data.error ?? "Failed to split AR sofa geometry"));
        return;
      }
      const geometry = source.clone();
      const splitIndices = source.getAttribute("position").count <= 65_535
        ? new Uint16Array(event.data.indices)
        : new Uint32Array(event.data.indices);
      geometry.setIndex(new THREE.BufferAttribute(splitIndices, 1));
      geometry.clearGroups();
      geometry.addGroup(0, event.data.upholsteryIndexCount, 0);
      geometry.addGroup(
        event.data.upholsteryIndexCount,
        splitIndices.length - event.data.upholsteryIndexCount,
        1,
      );
      geometry.userData["arMaterialGroups"] = true;
      resolve(geometry);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(`AR sofa geometry worker failed: ${event.message}`));
    };
    worker.postMessage({ positions, indices }, [positions.buffer, indices.buffer]);
  });
}
