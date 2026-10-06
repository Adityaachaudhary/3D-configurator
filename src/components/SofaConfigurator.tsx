import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Line,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import {
  Box,
  Check,
  ChevronDown,
  CircleGauge,
  Download,
  Expand,
  Frame,
  Grid3X3,
  Maximize2,
  Minus,
  Move3D,
  Plus,
  Rotate3D,
  Ruler,
  Scan,
  SunMedium,
  Undo2,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import sofaAsset from "@/assets/Panache-OPAA.glb.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FabricId = "oat" | "sage" | "clay" | "ink" | "pearl" | "moss" | "ocean-stripe" | "olive-check" | "rose-check" | "ochre-chevron" | "teal-diamond" | "graphite-stripe" | "cognac-leather" | "charcoal-leather" | "ivory-leather" | "olive-leather" | "chesterfield-oxblood" | "chesterfield-saddle";
type PatternKind = "stripe" | "check" | "chevron" | "diamond";
type FabricPreset = { id: FabricId; name: string; family: string; color: string; weave: string; pattern?: PatternKind; tufted?: boolean };
type LegId = "oak" | "walnut" | "ebonized" | "steel";
type Unit = "cm" | "mm" | "in";
type ViewName = "perspective" | "front" | "side" | "rear";
type SeatCount = 1 | 2 | 3;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

const MODULE_WIDTH = 0.7;
// The chart specifies exact inches; its millimeter equivalents are rounded.
const INCH_METERS = 0.0254;
const seatingWidth = (seats: number) => (34 + (seats - 1) * 24) * INCH_METERS;
const BASE_SIZE = { width: seatingWidth(2), height: 32 * INCH_METERS, depth: 33 * INCH_METERS };
const FABRICS: FabricPreset[] = [
  { id: "oat", name: "Oat Bouclé", family: "Bouclé 04", color: "#b8aa91", weave: "loop" },
  { id: "pearl", name: "Pearl Linen", family: "Linen 01", color: "#d7d2c7", weave: "linen" },
  { id: "sage", name: "Sage Weave", family: "Weave 12", color: "#788477", weave: "linen" },
  { id: "clay", name: "Clay Twill", family: "Twill 07", color: "#a66f5b", weave: "twill" },
  { id: "moss", name: "Forest Chenille", family: "Chenille 09", color: "#46564b", weave: "loop" },
  { id: "ink", name: "Ink Velvet", family: "Velvet 02", color: "#34383b", weave: "velvet" },
  { id: "ocean-stripe", name: "Ocean Stripe", family: "Stripe · Linen", color: "#ffffff", weave: "linen", pattern: "stripe" },
  { id: "olive-check", name: "Olive Check", family: "Check · Woven", color: "#ffffff", weave: "linen", pattern: "check" },
  { id: "rose-check", name: "Rose Check", family: "Check · Woven", color: "#ffffff", weave: "linen", pattern: "check" },
  { id: "ochre-chevron", name: "Ochre Chevron", family: "Chevron · Twill", color: "#ffffff", weave: "twill", pattern: "chevron" },
  { id: "teal-diamond", name: "Teal Diamond", family: "Diamond · Jacquard", color: "#ffffff", weave: "twill", pattern: "diamond" },
  { id: "graphite-stripe", name: "Graphite Stripe", family: "Stripe · Linen", color: "#ffffff", weave: "linen", pattern: "stripe" },
  { id: "cognac-leather", name: "Cognac Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
  { id: "charcoal-leather", name: "Charcoal Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
  { id: "ivory-leather", name: "Ivory Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
  { id: "olive-leather", name: "Olive Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
  { id: "chesterfield-oxblood", name: "Oxblood Chesterfield", family: "Leather · Button tufted", color: "", weave: "leather", tufted: true },
  { id: "chesterfield-saddle", name: "Saddle Chesterfield", family: "Leather · Button tufted", color: "", weave: "leather", tufted: true },
];
const LEGS: Array<{ id: LegId; name: string; color: string; metalness: number; roughness: number }> = [
  { id: "oak", name: "Natural oak", color: "#9b7147", metalness: 0, roughness: 0.54 },
  { id: "walnut", name: "Dark walnut", color: "#4f3225", metalness: 0, roughness: 0.48 },
  { id: "ebonized", name: "Ebonized wood", color: "#20211f", metalness: 0, roughness: 0.42 },
  { id: "steel", name: "Brushed steel", color: "#898b87", metalness: 0.82, roughness: 0.3 },
];
const VIEWS: Record<ViewName, [number, number, number]> = {
  perspective: [2.9, 1.9, 3.3],
  front: [0, 1.15, 4.2],
  side: [4.2, 1.15, 0],
  rear: [0, 1.15, -4.2],
};
const DEFAULT_FABRIC = FABRICS[0] as (typeof FABRICS)[number];
const DEFAULT_LEG = LEGS[0] as (typeof LEGS)[number];

function formatDimension(meters: number, unit: Unit) {
  const factor = unit === "cm" ? 100 : unit === "mm" ? 1000 : 1 / 0.0254;
  return `${(meters * factor).toFixed(unit === "mm" ? 0 : 1)} ${unit}`;
}

// Neutral microstructure keeps the selected colour from being multiplied twice.
// All maps use the same physical projection, independent of the imported UV atlas.
function createSurfaceMaps(kind: string) {
  const size = 256;
  const colour = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const noise = Math.sin(u * 73 + Math.sin(v * 41)) * Math.sin(v * 67 + Math.cos(u * 29));
      let height: number;
      if (kind === "wood") height = 0.5 + 0.28 * Math.sin(u * 18 + 1.6 * Math.sin(v * 2) + 0.5 * Math.sin(v * 5)) + noise * 0.06;
      else if (kind === "steel") height = 0.5 + 0.2 * Math.sin(u * 95) + noise * 0.05;
      else if (kind === "loop") height = 0.5 + 0.23 * Math.sin(u * 20 + Math.sin(v * 24)) * Math.cos(v * 24 + Math.sin(u * 20)) + noise * 0.1;
      else if (kind === "velvet") height = 0.5 + noise * 0.12;
      else if (kind === "leather") height = 0.5 + 0.19 * Math.sin(u * 12 + 2 * Math.sin(v * 7)) * Math.sin(v * 15 + Math.cos(u * 9)) + noise * 0.04;
      else if (kind === "tuft") {
        const a = (x / size + y / size) % 1;
        const b = ((x / size - y / size) % 1 + 1) % 1;
        const crown = Math.pow(Math.max(0, Math.sin(a * Math.PI) * Math.sin(b * Math.PI)), 0.55);
        const edgeA = Math.min(a, 1 - a), edgeB = Math.min(b, 1 - b);
        const button = Math.exp(-(edgeA * edgeA + edgeB * edgeB) / 0.0012);
        height = Math.max(0, 0.12 + crown * 0.84 - button * 0.12);
      }
      else {
        const warp = Math.cos(u * 32);
        const weft = Math.cos(v * 32);
        const over = kind === "twill" ? Math.sin((u + v) * 8) : Math.sin(u * 16) * Math.sin(v * 16);
        height = 0.5 + 0.22 * (over > 0 ? warp : weft) + noise * 0.06;
      }
      const i = (y * size + x) * 4;
      const contrast = kind === "wood" ? 0.3 : kind === "leather" ? 0.12 : kind === "velvet" ? 0.045 : 0.10;
      const value = Math.round(255 * (kind === "tuft" ? 0.65 + height * 0.35 : 0.94 + (height - 0.5) * contrast));
      for (let k = 0; k < 3; k += 1) {
        colour[i + k] = value;
        relief[i + k] = Math.round(height * 255);
        rough[i + k] = Math.round(255 * (0.88 + height * 0.12));
      }
      colour[i + 3] = relief[i + 3] = rough[i + 3] = 255;
    }
  }
  const make = (data: Uint8Array, srgb = false) => {
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { map: make(colour, true), bumpMap: make(relief), roughnessMap: make(rough) };
}

// The preview and upholstery share exactly the same seamless repeat artwork.
function createPatternCanvas(fabric: FabricPreset) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx || !fabric.pattern) return canvas;
  const css = getComputedStyle(document.documentElement);
  const palette = ["base", "accent", "detail"].map((role) => {
    ctx.fillStyle = css.getPropertyValue(`--pattern-${fabric.id}-${role}`).trim();
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = y / 256;
    let color = 0;
    if (fabric.pattern === "stripe") color = u < 0.42 ? 0 : u < 0.78 ? 1 : u < 0.84 ? 2 : 0;
    if (fabric.pattern === "check") {
      const a = u < 0.5, b = v < 0.5;
      color = a && b ? 1 : a || b ? 2 : 0;
    }
    if (fabric.pattern === "chevron") {
      const zig = Math.abs(u * 2 - 1);
      const band = (v + zig * 0.5) % 1;
      color = band < 0.42 ? 0 : band < 0.82 ? 1 : 2;
    }
    if (fabric.pattern === "diamond") {
      const d = Math.abs(u - 0.5) + Math.abs(v - 0.5);
      color = d < 0.26 ? 1 : d < 0.31 || d > 0.69 && d < 0.74 ? 2 : 0;
    }
    const rgb = palette[color] ?? palette[0] ?? [];
    const thread = 0.97 + 0.03 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2);
    const i = (y * 256 + x) * 4;
    for (let k = 0; k < 3; k++) image.data[i + k] = (rgb[k] ?? 0) * thread;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function FabricSwatch({ fabric }: { fabric: FabricPreset }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return;
    if (fabric.pattern) {
      const artwork = createPatternCanvas(fabric);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(artwork, x * 64, y * 64, 64, 64);
    } else {
      const maps = createSurfaceMaps(fabric.tufted ? "tuft" : fabric.weave);
      const data = maps.map.image.data;
      const image = ctx.createImageData(192, 192);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(`--fabric-${fabric.id}`).trim();
      ctx.fillRect(0, 0, 1, 1);
      const color = ctx.getImageData(0, 0, 1, 1).data;
      for (let i = 0; i < 192 * 192; i++) {
        const source = ((Math.floor(i / 192) * 256 + i % 192) * 4);
        for (let k = 0; k < 3; k++) image.data[i * 4 + k] = (color[k] ?? 0) * (data?.[source] ?? 255) / 255;
        image.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      Object.values(maps).forEach((map) => map.dispose());
    }
  }, [fabric]);
  return <span className="relative block h-9 w-full shrink-0 overflow-hidden rounded-[3px]"><canvas ref={canvas} width={192} height={192} aria-hidden="true" className="absolute inset-0 block h-full w-full" /></span>;
}

// Restrict thread size to a believable range; printed repeat size remains independently adjustable.
const weaveDensity = (value: number) => 5.6 * 7 / (5.5 + (value - 3) * 3 / 11);
const leatherDensity = (value: number) => 11 - (value - 3) * 8 / 11;

function projectSurface(material: THREE.MeshStandardMaterial, density: number, scale: number, pattern: THREE.Texture | null = null, patternRepeat = density * (8 / 5.6), tuft: THREE.Texture | null = null) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms["surfaceDensity"] = { value: density / scale };
    if (tuft) {
      shader.uniforms["tuftMap"] = { value: tuft };
      shader.uniforms["tuftDensity"] = { value: 4.5 / scale };
    }
    if (pattern) {
      shader.uniforms["patternMap"] = { value: pattern };
      shader.uniforms["patternDensity"] = { value: patternRepeat / scale };
    }
    shader.vertexShader = "varying vec3 surfacePosition; varying vec3 surfaceNormal;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
      surfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      surfaceNormal = normalize(vec3(dot(normal, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))));`);
    shader.fragmentShader = `varying vec3 surfacePosition;
      varying vec3 surfaceNormal;
      uniform float surfaceDensity;
      vec4 surfaceSample(sampler2D tex, vec3 p) {
        vec3 weights = pow(abs(normalize(surfaceNormal)), vec3(6.0));
        weights /= max(weights.x + weights.y + weights.z, 0.0001);
        return texture2D(tex, p.yz * surfaceDensity) * weights.x
          + texture2D(tex, p.xz * surfaceDensity) * weights.y
          + texture2D(tex, p.xy * surfaceDensity) * weights.z;
      }\n` + shader.fragmentShader;
    if (tuft) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        uniform sampler2D tuftMap;
        uniform float tuftDensity;
        float tuftHeight(vec3 p) {
          vec3 w = pow(abs(normalize(surfaceNormal)), vec3(12.0));
          w /= max(dot(w, vec3(1.0)), 0.0001);
          return dot(vec3(texture2D(tuftMap, p.yz * tuftDensity).r, texture2D(tuftMap, p.xz * tuftDensity).r, texture2D(tuftMap, p.xy * tuftDensity).r), w);
        }
        vec4 surfaceRelief(sampler2D tex, vec3 p) { return vec4(tuftHeight(p) + surfaceSample(tex, p).r * 0.008); }
        \n`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.68 + 0.32 * tuftHeight(surfacePosition);');
    }
    if (pattern) {
      shader.fragmentShader = `uniform sampler2D patternMap;
        uniform float patternDensity;
        vec3 patternLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        vec3 patternWeights = pow(abs(normalize(surfaceNormal)), vec3(12.0));
        patternWeights /= max(dot(patternWeights, vec3(1.0)), 0.0001);
        vec3 patternP = (surfacePosition - vec3(0.0, 0.015, 0.0)) * patternDensity;
        diffuseColor.rgb *= patternLinear(texture2D(patternMap, patternP.zy).rgb) * patternWeights.x
          + patternLinear(texture2D(patternMap, patternP.xz).rgb) * patternWeights.y
          + patternLinear(texture2D(patternMap, patternP.xy).rgb) * patternWeights.z;`);
    }
    // Three leaves these chunks unexpanded at onBeforeCompile time.
    // Expand only the sampling chunks before replacing their UV lookups.
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_fragment>", THREE.ShaderChunk.map_fragment)
      .replace("#include <roughnessmap_fragment>", THREE.ShaderChunk.roughnessmap_fragment)
      .replace("#include <bumpmap_pars_fragment>", THREE.ShaderChunk.bumpmap_pars_fragment)
      .replace("texture2D( map, vMapUv )", "surfaceSample(map, surfacePosition)")
      .replace("texture2D( roughnessMap, vRoughnessMapUv )", "surfaceSample(roughnessMap, surfacePosition)")
      .replace("vec2 dSTdx = dFdx( vBumpMapUv );", "vec3 dSTdx = dFdx(surfacePosition);")
      .replace("vec2 dSTdy = dFdy( vBumpMapUv );", "vec3 dSTdy = dFdy(surfacePosition);")
      .replace("texture2D( bumpMap, vBumpMapUv ).x", `${tuft ? "surfaceRelief" : "surfaceSample"}(bumpMap, surfacePosition).x`)
      .replace("texture2D( bumpMap, vBumpMapUv + dSTdx ).x", `${tuft ? "surfaceRelief" : "surfaceSample"}(bumpMap, surfacePosition + dSTdx).x`)
      .replace("texture2D( bumpMap, vBumpMapUv + dSTdy ).x", `${tuft ? "surfaceRelief" : "surfaceSample"}(bumpMap, surfacePosition + dSTdy).x`);
  };
  material.customProgramCacheKey = () => `physical-surface-v4-${density}-${patternRepeat}-${scale}-${pattern?.uuid ?? "plain"}-${tuft?.uuid ?? "smooth"}`;
}

function splitSofaGeometry(source: THREE.BufferGeometry) {
  const geometry = source.clone();
  const position = geometry.getAttribute("position");
  const sourceIndex = geometry.index;
  const triangleCount = sourceIndex ? sourceIndex.count / 3 : position.count / 3;
  const parent = new Int32Array(position.count);
  const componentMinY = new Float32Array(position.count);
  const componentMaxY = new Float32Array(position.count);
  const componentMinX = new Float32Array(position.count);
  const componentMaxX = new Float32Array(position.count);
  const componentMinZ = new Float32Array(position.count);
  const componentMaxZ = new Float32Array(position.count);
  for (let index = 0; index < position.count; index += 1) {
    parent[index] = index;
    componentMinY[index] = componentMaxY[index] = position.getY(index);
    componentMinX[index] = componentMaxX[index] = position.getX(index);
    componentMinZ[index] = componentMaxZ[index] = position.getZ(index);
  }
  const find = (index: number) => {
    let root = index;
    while (parent[root] !== root) root = parent[root] ?? root;
    let cursor = index;
    while (cursor !== root) {
      const next = parent[cursor] ?? root;
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const join = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = sourceIndex ? sourceIndex.getX(triangle * 3) : triangle * 3;
    const b = sourceIndex ? sourceIndex.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const c = sourceIndex ? sourceIndex.getX(triangle * 3 + 2) : triangle * 3 + 2;
    join(a, b);
    join(b, c);
  }
  const weldedVertices = new Map<string, number>();
  for (let index = 0; index < position.count; index += 1) {
    const key = `${position.getX(index).toFixed(5)}:${position.getY(index).toFixed(5)}:${position.getZ(index).toFixed(5)}`;
    const matchingIndex = weldedVertices.get(key);
    if (matchingIndex === undefined) weldedVertices.set(key, index);
    else join(index, matchingIndex);
  }
  for (let index = 0; index < position.count; index += 1) {
    const root = find(index);
    componentMinY[root] = Math.min(componentMinY[root] ?? Infinity, position.getY(index));
    componentMaxY[root] = Math.max(componentMaxY[root] ?? -Infinity, position.getY(index));
    componentMinX[root] = Math.min(componentMinX[root] ?? Infinity, position.getX(index));
    componentMaxX[root] = Math.max(componentMaxX[root] ?? -Infinity, position.getX(index));
    componentMinZ[root] = Math.min(componentMinZ[root] ?? Infinity, position.getZ(index));
    componentMaxZ[root] = Math.max(componentMaxZ[root] ?? -Infinity, position.getZ(index));
  }
  const fabric: number[] = [];
  const legs: number[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const indices = [0, 1, 2].map((corner) =>
      sourceIndex ? sourceIndex.getX(triangle * 3 + corner) : triangle * 3 + corner,
    );
    const centerX = indices.reduce((sum, index) => sum + position.getX(index), 0) / 3;
    const centerY = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
    const centerZ = indices.reduce((sum, index) => sum + position.getZ(index), 0) / 3;
    const isLeg = centerY < -0.335 && Math.abs(centerX) > 0.76 && Math.abs(centerZ) > 0.2;
    (isLeg ? legs : fabric).push(...indices);
  }
  geometry.setIndex([...fabric, ...legs]);
  geometry.clearGroups();
  geometry.addGroup(0, fabric.length, 0);
  geometry.addGroup(fabric.length, legs.length, 1);
  // The source export contains inconsistent normals on the feet; repair before clipping.
  geometry.computeVertexNormals();
  return geometry;
}

// Clip crossing triangles exactly at module boundaries, retaining UVs and normals.
// This avoids the open gaps produced by assigning whole triangles by centroid.
function sliceModule(source: THREE.BufferGeometry, min: number, max: number) {
  const attributes = Object.entries(source.attributes);
  const stride = attributes.reduce((sum, [, attribute]) => sum + attribute.itemSize, 0);
  const index = source.index;
  const output: number[][] = [[], []];
  const clip = (polygon: number[][], boundary: number, keepAbove: boolean) => {
    if (!Number.isFinite(boundary)) return polygon;
    const result: number[][] = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (!a || !b) continue;
      const ax = a[0] ?? 0;
      const bx = b[0] ?? 0;
      const insideA = keepAbove ? ax >= boundary : ax <= boundary;
      const insideB = keepAbove ? bx >= boundary : bx <= boundary;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (boundary - ax) / (bx - ax);
        result.push(a.map((value, k) => THREE.MathUtils.lerp(value, b[k] ?? value, t)));
      }
    }
    return result;
  };
  for (const group of source.groups) {
    const target = output[group.materialIndex ?? 0];
    if (!target) continue;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const vertices = [0, 1, 2].map((corner) => {
        const vertex = index ? index.getX(i + corner) : i + corner;
        return attributes.flatMap(([, attribute]) =>
          Array.from({ length: attribute.itemSize }, (_, k) => attribute.getComponent(vertex, k)));
      });
      const polygon = clip(clip(vertices, min, true), max, false);
      for (let k = 1; k < polygon.length - 1; k += 1) {
        for (const vertex of [polygon[0], polygon[k], polygon[k + 1]]) {
          if (vertex) target.push(...vertex);
        }
      }
    }
  }
  const result = new THREE.BufferGeometry();
  const data = output.flat();
  let offset = 0;
  for (const [name, attribute] of attributes) {
    const values = new Float32Array(data.length / stride * attribute.itemSize);
    for (let vertex = 0; vertex < data.length / stride; vertex += 1) {
      for (let k = 0; k < attribute.itemSize; k += 1) {
        values[vertex * attribute.itemSize + k] = data[vertex * stride + offset + k] ?? 0;
      }
    }
    result.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
    offset += attribute.itemSize;
  }
  result.addGroup(0, (output[0]?.length ?? 0) / stride, 0);
  result.addGroup((output[0]?.length ?? 0) / stride, (output[1]?.length ?? 0) / stride, 1);
  result.computeBoundingSphere();
  return result;
}

// Reflect a cushion half around its crown. Both outer cuts are then the
// exact original centre profile, without nearest-profile snapping or pinching.
function reflectedGeometry(source: THREE.BufferGeometry) {
  const result = source.clone();
  const p = result.getAttribute("position");
  const n = result.getAttribute("normal");
  for (let i = 0; i < p.count; i += 1) {
    p.setX(i, -p.getX(i));
    n.setX(i, -n.getX(i));
  }
  for (const attribute of Object.values(result.attributes)) {
    for (let i = 0; i < attribute.count; i += 3) {
      for (let k = 0; k < attribute.itemSize; k += 1) {
        const value = attribute.getComponent(i + 1, k);
        attribute.setComponent(i + 1, k, attribute.getComponent(i + 2, k));
        attribute.setComponent(i + 2, k, value);
      }
    }
  }
  result.computeBoundingSphere();
  return result;
}

function softenMirrorPlane(geometry: THREE.BufferGeometry, plane: number) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    const blend = THREE.MathUtils.smoothstep(Math.abs(positions.getX(i) - plane), 0, 0.025);
    normal.set(normals.getX(i) * blend, normals.getY(i), normals.getZ(i)).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
}

function joinedModule(source: THREE.BufferGeometry) {
  const half = sliceModule(source, -MODULE_WIDTH / 2, 0);
  half.translate(MODULE_WIDTH / 2, 0, 0);
  softenMirrorPlane(half, 0);
  return [reflectedGeometry(half), half];
}

function SofaModel({ fabric, leg, textureScale, scale, seats, reducedMotion, wireframe }: { fabric: FabricId; leg: LegId; textureScale: number; scale: number; seats: SeatCount; reducedMotion: boolean; wireframe: boolean }) {
  const assembly = useRef<THREE.Group>(null);
  const chair = useRef<THREE.Group>(null);
  const animatedSeats = useRef<number>(2);
  const { scene } = useGLTF(sofaAsset.url);
  const sourceMesh = useMemo(() => {
    let found: THREE.Mesh | undefined;
    scene.traverse((object: THREE.Object3D) => {
      if (!found && object instanceof THREE.Mesh) found = object;
    });
    return found;
  }, [scene]);
  const geometry = useMemo(() => (sourceMesh ? splitSofaGeometry(sourceMesh.geometry) : null), [sourceMesh]);
  const sourceBounds = useMemo(() => {
    if (!geometry) return null;
    geometry.computeBoundingBox();
    return geometry.boundingBox?.clone() ?? null;
  }, [geometry]);
  const modules = useMemo(() => geometry ? [
    sliceModule(geometry, -Infinity, -MODULE_WIDTH),
    sliceModule(geometry, MODULE_WIDTH, Infinity),
    sliceModule(geometry, -MODULE_WIDTH, 0),
    sliceModule(geometry, 0, MODULE_WIDTH),
    ...joinedModule(geometry),
  ] : [], [geometry]);
  const chairHalf = useMemo(() => {
    if (!geometry) return null;
    // Mirror a half-cushion rather than joining mismatched cushion/arm cuts.
    const half = sliceModule(geometry, -Infinity, -MODULE_WIDTH / 2);
    const positions = half.getAttribute("position");
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      positions.setX(i, (x > -MODULE_WIDTH ? -MODULE_WIDTH + (x + MODULE_WIDTH) * 2 : x) + MODULE_WIDTH / 2);
    }
    positions.needsUpdate = true;
    const normals = half.getAttribute("normal");
    const normal = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      const stretched = positions.getX(i) > -MODULE_WIDTH / 2;
      normal.set(normals.getX(i) / (stretched ? 2 : 1), normals.getY(i), normals.getZ(i)).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    softenMirrorPlane(half, 0);
    half.computeBoundingSphere();
    return half;
  }, [geometry]);
  const chairOtherHalf = useMemo(() => chairHalf ? reflectedGeometry(chairHalf) : null, [chairHalf]);
  const chairBounds = useMemo(() => {
    if (!chairHalf) return null;
    chairHalf.computeBoundingBox();
    return chairHalf.boundingBox?.clone() ?? null;
  }, [chairHalf]);
  useEffect(() => () => { chairHalf?.dispose(); chairOtherHalf?.dispose(); }, [chairHalf, chairOtherHalf]);
  useEffect(() => () => { geometry?.dispose(); modules.forEach((module) => module.dispose()); }, [geometry, modules]);
  useFrame((_, rawDelta) => {
    if (!assembly.current || !sourceBounds || !chairBounds) return;
    const n = reducedMotion ? seats : THREE.MathUtils.damp(animatedSeats.current, seats, 14, Math.min(rawDelta, 0.05));
    animatedSeats.current = Math.abs(n - seats) < 0.001 ? seats : n;
    const current = Math.max(2, animatedSeats.current);
    const chairBlend = THREE.MathUtils.clamp(2 - animatedSeats.current, 0, 1);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
    // Calibrate the complete joined assembly, not individual modules: shared
    // transforms keep every cut closed while matching the physical size chart.
    const sx = seatingWidth(current) / (sourceSize.x + (current - 2) * MODULE_WIDTH) * scale;
    const sy = BASE_SIZE.height / sourceSize.y * scale;
    const sz = BASE_SIZE.depth / sourceSize.z * scale;
    assembly.current.scale.set(sx, sy, sz);
    assembly.current.position.set(-sourceCenter.x * sx, 0.015 - sourceBounds.min.y * sy, -sourceCenter.z * sz);
    assembly.current.visible = chairBlend < 0.999;
    if (chair.current) {
      chair.current.visible = chairBlend > 0.001;
      const reveal = 0.95 + chairBlend * 0.05;
      const chairSize = chairBounds.getSize(new THREE.Vector3());
      const chairCenter = chairBounds.getCenter(new THREE.Vector3());
      const chairWidth = Math.max(Math.abs(chairBounds.min.x), Math.abs(chairBounds.max.x)) * 2;
      const chairSy = BASE_SIZE.height / chairSize.y * scale * reveal;
      const chairSz = BASE_SIZE.depth / chairSize.z * scale * reveal;
      chair.current.scale.set(seatingWidth(1) / chairWidth * scale * reveal, chairSy, chairSz);
      chair.current.position.set(0, 0.015 - chairBounds.min.y * chairSy, -chairCenter.z * chairSz);
    }
    for (const material of materials) {
      material.opacity = 1 - chairBlend;
      material.transparent = chairBlend > 0;
      material.depthWrite = chairBlend < 0.01;
    }
    for (const material of chairMaterials) {
      material.opacity = chairBlend;
      material.transparent = chairBlend < 1;
      material.depthWrite = chairBlend > 0.99;
    }
    const [left, right, first, second, third] = assembly.current.children;
    if (left) left.position.x = -(current - 2) * MODULE_WIDTH / 2;
    if (right) right.position.x = (current - 2) * MODULE_WIDTH / 2;
    if (first) first.position.x = -(current - 2) * MODULE_WIDTH / 2;
    if (second) {
      second.scale.x = THREE.MathUtils.clamp(current - 1, 0, 1);
      second.position.x = (current - 1) * MODULE_WIDTH / 2;
      second.visible = second.scale.x > 0.001;
    }
    if (third) {
      third.scale.x = THREE.MathUtils.clamp(current - 2, 0, 1);
      third.visible = third.scale.x > 0.001;
    }
    assembly.current.userData["seats"] = current;
    assembly.current.userData["width"] = seatingWidth(current) * scale;
  });
  const selectedFabric = FABRICS.find((item) => item.id === fabric) ?? DEFAULT_FABRIC;
  const selectedLeg = LEGS.find((item) => item.id === leg) ?? DEFAULT_LEG;
  const patternTexture = useMemo(() => {
    if (!selectedFabric.pattern) return null;
    const texture = new THREE.CanvasTexture(createPatternCanvas(selectedFabric));
    // Custom sampler performs explicit sRGB decoding, unlike the built-in map.
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }, [selectedFabric]);
  useEffect(() => () => patternTexture?.dispose(), [patternTexture]);
  const fabricTexture = useMemo(
    () => createSurfaceMaps(selectedFabric.weave),
    [selectedFabric.weave],
  );
  const legTexture = useMemo(() => createSurfaceMaps(leg === "steel" ? "steel" : "wood"), [leg]);
  const tuftTexture = useMemo(() => selectedFabric.tufted ? createSurfaceMaps("tuft") : null, [selectedFabric.tufted]);
  useEffect(() => () => { if (tuftTexture) Object.values(tuftTexture).forEach((map) => map.dispose()); }, [tuftTexture]);
  useEffect(() => () => Object.values(fabricTexture).forEach((map) => map.dispose()), [fabricTexture]);
  useEffect(() => () => Object.values(legTexture).forEach((map) => map.dispose()), [legTexture]);
  const materials = useMemo(() => {
    const leather = selectedFabric.weave === "leather";
    const colorCanvas = document.createElement("canvas");
    const colorContext = colorCanvas.getContext("2d");
    let fabricColor = new THREE.Color(selectedFabric.color || DEFAULT_FABRIC.color);
    if (!selectedFabric.pattern && colorContext) {
      colorContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(`--fabric-${selectedFabric.id}`).trim();
      colorContext.fillRect(0, 0, 1, 1);
      const rgb = colorContext.getImageData(0, 0, 1, 1).data;
      fabricColor = new THREE.Color().setRGB((rgb[0] ?? 0) / 255, (rgb[1] ?? 0) / 255, (rgb[2] ?? 0) / 255, THREE.SRGBColorSpace);
    }
    const upholstery = new THREE.MeshPhysicalMaterial({
      color: fabricColor,
      ...fabricTexture,
      bumpScale: selectedFabric.tufted ? 0.018 : leather ? 0.00045 : selectedFabric.weave === "loop" ? 0.00018 : selectedFabric.weave === "velvet" ? 0.00004 : 0.00009,
      roughness: leather ? 0.48 : selectedFabric.weave === "velvet" ? 0.78 : 0.91,
      metalness: 0,
      sheen: leather ? 0 : selectedFabric.weave === "velvet" ? 0.7 : selectedFabric.weave === "loop" ? 0.3 : 0.18,
      sheenColor: fabricColor.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
      clearcoat: leather ? 0.16 : 0,
      clearcoatRoughness: leather ? 0.52 : 0,
      sheenRoughness: 0.85,
    });
    const feet = new THREE.MeshStandardMaterial({
      color: selectedLeg.color,
      ...legTexture,
      bumpScale: leg === "steel" ? 0.000008 : 0.000025,
      roughness: selectedLeg.roughness,
      metalness: selectedLeg.metalness,
    });
    projectSurface(upholstery, leather ? leatherDensity(textureScale) : weaveDensity(textureScale), scale, patternTexture, 56 / textureScale, tuftTexture?.bumpMap ?? null);
    projectSurface(feet, leg === "steel" ? 3 : 1.6, scale);
    return [upholstery, feet];
  }, [fabricTexture, legTexture, selectedFabric, selectedLeg, textureScale, scale, leg, patternTexture, tuftTexture]);
  const chairMaterials = useMemo(() => materials.map((material, i) => {
    const clone = material.clone();
    projectSurface(clone, i === 0 ? selectedFabric.weave === "leather" ? leatherDensity(textureScale) : weaveDensity(textureScale) : leg === "steel" ? 3 : 1.6, scale, i === 0 ? patternTexture : null, 56 / textureScale, i === 0 ? tuftTexture?.bumpMap ?? null : null);
    return clone;
  }), [materials, textureScale, leg, scale, patternTexture, selectedFabric.weave, tuftTexture]);
  useEffect(() => () => chairMaterials.forEach((material) => material.dispose()), [chairMaterials]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  useEffect(() => {
    for (const material of [...materials, ...chairMaterials]) material.wireframe = wireframe;
  }, [materials, chairMaterials, wireframe]);
  const [leftCap, rightCap, leftSeat, rightSeat, insertLeft, insertRight] = modules;
  if (!geometry || !chairHalf || !chairOtherHalf || !leftCap || !rightCap || !leftSeat || !rightSeat || !insertLeft || !insertRight) return null;
  return (
    <>
    <group ref={assembly} name="sofa-assembly" dispose={null}>
      <mesh geometry={leftCap} material={materials} castShadow receiveShadow />
      <mesh geometry={rightCap} material={materials} castShadow receiveShadow />
      <mesh geometry={leftSeat} material={materials} castShadow receiveShadow />
      <group><mesh geometry={rightSeat} material={materials} position-x={-MODULE_WIDTH / 2} castShadow receiveShadow /></group>
      <group><mesh geometry={insertLeft} material={materials} castShadow receiveShadow /><mesh geometry={insertRight} material={materials} castShadow receiveShadow /></group>
    </group>
    <group ref={chair} name="chair-assembly" dispose={null}>
      <mesh geometry={chairHalf} material={chairMaterials} castShadow receiveShadow />
      <mesh geometry={chairOtherHalf} material={chairMaterials} castShadow receiveShadow />
    </group>
    </>
  );
}

function DimensionLabel({ axis, value, position }: { axis: string; value: string; position: [number, number, number] }) {
  const { gl, camera, size } = useThree();
  const anchor = useRef<THREE.Group>(null);
  const label = useRef<HTMLSpanElement>(null);
  const projected = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { label.current = document.querySelector<HTMLSpanElement>(`[data-dimension="${axis}"]`); }, [axis, gl]);
  useFrame(() => {
    if (!anchor.current || !label.current) return;
    label.current.textContent = value;
    anchor.current.updateWorldMatrix(true, false);
    anchor.current.getWorldPosition(projected).project(camera);
    label.current.style.transform = `translate(${(projected.x + 1) * size.width / 2}px, ${(1 - projected.y) * size.height / 2}px) translate(-50%, -50%)`;
    label.current.hidden = projected.z > 1 || projected.z < -1;
  });
  return <group ref={anchor} position={position} />;
}

function Dimensions({ scale, unit, seats, reducedMotion }: { scale: number; unit: Unit; seats: SeatCount; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const heightRuler = useRef<THREE.Group>(null);
  const depthRuler = useRef<THREE.Group>(null);
  const current = useRef<number>(2);
  useFrame((_, delta) => {
    current.current = reducedMotion ? seats : THREE.MathUtils.damp(current.current, seats, 14, Math.min(delta, 0.25));
    if (group.current) group.current.scale.x = seatingWidth(current.current) / BASE_SIZE.width;
    const halfWidth = seatingWidth(current.current) * scale / 2;
    if (heightRuler.current) heightRuler.current.position.x = halfWidth + 0.25;
    if (depthRuler.current) depthRuler.current.position.x = -halfWidth - 0.22;
  });
  const width = BASE_SIZE.width * scale;
  const height = BASE_SIZE.height * scale;
  const depth = BASE_SIZE.depth * scale;
  const y = 0.08;
  return (
    <>
    <group ref={group}>
      <Line points={[[-width / 2, y, depth / 2 + 0.25], [width / 2, y, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
      <Line points={[[-width / 2, y - 0.06, depth / 2 + 0.25], [-width / 2, y + 0.06, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
      <Line points={[[width / 2, y - 0.06, depth / 2 + 0.25], [width / 2, y + 0.06, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
    </group>
    <group position={[0, y - 0.04, depth / 2 + 0.32]}>
      <DimensionLabel axis="width" position={[0, 0, 0]} value={formatDimension(seatingWidth(seats) * scale, unit)} />
    </group>
    <group ref={heightRuler} position={[seatingWidth(seats) * scale / 2 + 0.25, 0, 0]}>
      <Line points={[[0, 0.015, 0], [0, height + 0.015, 0]]} color="#263126" lineWidth={1} />
      <DimensionLabel axis="height" position={[0, height / 2 + 0.015, 0]} value={formatDimension(height, unit)} />
    </group>
    <group ref={depthRuler} position={[-seatingWidth(seats) * scale / 2 - 0.22, 0, 0]}>
      <Line points={[[0, y, -depth / 2], [0, y, depth / 2]]} color="#263126" lineWidth={1} />
      <DimensionLabel axis="depth" position={[0, y, 0]} value={formatDimension(depth, unit)} />
    </group>
    </>
  );
}

function CameraRig({ controlsRef, view, zoomSignal, seats, scale, reducedMotion }: { controlsRef: RefObject<OrbitControlsImpl | null>; view: ViewName; zoomSignal: number; seats: SeatCount; scale: number; reducedMotion: boolean }) {
  const { camera, invalidate, size } = useThree();
  const destination = useRef<THREE.Vector3 | null>(null);
  useFrame((_, delta) => {
    if (!destination.current) return;
    camera.position.lerp(destination.current, reducedMotion ? 1 : 1 - Math.exp(-14 * Math.min(delta, 0.25)));
    controlsRef.current?.update();
    if (camera.position.distanceTo(destination.current) < 0.002) destination.current = null;
  });
  useEffect(() => {
    const target = new THREE.Vector3(...VIEWS[view]);
    if (camera instanceof THREE.PerspectiveCamera) {
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const horizontal = vertical * size.width / size.height;
      const radius = Math.hypot(seatingWidth(seats), BASE_SIZE.depth) * scale / 2;
      const distance = Math.max(3.2, radius / Math.min(vertical, horizontal) * 1.22);
      target.sub(new THREE.Vector3(0, 0.42, 0)).normalize().multiplyScalar(distance).add(new THREE.Vector3(0, 0.42, 0));
    }
    destination.current = target;
    camera.lookAt(0, 0.42, 0);
    controlsRef.current?.target.set(0, 0.42, 0);
    controlsRef.current?.update();
    invalidate();
  }, [camera, controlsRef, invalidate, view, seats, scale, size.width, size.height]);
  useEffect(() => {
    if (zoomSignal === 0) return;
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 0.42, 0);
    const direction = camera.position.clone().sub(target);
    const nextDistance = THREE.MathUtils.clamp(direction.length() * (zoomSignal > 0 ? 0.82 : 1.22), 1.7, 7);
    destination.current = target.clone().add(direction.normalize().multiplyScalar(nextDistance));
    controlsRef.current?.update();
    invalidate();
  }, [camera, controlsRef, invalidate, zoomSignal]);
  return null;
}

function Viewer({ fabric, leg, textureScale, scale, grid, measures, unit, rotate, studio, view, zoomSignal, seats, reducedMotion, wireframe }: {
  fabric: FabricId; leg: LegId; textureScale: number; scale: number; grid: boolean; measures: boolean; unit: Unit; rotate: boolean; studio: boolean; view: ViewName; zoomSignal: number; seats: SeatCount; reducedMotion: boolean; wireframe: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: VIEWS.perspective, fov: 40, near: 0.1, far: 100 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.domElement.dataset["viewerCanvas"] = "true"; }}
    >
      <color attach="background" args={[studio ? "#ebe9e4" : "#d9ded8"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 6, 4]} intensity={2.25} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <Environment resolution={128}>
        <Lightformer intensity={3} position={[0, 5, 2]} scale={[7, 3, 1]} />
        <Lightformer intensity={1.3} position={[-4, 2, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
        <Lightformer intensity={1.1} position={[4, 1, -2]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={studio ? "#e3e0da" : "#ccd3cc"} roughness={0.96} />
      </mesh>
      {grid && <gridHelper args={[12, 24, "#8f948d", "#c4c4bd"]} position-y={0.006} />}
      <Suspense fallback={null}>
        <SofaModel fabric={fabric} leg={leg} textureScale={textureScale} scale={scale} seats={seats} reducedMotion={reducedMotion} wireframe={wireframe} />
      </Suspense>
      {measures && <Dimensions scale={scale} unit={unit} seats={seats} reducedMotion={reducedMotion} />}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableZoom
        zoomSpeed={0.9}
        zoomToCursor
        minDistance={1.7}
        maxDistance={7}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.02}
        autoRotate={rotate}
        autoRotateSpeed={0.7}
        target={[0, 0.42, 0]}
      />
      <CameraRig controlsRef={controlsRef} view={view} zoomSignal={zoomSignal} seats={seats} scale={scale} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant={active ? "selected" : "outline"} size="icon" onClick={onClick} aria-label={label} title={label}>
      {children}
    </Button>
  );
}

export function SofaConfigurator() {
  const [seats, setSeats] = useState<SeatCount>(2);
  const reducedMotion = useReducedMotion();
  const [fabric, setFabric] = useState<FabricId>("oat");
  const [leg, setLeg] = useState<LegId>("oak");
  const [textureScale, setTextureScale] = useState(7);
  const [scale, setScale] = useState(1);
  const [grid, setGrid] = useState(true);
  const [measures, setMeasures] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [studio, setStudio] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [unit, setUnit] = useState<Unit>("cm");
  const [view, setView] = useState<ViewName>("perspective");
  const [zoomSignal, setZoomSignal] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const reset = useCallback(() => {
    setSeats(2); setFabric("oat"); setLeg("oak"); setTextureScale(7); setScale(1); setGrid(true); setMeasures(true); setRotate(false); setStudio(true); setWireframe(false); setUnit("cm"); setView("perspective");
  }, []);
  const screenshot = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-viewer-canvas='true']");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `panache-${seats}-seater-${fabric}-${leg}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const fullscreen = () => {
    const root = document.querySelector<HTMLElement>("[data-configurator-root]");
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen();
  };
  const selectedFabric = FABRICS.find((item) => item.id === fabric) ?? DEFAULT_FABRIC;
  const selectedLeg = LEGS.find((item) => item.id === leg) ?? DEFAULT_LEG;

  return (
    <main data-configurator-root className="relative h-dvh min-h-[620px] overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 sm:right-[var(--panel-width)]"><Viewer fabric={fabric} leg={leg} textureScale={textureScale} scale={scale} grid={grid} measures={measures} unit={unit} rotate={rotate} studio={studio} view={view} zoomSignal={zoomSignal} seats={seats} reducedMotion={reducedMotion} wireframe={wireframe} />{measures && (["width", "height", "depth"] as const).map((axis) => <span key={axis} data-dimension={axis} className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-sm bg-dimension px-1.5 py-0.5 font-mono text-[11px] text-dimension-foreground" />)}</div>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-surface/95 px-4 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Box className="size-4" /></div>
          <div><div className="font-display text-base font-semibold leading-none">Panache</div><div className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">Product configurator</div></div>
        </div>
        <div className="hidden text-center md:block"><div className="text-xs font-semibold">Panache OPAA · {seats} seater</div><div className="mt-1 text-[10px] text-muted-foreground">{selectedFabric.name} · {selectedLeg.name}</div></div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={reset} aria-label="Reset configuration" title="Reset configuration"><Undo2 className="size-4" /></Button>
          <Button variant="outline" size="icon-sm" onClick={screenshot} aria-label="Download image" title="Download image"><Download className="size-4" /></Button>
          <Button variant="outline" size="icon-sm" onClick={fullscreen} aria-label="Fullscreen" title="Fullscreen"><Expand className="size-4" /></Button>
        </div>
      </header>

      <nav aria-label="Viewer controls" className="absolute left-3 top-20 z-20 flex flex-col gap-2 sm:left-5">
        <ToolButton label="Zoom in" onClick={() => setZoomSignal((value) => value >= 0 ? value + 1 : 1)}><Plus className="size-4" /></ToolButton>
        <ToolButton label="Zoom out" onClick={() => setZoomSignal((value) => value <= 0 ? value - 1 : -1)}><Minus className="size-4" /></ToolButton>
        <ToolButton label="Fit to view" onClick={() => { setView("perspective"); setZoomSignal(0); }}><Scan className="size-4" /></ToolButton>
        <div className="my-1 h-px bg-border" />
        <ToolButton label="Toggle grid" active={grid} onClick={() => setGrid((value) => !value)}><Grid3X3 className="size-4" /></ToolButton>
        <ToolButton label="Toggle measurements" active={measures} onClick={() => setMeasures((value) => !value)}><Ruler className="size-4" /></ToolButton>
        <ToolButton label="Toggle auto rotate" active={rotate} onClick={() => setRotate((value) => !value)}><Rotate3D className="size-4" /></ToolButton>
        <ToolButton label="Change studio" active={!studio} onClick={() => setStudio((value) => !value)}><SunMedium className="size-4" /></ToolButton>
        <ToolButton label="Toggle wireframe" active={wireframe} onClick={() => setWireframe((value) => !value)}><Frame className="size-4" /></ToolButton>
      </nav>

      <section className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 sm:left-[calc((100%_-_var(--panel-width))/_2)] rounded-md border border-border bg-surface/95 p-1 shadow-panel sm:bottom-5">
        <div className="flex items-center gap-1" role="group" aria-label="View presets">
          {(["perspective", "front", "side", "rear"] as ViewName[]).map((item) => (
            <Button key={item} variant={view === item ? "selected" : "ghost"} size="sm" onClick={() => setView(item)} className="capitalize">{item}</Button>
          ))}
        </div>
      </section>

      <aside className={cn("absolute bottom-0 right-0 top-16 z-30 w-full border-l border-border bg-surface shadow-panel transition-transform sm:w-[var(--panel-width)]", panelOpen ? "translate-y-0" : "translate-y-[calc(100%_-_3.25rem)]", "sm:translate-y-0")}>
        <Button variant="ghost" type="button" aria-expanded={panelOpen} className="flex h-13 w-full items-center justify-between border-b border-border px-4 text-left sm:hidden" onClick={() => setPanelOpen((value) => !value)}>
          <span className="text-sm font-semibold">Configure sofa · {seats} seater</span><ChevronDown className={cn("size-4 transition-transform", panelOpen && "rotate-180")} />
        </Button>
        <div className="h-[calc(100%_-_3.25rem)] overflow-y-auto px-4 pb-24 pt-4 sm:h-full sm:pb-6">
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase text-muted-foreground">01 / Configuration</div><h1 className="mt-0.5 font-display text-lg font-semibold leading-none">Make it yours</h1></div><Move3D className="size-4 text-muted-foreground" /></div>
          <section className="mt-4" aria-labelledby="seating-heading">
            <div className="flex items-center justify-between"><h2 id="seating-heading" className="text-[13px] font-semibold">Seating</h2><span className="text-[11px] text-muted-foreground">{seats} seater</span></div>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Seating options">
              {([1, 2, 3] as SeatCount[]).map((count) => (
                <Button key={count} variant={seats === count ? "selected" : "outline"} aria-pressed={seats === count} aria-label={`${count} seater`} onClick={() => setSeats(count)} className="h-14 flex-col gap-1 px-1 text-[11px]">
                  <span aria-hidden="true" className="flex h-4 items-center gap-[3px] border-x-2 border-current px-1">
                    {Array.from({ length: count }, (_, i) => <span key={i} className="h-3 w-2 rounded-[2px] border border-current" />)}
                  </span>
                  <span>{count} seater</span>
                </Button>
              ))}
            </div>
          </section>
          <div className="my-4 h-px bg-border" />
          <section>
            <div className="flex items-end justify-between"><div><h2 className="text-[13px] font-semibold">Upholstery</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{selectedFabric.family}</p></div><span className="text-[11px] font-medium">{selectedFabric.name}</span></div>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {FABRICS.map((item) => (
                <Button variant="ghost" key={item.id} type="button" onClick={() => setFabric(item.id)} aria-label={`Select ${item.name}`} aria-pressed={fabric === item.id} className={cn("relative h-[72px] min-w-0 flex-col justify-start gap-1 rounded-md border bg-muted p-1 text-center", fabric === item.id ? "border-primary ring-1 ring-primary" : "border-border")}>
                   <FabricSwatch fabric={item} />
                   <span className="w-full whitespace-normal text-[9px] leading-[11px]">{item.name}</span>
                  {fabric === item.id && <span className="absolute right-1 top-1 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2" /></span>}
                </Button>
              ))}
            </div>
            <label className="mt-3 block"><span className="flex items-center justify-between text-[11px]"><span className="font-medium">Weave scale</span><span className="font-mono text-muted-foreground">{textureScale}×</span></span><input aria-label="Weave scale" className="mt-2 w-full accent-primary" type="range" min="3" max="14" step="1" value={textureScale} onChange={(event) => setTextureScale(Number(event.target.value))} /></label>
          </section>
          <div className="my-4 h-px bg-border" />
          <section>
            <div className="flex items-end justify-between"><div><h2 className="text-[13px] font-semibold">Leg finish</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Frame details</p></div><span className="text-[11px] font-medium">{selectedLeg.name}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {LEGS.map((item) => (
                <Button variant="ghost" key={item.id} type="button" onClick={() => setLeg(item.id)} aria-pressed={leg === item.id} className={cn("flex h-9 items-center gap-2 rounded-md border px-2 text-left text-[11px] font-medium", leg === item.id ? "border-primary bg-accent" : "border-border bg-surface")}>
                  <span data-leg={item.id} className="leg-swatch size-4 shrink-0 rounded-[3px] border border-border" />{item.name}{leg === item.id && <Check className="ml-auto size-3" />}
                </Button>
              ))}
            </div>
          </section>
          <div className="my-4 h-px bg-border" />
          <section>
            <div className="flex items-center justify-between"><div><h2 className="text-[13px] font-semibold">Scale & dimensions</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Configuration size</p></div><CircleGauge className="size-4 text-muted-foreground" /></div>
            <div className="mt-2 flex rounded-md border border-border p-0.5">{(["cm", "mm", "in"] as Unit[]).map((item) => <Button key={item} variant={unit === item ? "selected" : "ghost"} size="sm" className="h-7 flex-1 px-1 text-[11px] uppercase" onClick={() => setUnit(item)}>{item}</Button>)}</div>
            <label className="mt-3 block"><span className="flex items-center justify-between text-[11px]"><span className="font-medium">Model scale</span><span className="font-mono text-muted-foreground">{Math.round(scale * 100)}%</span></span><input className="mt-2 w-full accent-primary" type="range" min="0.8" max="1.2" step="0.01" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><Metric label="Width" value={seatingWidth(seats) * scale} unit={unit} /><Metric label="Height" value={BASE_SIZE.height * scale} unit={unit} /><Metric label="Depth" value={BASE_SIZE.depth * scale} unit={unit} /></div>
          </section>
        </div>
      </aside>
      <div className="pointer-events-none absolute bottom-20 left-3 hidden items-center gap-2 rounded-md bg-surface/85 px-3 py-2 text-[10px] font-medium text-muted-foreground shadow-sm lg:flex"><Maximize2 className="size-3" /> Drag to orbit · scroll or pinch to zoom · right-drag to pan</div>
    </main>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: Unit }) {
  return <div className="rounded-md bg-muted px-1.5 py-2"><div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-0.5 font-mono text-[11px] font-semibold">{formatDimension(value, unit)}</div></div>;
}

useGLTF.preload(sofaAsset.url);