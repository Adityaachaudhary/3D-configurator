import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Line,
  OrbitControls,
  useGLTF,
  useTexture,
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
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import sofaAsset from "@/assets/Panache-OPAA-80pct.glb.asset.json";
import wisdomAsset from "@/assets/wisdom-fabric.png.asset.json";
import redFishAsset from "@/assets/red-fish-fabric.png.asset.json";
import swatchUrbanAsset from "@/assets/swatch-urban-fabric.png.asset.json";
import orangeAsset from "@/assets/orange-pattern-fabric.png.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { materialRecipe } from "@/lib/material-recipes";
import { applyLook, resolveLook, tileFor, LIGHTING, RELIEF } from "@/lib/material-looks";
import { leatherHeightField } from "@/lib/leather-grain";
import { seatingWidth, BASE_SIZE, FLOOR_LIFT } from "@/lib/sofa-spec";
import { LightRig } from "@/lib/static-light-rig";
import { DEFAULT_TILE_CM, MIN_TILE_CM, MAX_TILE_CM, tileDensity } from "@/lib/texture-repeat";

type FabricId = "oat" | "wisdom" | "clay" | "ink" | "moss" | "swatch-urban" | "red-fish" | "ochre-chevron" | "orange-pattern" | "cognac-leather" | "charcoal-leather" | "olive-leather" | "chesterfield-oxblood" | "chesterfield-saddle";
type PatternKind = "check" | "chevron" | "diamond";
type FabricPreset = { id: FabricId; name: string; family: string; color: string; weave: string; pattern?: PatternKind; printed?: boolean; tufted?: boolean; photo?: string; directional?: boolean };
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
const FABRICS: FabricPreset[] = [
  { id: "oat", name: "Oat Bouclé", family: "Bouclé 04", color: "#b8aa91", weave: "loop" },
  { id: "wisdom", name: "Wisdom", family: "Client fabric", color: "", weave: "linen", photo: wisdomAsset.url },
  { id: "clay", name: "Clay Twill", family: "Twill 07", color: "#a66f5b", weave: "twill" },
  { id: "moss", name: "Forest Chenille", family: "Chenille 09", color: "#46564b", weave: "loop" },
  { id: "ink", name: "Ink Velvet", family: "Velvet 02", color: "#34383b", weave: "velvet" },
  { id: "swatch-urban", name: "Swatch Urban", family: "Client fabric · Textured tweed", color: "", weave: "tweed", printed: true, photo: swatchUrbanAsset.url },
  { id: "red-fish", name: "Red Fish", family: "Client fabric · Printed", color: "", weave: "linen", printed: true, photo: redFishAsset.url },
  { id: "ochre-chevron", name: "Ochre Chevron", family: "Chevron · Twill", color: "#ffffff", weave: "twill", pattern: "chevron" },
  { id: "orange-pattern", name: "Orange Pattern", family: "Client fabric · Woven stripe", color: "", weave: "twill", printed: true, photo: orangeAsset.url, directional: true },
  { id: "cognac-leather", name: "Cognac Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
  { id: "charcoal-leather", name: "Charcoal Leather", family: "Leather · Fine grain", color: "", weave: "leather" },
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
  const size = kind === "tuft" ? 2048 : kind === "leather" ? 512 : 256;
  const grain = kind === "leather" ? leatherHeightField(size) : null;
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
      else if (kind === "loop") height = 0.5 + 0.23 * Math.sin(u * 9 + Math.sin(v * 11)) * Math.cos(v * 11 + Math.sin(u * 9)) + noise * 0.1;
      else if (kind === "velvet") height = 0.5 + noise * 0.12;
      else if (kind === "leather") height = 0.15 + 0.7 * (grain?.[y * size + x] ?? 0.5);
      else if (kind === "tuft") {
        const a = (x / size + y / size) % 1;
        const b = ((x / size - y / size) % 1 + 1) % 1;
        const crown = Math.pow(Math.max(0, Math.sin(a * Math.PI) * Math.sin(b * Math.PI)), 1.6);
        const edgeA = Math.min(a, 1 - a), edgeB = Math.min(b, 1 - b);
        const radius = edgeA * edgeA + edgeB * edgeB;
        const pocket = Math.exp(-radius / 0.0042);
        const buttonHead = Math.exp(-radius / 0.0003);
        height = Math.max(0, 0.40 + crown * 0.60 - pocket * 0.30 + buttonHead * 0.12);
      }
      else {
        const warp = Math.cos(u * 32);
        const weft = Math.cos(v * 32);
        const over = kind === "twill" ? Math.sin((u + v) * 8) : Math.sin(u * 16) * Math.sin(v * 16);
        height = 0.5 + 0.22 * (over > 0 ? warp : weft) + noise * 0.06;
      }
      const i = (y * size + x) * 4;
      const contrast = kind === "wood" ? 0.3 : kind === "steel" ? 0.1 : kind === "leather" ? 0.2 : kind === "velvet" ? 0.045 : kind === "loop" ? 0.5 : 0.32;
      // Clamp: Uint8Array wraps out-of-range values, which turned wood grain crests black.
      const value = Math.round(255 * THREE.MathUtils.clamp(kind === "tuft" ? 0.72 + height * 0.28 : 0.94 + (height - 0.5) * contrast, 0, 1));
      height = THREE.MathUtils.clamp(height, 0, 1);
      for (let k = 0; k < 3; k += 1) {
        colour[i + k] = value;
        relief[i + k] = Math.round(height * 255);
        rough[i + k] = Math.round(255 * (kind === "leather" ? 0.78 + (1 - height) * 0.22 : 0.88 + height * 0.12));
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
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { map: make(colour, true), bumpMap: make(relief), roughnessMap: make(rough) };
}

// Mirror a square crop without stretching its threads. Opposing edges match,
// avoiding hard photo borders across cushions and derived seating modules.
function createPhotoSurfaceMaps(source: HTMLImageElement, cropPixels?: number, reliefStrength = 0.45) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return createSurfaceMaps("linen");
  const crop = Math.min(source.naturalWidth, source.naturalHeight, cropPixels ?? Infinity);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    ctx.save();
    ctx.translate(x ? size : 0, y ? size : 0);
    ctx.scale(x ? -1 : 1, y ? -1 : 1);
    ctx.drawImage(source, (source.naturalWidth - crop) / 2, (source.naturalHeight - crop) / 2, crop, crop, 0, 0, size / 2, size / 2);
    ctx.restore();
  }
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const relief = new Uint8Array(pixels.length);
  const roughness = new Uint8Array(pixels.length);
  // Strong-relief (tweed) photos get a synthetic woven crosshatch on top of the
  // photo-derived slub relief: the flat photo luminance alone reads as smooth.
  const tweed = reliefStrength > 0.6;
  for (let i = 0; i < pixels.length; i += 4) {
    const pixel = i / 4;
    const px = pixel % size, py = Math.floor(pixel / size);
    const luminance = (pixels[i] ?? 0) * 0.2126 + (pixels[i + 1] ?? 0) * 0.7152 + (pixels[i + 2] ?? 0) * 0.0722;
    let height = 128 + (luminance - 128) * reliefStrength;
    if (tweed) {
      const u = px / size * Math.PI * 2, v = py / size * Math.PI * 2;
      // Rounded warp/weft yarns, ~48 per tile, with a broken-twill interlace
      // and slub speckle so the weave reads at normal viewing distance.
      const warp = Math.pow(0.5 + 0.5 * Math.cos(u * 48), 1.5);
      const weft = Math.pow(0.5 + 0.5 * Math.cos(v * 48), 1.5);
      const over = Math.sin(u * 6 + Math.sin(v * 3)) * Math.sin(v * 6 + Math.cos(u * 5)) > 0;
      const slub = Math.sin(u * 173 + Math.sin(v * 91)) * Math.sin(v * 167 + Math.cos(u * 71));
      height = height * 0.45 + (over ? warp : weft) * 118 + Math.max(warp, weft) * 22 + slub * 14;
      // Thread gaps darken the photo slightly so the weave shows in colour too.
      const gap = 1 - Math.max(warp, weft) * 0.16;
      for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(THREE.MathUtils.clamp((pixels[i + k] ?? 0) * gap, 0, 255));
    }
    const heightByte = Math.round(THREE.MathUtils.clamp(height, 0, 255));
    for (let k = 0; k < 3; k++) {
      relief[i + k] = heightByte;
      // Raised slub yarns catch light slightly; recessed gaps stay fully matte.
      roughness[i + k] = Math.round(THREE.MathUtils.clamp(tweed ? 255 - heightByte * 0.18 : 245 - heightByte * 0.04, 0, 255));
    }
    relief[i + 3] = roughness[i + 3] = 255;
  }
  if (tweed) ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer.slice(0)), size, size), 0, 0);
  const configure = (texture: THREE.Texture, colorSpace: typeof THREE.SRGBColorSpace | typeof THREE.NoColorSpace) => {
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    map: configure(new THREE.CanvasTexture(canvas), THREE.SRGBColorSpace),
    bumpMap: configure(new THREE.DataTexture(relief, size, size), THREE.NoColorSpace),
    roughnessMap: configure(new THREE.DataTexture(roughness, size, size), THREE.NoColorSpace),
  };
}

// The preview and upholstery share exactly the same seamless repeat artwork.
function createPatternCanvas(fabric: FabricPreset) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx || !fabric.pattern) return canvas;
  const css = getComputedStyle(document.documentElement);
  const palette = ["base", "accent", "detail"].map((role) => {
    ctx.fillStyle = css.getPropertyValue(`--pattern-${fabric.id}-${role}`).trim();
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let color = 0;
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
    const thread = 0.97 + 0.03 * Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI);
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) image.data[i + k] = (rgb[k] ?? 0) * thread;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function FabricSwatch({ fabric }: { fabric: FabricPreset }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (fabric.photo || !canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return;
    if (fabric.pattern) {
      const artwork = createPatternCanvas(fabric);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(artwork, x * 64, y * 64, 64, 64);
    } else {
      const maps = createSurfaceMaps(fabric.tufted ? "leather" : fabric.weave);
      const data = maps.map.image.data;
      const w = maps.map.image.width;
      const image = ctx.createImageData(192, 192);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(`--fabric-${fabric.id}`).trim();
      ctx.fillRect(0, 0, 1, 1);
      const color = ctx.getImageData(0, 0, 1, 1).data;
      for (let i = 0; i < 192 * 192; i++) {
        const source = ((Math.floor(i / 192) * w + i % 192) * 4);
        for (let k = 0; k < 3; k++) image.data[i * 4 + k] = (color[k] ?? 0) * (data?.[source] ?? 255) / 255;
        image.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      Object.values(maps).forEach((map) => map.dispose());
    }
  }, [fabric]);
  return <span className="relative block h-9 w-full shrink-0 overflow-hidden rounded-[3px]">{fabric.photo ? <img src={fabric.photo} alt={`${fabric.name} fabric sample`} className="absolute inset-0 block h-full w-full object-cover" /> : <canvas ref={canvas} width={192} height={192} aria-hidden="true" className="absolute inset-0 block h-full w-full" />}</span>;
}

// Restrict thread size to a believable range; printed repeat size remains independently adjustable.
const weaveDensity = tileDensity;
const leatherDensity = tileDensity;

// Smooth periodic profile mirrors createSurfaceMaps("tuft") without mip-level
// flattening; it is sampled at physical coordinates for both depth and shading.
// `detail` removes sub-vertex/sub-pixel button heads that otherwise alias into
// jagged spikes; `tuftPanelMask` keeps rolled edges, corners and the base welt
// smooth (as real Chesterfields are) where triplanar projections would switch.
const tuftProfileGLSL = `
  float tuftProfile(vec2 uv, float detail, vec2 footprint) {
    vec2 cell = fract(vec2(uv.x + uv.y, uv.x - uv.y));
    vec2 edge = min(cell, 1.0 - cell);
    // Round crease cusps over the actual pixel footprint, not a fixed hard cut.
    vec2 filterWidth = min(footprint, vec2(0.12));
    edge = sqrt(edge * edge + filterWidth * filterWidth * 0.25);
    float r = dot(edge, edge);
    float crown = pow(max(0.0, sin(cell.x * 3.14159265) * sin(cell.y * 3.14159265)), 1.3);
    float edgeWidth = max(max(filterWidth.x, filterWidth.y), 0.00001);
    float pleat = (1.0 - exp(-min(edge.x, edge.y) / 0.035)) * smoothstep(0.0, edgeWidth, min(edge.x, edge.y));
    return clamp(0.30 + 0.62 * crown + 0.08 * pleat - 0.34 * exp(-r / 0.0055) + 0.16 * detail * exp(-r / 0.00035), 0.0, 1.0);
  }
  float tuftProfile(vec2 uv, float detail) { return tuftProfile(uv, detail, vec2(0.0)); }
  // Independent sewn-panel coordinates. Use joined world coordinates so a
  // clipped/reflected module never restarts the repeat at its cut boundary.
  vec2 seatTuftUV(vec3 p) { return p.xz + vec2(0.035, -0.025); }
  vec2 backTuftUV(vec3 p) { return p.xy + vec2(0.035, 0.075); }
  vec2 armTuftUV(vec3 p) { return p.zy + vec2(-0.025, 0.045); }
  float tuftPanelMask(vec3 n) {
    vec3 a = abs(n);
    return smoothstep(0.64, 0.78, max(a.x, max(a.y, a.z)));
  }
`;

function projectSurface(material: THREE.MeshStandardMaterial, density: number, scale: number, pattern: THREE.Texture | null = null, patternRepeat = density * (8 / 5.6), tuft = false, undersideColor: THREE.Color | null = null, photo = false, soften = 0, directional = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms["surfaceDensity"] = { value: density / scale };
    if (undersideColor) shader.uniforms["undersideColor"] = { value: undersideColor };
    if (tuft) {
      shader.uniforms["tuftDensity"] = { value: 4.5 / scale };
      shader.uniforms["tuftDepth"] = { value: RELIEF.recess * scale };
    }
    if (pattern) {
      shader.uniforms["patternMap"] = { value: pattern };
      shader.uniforms["patternDensity"] = { value: patternRepeat / scale };
    }
    shader.vertexShader = "varying vec3 surfacePosition; varying vec3 surfaceNormal; varying vec3 surfaceFacingNormal; varying float surfaceBaseHeight;\n" + shader.vertexShader;
    if (soften > 0) {
      shader.uniforms["normalSoften"] = { value: soften };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
          uniform float normalSoften;
          ${tuft ? "" : "attribute vec4 tuftFrame;"}`)
        .replace("#include <beginnormal_vertex>", `
          vec3 softPanel = normalize(tuftFrame.xyz + vec3(0.0001));
          float softMask = smoothstep(0.64, 0.78, max(abs(softPanel.x), max(abs(softPanel.y), abs(softPanel.z))));
          vec3 objectNormal = normalize(mix(vec3(normal), softPanel, normalSoften * softMask));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif`);
    }
    if (tuft) {
      // Evaluate in joined world coordinates BEFORE projection: every module
      // uses the same diamond grid, including the reflected chair halves.
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        attribute vec3 tuftDirection;
        attribute vec4 tuftFrame;
        uniform float tuftDensity;
        uniform float tuftDepth;
        varying float vTuftMask;
        ${tuftProfileGLSL}
        float paddedHeight(vec3 p, vec3 n) {
          vec3 w = pow(abs(n), vec3(12.0));
          w /= max(dot(w, vec3(1.0)), 0.0001);
          return dot(vec3(tuftProfile(armTuftUV(p) * tuftDensity, 0.0), tuftProfile(seatTuftUV(p) * tuftDensity, 0.0), tuftProfile(backTuftUV(p) * tuftDensity, 0.0)), w);
        }`);
      shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `
        vec3 tuftOriginalPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec3 tuftNormal = normalize(vec3(dot(tuftDirection, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)), dot(tuftDirection, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)), dot(tuftDirection, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))));
        vec3 tuftPanel = normalize(vec3(dot(tuftFrame.xyz, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)), dot(tuftFrame.xyz, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)), dot(tuftFrame.xyz, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))));
        // Panels only: rolled edges, wrinkled borders and the welt above the
        // legs stay smooth so the surface never tears where projections meet.
        vTuftMask = tuftFrame.w * tuftPanelMask(tuftPanel);
        // Recess seams and buttons inside the original envelope; padded crowns
        // retain the supplied sofa dimensions instead of inflating its bounds.
        vec3 tuftOffset = -tuftNormal * tuftDepth * vTuftMask * (1.0 - paddedHeight(tuftOriginalPosition, tuftPanel));
        vec3 tuftX = modelMatrix[0].xyz, tuftY = modelMatrix[1].xyz, tuftZ = modelMatrix[2].xyz;
        transformed += vec3(dot(tuftOffset, tuftX) / max(dot(tuftX, tuftX), 0.000001), dot(tuftOffset, tuftY) / max(dot(tuftY, tuftY), 0.000001), dot(tuftOffset, tuftZ) / max(dot(tuftZ, tuftZ), 0.000001));
        #include <project_vertex>`);
    }
    shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
      // transformedNormal uses the inverse-transpose normal matrix in view space.
      // Convert it to world space; keep it separate from the tuft projection frame.
      surfaceFacingNormal = inverseTransformDirection(transformedNormal, viewMatrix);
      // Source-space height is stable across seating calibration, scale and
      // tuft displacement. Only the hidden base gets lining, never cushions.
      surfaceBaseHeight = position.y;
      surfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      surfaceNormal = normalize(vec3(dot(normal, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))));`);
    if (tuft) shader.vertexShader = shader.vertexShader
      .replace("surfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;", "surfacePosition = tuftOriginalPosition;")
      .replace("surfaceNormal = normalize(vec3(dot(normal, inverseTransformDirection(vec3(1.0, 0.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 1.0, 0.0), modelMatrix)), dot(normal, inverseTransformDirection(vec3(0.0, 0.0, 1.0), modelMatrix))));", "surfaceNormal = tuftPanel;");
    shader.fragmentShader = `varying vec3 surfacePosition;
      varying vec3 surfaceNormal;
      varying vec3 surfaceFacingNormal;
      varying float surfaceBaseHeight;
      uniform float surfaceDensity;
      vec4 surfaceSample(sampler2D tex, vec3 p) {
        vec3 weights = pow(abs(normalize(surfaceNormal)), vec3(6.0));
        weights /= max(weights.x + weights.y + weights.z, 0.0001);
        vec3 tileP = p * surfaceDensity;
        ${photo ? `// Distinct cutting phases/quarter-turn for arms, seats and back.
        // All three photo maps use these same coordinates; never offset by module.
        vec2 armUV = ${directional ? "tileP.zy" : "vec2(-tileP.y, tileP.z)"} + vec2(0.37, 0.19);
        vec2 seatUV = tileP.xz + vec2(0.11, 0.43);
        vec2 backUV = tileP.xy + vec2(0.61, 0.07);` : `vec2 armUV = tileP.yz;
        vec2 seatUV = tileP.xz;
        vec2 backUV = tileP.xy;`}
        return texture2D(tex, armUV) * weights.x
          + texture2D(tex, seatUV) * weights.y
          + texture2D(tex, backUV) * weights.z;
      }\n` + shader.fragmentShader;
    if (tuft) {
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        uniform float tuftDensity;
        varying float vTuftMask;
        ${tuftProfileGLSL}
        float tuftHeight(vec3 p) {
          vec3 w = pow(abs(normalize(surfaceNormal)), vec3(12.0));
          w /= max(dot(w, vec3(1.0)), 0.0001);
          // Fade button heads once they shrink below a pixel to avoid sparkle.
          float detail = 1.0 - smoothstep(0.012, 0.04, length(fwidth(surfacePosition)) * tuftDensity);
          vec2 armUV = armTuftUV(p) * tuftDensity;
          vec2 seatUV = seatTuftUV(p) * tuftDensity;
          vec2 backUV = backTuftUV(p) * tuftDensity;
          vec3 h3 = vec3(
            tuftProfile(armUV, detail, fwidth(vec2(armUV.x + armUV.y, armUV.x - armUV.y))),
            tuftProfile(seatUV, detail, fwidth(vec2(seatUV.x + seatUV.y, seatUV.x - seatUV.y))),
            tuftProfile(backUV, detail, fwidth(vec2(backUV.x + backUV.y, backUV.x - backUV.y))));
          float h = dot(h3, w);
          return mix(1.0, h, clamp(vTuftMask, 0.0, 1.0));
        }
        float tuftPanelH(int panel, vec3 p, float detail, vec2 fp) {
          vec2 uv = (panel == 0 ? armTuftUV(p) : (panel == 1 ? seatTuftUV(p) : backTuftUV(p))) * tuftDensity;
          return tuftProfile(uv, detail, fp);
        }
        vec4 surfaceRelief(sampler2D tex, vec3 p) { return vec4(tuftHeight(p) + surfaceSample(tex, p).r * 0.075); }
        \n`);
      // Seams and button pockets read as softly occluded folds.
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nfloat tuftShade = tuftHeight(surfacePosition);\ndiffuseColor.rgb *= ${RELIEF.seamShadeMin.toFixed(3)} + ${RELIEF.seamShadeRange.toFixed(3)} * smoothstep(0.0, 0.85, tuftShade);`);
      // Stretched crowns are slightly glossier than the creased seams.
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * mix(1.22, 0.88, tuftShade), 0.04, 1.0);');
      // Keep screen-space derivatives only for fine grain; probe the analytic
      // tuft profile in physical panel coordinates to avoid 2x2-quad stair steps.
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        // fine grain only: tiny amplitude, keep the old derivative path
        vec3 paddingDx = dFdx(-vViewPosition);
        vec3 paddingDy = dFdy(-vViewPosition);
        vec3 paddingR1 = cross(paddingDy, normal);
        vec3 paddingR2 = cross(normal, paddingDx);
        float paddingDet = dot(paddingDx, paddingR1);
        float paddingHeight = surfaceSample(bumpMap, surfacePosition).r * ${RELIEF.grainNormal.toFixed(5)} * ${scale.toFixed(6)};
        vec3 paddingGradient = sign(paddingDet) * (dFdx(paddingHeight) * paddingR1 + dFdy(paddingHeight) * paddingR2);
        normal = normalize(max(abs(paddingDet), 0.00000001) * normal - paddingGradient);

        // tufts: analytic gradient by central differences on the dominant panel
        vec3 tpA = abs(normalize(surfaceNormal));
        int tpPanel = (tpA.y >= tpA.x && tpA.y >= tpA.z) ? 1 : ((tpA.z >= tpA.x) ? 2 : 0);
        vec2 tpUv = (tpPanel == 0 ? armTuftUV(surfacePosition) : (tpPanel == 1 ? seatTuftUV(surfacePosition) : backTuftUV(surfacePosition))) * tuftDensity;
        vec2 tpFp = fwidth(vec2(tpUv.x + tpUv.y, tpUv.x - tpUv.y));
        float tpDetail = 1.0 - smoothstep(0.012, 0.04, length(fwidth(surfacePosition)) * tuftDensity);
        vec3 tpE1 = tpPanel == 0 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 tpE2 = tpPanel == 1 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
        float tpStep = ${(0.003 * scale).toFixed(6)};
        float tpH1 = tuftPanelH(tpPanel, surfacePosition + tpE1 * tpStep, tpDetail, tpFp) - tuftPanelH(tpPanel, surfacePosition - tpE1 * tpStep, tpDetail, tpFp);
        float tpH2 = tuftPanelH(tpPanel, surfacePosition + tpE2 * tpStep, tpDetail, tpFp) - tuftPanelH(tpPanel, surfacePosition - tpE2 * tpStep, tpDetail, tpFp);
        vec3 tpGradWorld = (tpE1 * tpH1 + tpE2 * tpH2) / (2.0 * tpStep) * clamp(vTuftMask, 0.0, 1.0);
        vec3 tpGrad = (viewMatrix * vec4(tpGradWorld, 0.0)).xyz * ${RELIEF.normalHeight.toFixed(4)} * ${scale.toFixed(6)};
        normal = normalize(normal - (tpGrad - dot(tpGrad, normal) * normal));
      `);
    }
    if (pattern) {
      shader.fragmentShader = `uniform sampler2D patternMap;
        uniform float patternDensity;
        \n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        vec3 patternWeights = pow(abs(normalize(surfaceNormal)), vec3(12.0));
        patternWeights /= max(dot(patternWeights, vec3(1.0)), 0.0001);
        vec3 patternP = (surfacePosition - vec3(0.0, 0.015, 0.0)) * patternDensity;
        // SRGBColorSpace textures are decoded by the GPU before filtering.
        diffuseColor.rgb *= texture2D(patternMap, patternP.zy).rgb * patternWeights.x
          + texture2D(patternMap, patternP.xz).rgb * patternWeights.y
          + texture2D(patternMap, patternP.xy).rgb * patternWeights.z;`);
    }
    if (undersideColor) {
      shader.fragmentShader = "uniform vec3 undersideColor;\n" + shader.fragmentShader;
      // Facing down alone also catches visible cushion folds. Restrict lining
      // to the base underside below the welt and fade both boundaries, leaving
      // exposed folds in the selected fabric with ordinary lighting/shadows.
      shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
        float baseLiningMask = (1.0 - smoothstep(-0.320, -0.305, surfaceBaseHeight))
          * (1.0 - smoothstep(-0.85, -0.60, normalize(surfaceFacingNormal).y));
        diffuseColor.rgb = mix(diffuseColor.rgb, undersideColor, baseLiningMask);
        #include <alphamap_fragment>`);
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
  material.customProgramCacheKey = () => `physical-surface-v20-panel-analytic-${density}-${patternRepeat}-${scale}-${pattern?.uuid ?? "plain"}-${tuft ? "tufted" : "smooth"}-${photo ? "photo-panels" : "standard"}-${undersideColor ? "lined" : "unlined"}${directional ? "-dir" : ""}-soft${soften}`;
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
  // Locate each tapered foot from its tip, then claim the full cone up to the
  // base underside so no upholstery colour bleeds onto the top of the legs.
  const legAxes = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => {
    let x = 0, z = 0, count = 0;
    for (let index = 0; index < position.count; index += 1) {
      const px = position.getX(index), pz = position.getZ(index);
      if (position.getY(index) < -0.37 && px * (sx ?? 1) > 0.7 && pz * (sz ?? 1) > 0.2) { x += px; z += pz; count += 1; }
    }
    return count ? [x / count, z / count] as const : null;
  }).filter((axis): axis is readonly [number, number] => axis !== null);
  const fabric: number[] = [];
  const legs: number[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const indices = [0, 1, 2].map((corner) =>
      sourceIndex ? sourceIndex.getX(triangle * 3 + corner) : triangle * 3 + corner,
    );
    const centerX = indices.reduce((sum, index) => sum + position.getX(index), 0) / 3;
    const centerY = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
    const centerZ = indices.reduce((sum, index) => sum + position.getZ(index), 0) / 3;
    const isLeg = centerY < -0.3085 && legAxes.some(([x, z]) => Math.hypot(centerX - x, centerZ - z) < 0.0335);
    (isLeg ? legs : fabric).push(...indices);
  }
  geometry.setIndex([...fabric, ...legs]);
  geometry.clearGroups();
  geometry.addGroup(0, fabric.length, 0);
  geometry.addGroup(fabric.length, legs.length, 1);
  // The source export contains inconsistent normals on the feet; repair before clipping.
  geometry.computeVertexNormals();
  // UV/hard-normal duplicates must move together. Keep shading normals intact,
  // but give coincident upholstery vertices one shared displacement direction.
  const normals = geometry.getAttribute("normal");
  const directions = new Map<string, THREE.Vector3>();
  const keyAt = (i: number) => `${Math.round(position.getX(i) * 10000)}:${Math.round(position.getY(i) * 10000)}:${Math.round(position.getZ(i) * 10000)}`;
  for (let i = 0; i < position.count; i++) {
    const key = keyAt(i);
    const direction = directions.get(key) ?? new THREE.Vector3();
    direction.x += normals.getX(i); direction.y += normals.getY(i); direction.z += normals.getZ(i);
    directions.set(key, direction);
  }
  directions.forEach((direction) => direction.normalize());
  // The GLB splits vertices at UV seams: computeVertexNormals alone leaves
  // disconnected face normals. Smooth upholstery duplicates without welding
  // positions or changing the legs, module cuts, or displacement envelope.
  for (const i of new Set(fabric)) {
    const direction = directions.get(keyAt(i));
    if (direction) normals.setXYZ(i, direction.x, direction.y, direction.z);
  }
  normals.needsUpdate = true;
  const tuftDirections = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const direction = directions.get(keyAt(i));
    if (direction) direction.toArray(tuftDirections, i * 3);
  }
  geometry.setAttribute("tuftDirection", new THREE.BufferAttribute(tuftDirections, 3));
  geometry.setAttribute("tuftFrame", new THREE.BufferAttribute(tuftPanelFrame(position, geometry.index, fabric.length, keyAt, directions), 4));
  return geometry;
}

// Tufting belongs on broad panels. A neighbourhood-smoothed normal picks one
// stable projection per panel (xyz), and w fades the tufting out across rolled
// edges, wrinkled cushion borders and the base welt, where per-vertex normals
// flip between projections and would tear the padded relief.
function tuftPanelFrame(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: THREE.BufferAttribute | null, fabricCount: number, keyAt: (i: number) => string, directions: Map<string, THREE.Vector3>) {
  const ids = new Map<string, number>();
  const vertexId = new Int32Array(position.count);
  const raw: THREE.Vector3[] = [];
  const heights: number[] = [];
  for (let i = 0; i < position.count; i += 1) {
    const key = keyAt(i);
    let id = ids.get(key);
    if (id === undefined) {
      id = raw.length;
      ids.set(key, id);
      raw.push(directions.get(key)?.clone() ?? new THREE.Vector3(0, 1, 0));
      heights.push(position.getY(i));
    }
    vertexId[i] = id;
  }
  const count = raw.length;
  const neighbours: Set<number>[] = Array.from({ length: count }, () => new Set<number>());
  const onFabric = new Uint8Array(count);
  for (let i = 0; i < fabricCount; i += 3) {
    const tri = [0, 1, 2].map((k) => vertexId[index ? index.getX(i + k) : i + k] ?? 0);
    for (const a of tri) {
      onFabric[a] = 1;
      for (const b of tri) if (a !== b) neighbours[a]?.add(b);
    }
  }
  const lists = neighbours.map((set) => Array.from(set));
  let smooth = raw.map((v) => v.clone());
  for (let pass = 0; pass < 28; pass += 1) {
    smooth = smooth.map((v, i) => {
      const next = v.clone();
      for (const j of lists[i] ?? []) next.add(smooth[j] ?? v);
      return next.normalize();
    });
  }
  let mask = smooth.map((v, i) => {
    const a = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const panel = THREE.MathUtils.smoothstep(a, 0.70, 0.84);
    const wrinkle = 1 - THREE.MathUtils.smoothstep(1 - (raw[i]?.dot(v) ?? 1), 0.16, 0.36);
    const welt = THREE.MathUtils.smoothstep(heights[i] ?? 0, -0.305, -0.265);
    return onFabric[i] ? panel * wrinkle * welt : 0;
  });
  for (let pass = 0; pass < 6; pass += 1) {
    mask = mask.map((value, i) => {
      const list = lists[i] ?? [];
      let sum = value;
      for (const j of list) sum += mask[j] ?? value;
      return Math.min(value, sum / (list.length + 1)) * 0.5 + (sum / (list.length + 1)) * 0.5;
    });
  }
  const frame = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i += 1) {
    const id = vertexId[i] ?? 0;
    const v = smooth[id] ?? raw[id] ?? new THREE.Vector3(0, 1, 0);
    frame.set([v.x, v.y, v.z, mask[id] ?? 0], i * 4);
  }
  return frame;
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
  const direction = result.getAttribute("tuftDirection");
  const frame = result.getAttribute("tuftFrame");
  for (let i = 0; i < p.count; i += 1) {
    p.setX(i, -p.getX(i));
    n.setX(i, -n.getX(i));
    if (direction) direction.setX(i, -direction.getX(i));
    if (frame) frame.setX(i, -frame.getX(i));
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
  const directions = geometry.getAttribute("tuftDirection");
  const frames = geometry.getAttribute("tuftFrame");
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    const blend = THREE.MathUtils.smoothstep(Math.abs(positions.getX(i) - plane), 0, 0.025);
    if (frames) {
      normal.set(frames.getX(i) * blend, frames.getY(i), frames.getZ(i)).normalize();
      frames.setXYZ(i, normal.x, normal.y, normal.z);
    }
    normal.set(normals.getX(i) * blend, normals.getY(i), normals.getZ(i)).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
    if (directions) {
      normal.set(directions.getX(i) * blend, directions.getY(i), directions.getZ(i)).normalize();
      directions.setXYZ(i, normal.x, normal.y, normal.z);
    }
  }
}

function joinedModule(source: THREE.BufferGeometry) {
  const half = sliceModule(source, -MODULE_WIDTH / 2, 0);
  half.translate(MODULE_WIDTH / 2, 0, 0);
  softenMirrorPlane(half, 0);
  return [reflectedGeometry(half), half];
}

function SofaModel({ fabric, leg, textureScale, scale, seats, reducedMotion, wireframe }: { fabric: FabricId; leg: LegId; textureScale: number; scale: number; seats: SeatCount; reducedMotion: boolean; wireframe: boolean }) {
  const gl = useThree((state) => state.gl);
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
  useEffect(() => {
    if (!import.meta.env.DEV || !sourceBounds || seats !== 2 || scale !== 1) return;
    const timer = window.setTimeout(() => {
      if (!assembly.current) return;
      const size = new THREE.Box3().setFromObject(assembly.current).getSize(new THREE.Vector3());
      const src = sourceBounds.getSize(new THREE.Vector3());
      const f = [BASE_SIZE.width / src.x, BASE_SIZE.height / src.y, BASE_SIZE.depth / src.z];
      console.info("[scale audit]", {
        widthCm: +(size.x * 100).toFixed(1),
        heightCm: +(size.y * 100).toFixed(1),
        depthCm: +(size.z * 100).toFixed(1),
        stretchFactors: f.map((v) => +v.toFixed(4)),
        stretchSpreadPct: +(((Math.max(...f) - Math.min(...f)) / Math.min(...f)) * 100).toFixed(1),
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [sourceBounds, seats, scale]);
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
    const directions = half.getAttribute("tuftDirection");
    const normal = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      const stretched = positions.getX(i) > -MODULE_WIDTH / 2;
      normal.set(normals.getX(i) / (stretched ? 2 : 1), normals.getY(i), normals.getZ(i)).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
      if (directions) {
        normal.set(directions.getX(i) / (stretched ? 2 : 1), directions.getY(i), directions.getZ(i)).normalize();
        directions.setXYZ(i, normal.x, normal.y, normal.z);
      }
      const frames = half.getAttribute("tuftFrame");
      if (frames) {
        normal.set(frames.getX(i) / (stretched ? 2 : 1), frames.getY(i), frames.getZ(i)).normalize();
        frames.setXYZ(i, normal.x, normal.y, normal.z);
      }
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
    assembly.current.position.set(-sourceCenter.x * sx, FLOOR_LIFT.studio - sourceBounds.min.y * sy, -sourceCenter.z * sz);
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
      chair.current.position.set(0, FLOOR_LIFT.studio - chairBounds.min.y * chairSy, -chairCenter.z * chairSz);
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
  const leather = selectedFabric.weave === "leather";
  const fabricPhoto = useTexture(selectedFabric.photo ?? wisdomAsset.url);
  const patternTexture = useMemo(() => {
    if (!selectedFabric.pattern) return null;
    const texture = new THREE.CanvasTexture(createPatternCanvas(selectedFabric));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }, [selectedFabric]);
  useEffect(() => () => patternTexture?.dispose(), [patternTexture]);
  const fabricTexture = useMemo(
    () => selectedFabric.photo ? createPhotoSurfaceMaps(fabricPhoto.image as HTMLImageElement, selectedFabric.id === "red-fish" ? 128 : undefined, selectedFabric.weave === "tweed" ? 1.1 : 0.45) : createSurfaceMaps(selectedFabric.weave),
    [selectedFabric.id, selectedFabric.weave, selectedFabric.photo, fabricPhoto],
  );
  const legTexture = useMemo(() => createSurfaceMaps(leg === "steel" ? "steel" : "wood"), [leg]);
  useEffect(() => () => Object.values(fabricTexture).forEach((map) => map.dispose()), [fabricTexture]);
  useEffect(() => () => Object.values(legTexture).forEach((map) => map.dispose()), [legTexture]);
  useEffect(() => {
    const surfaces = [fabricTexture, legTexture];
    const colorTextures = new Set<THREE.Texture>([...surfaces.map((surface) => surface.map), ...(patternTexture ? [patternTexture] : [])]);
    const textures = [...surfaces.flatMap((surface) => Object.values(surface)), ...(patternTexture ? [patternTexture] : [])];
    for (const texture of textures) {
      texture.colorSpace = colorTextures.has(texture) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    }
  }, [gl, fabricTexture, legTexture, patternTexture]);
  const materials = useMemo(() => {
    const colorCanvas = document.createElement("canvas");
    const colorContext = colorCanvas.getContext("2d");
    let fabricColor = new THREE.Color(selectedFabric.color || DEFAULT_FABRIC.color);
    if (selectedFabric.photo) fabricColor = new THREE.Color(1, 1, 1);
    if (!selectedFabric.pattern && !selectedFabric.photo && colorContext) {
      colorContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(`--fabric-${selectedFabric.id}`).trim();
      colorContext.fillRect(0, 0, 1, 1);
      const rgb = colorContext.getImageData(0, 0, 1, 1).data;
      fabricColor = new THREE.Color().setRGB((rgb[0] ?? 0) / 255, (rgb[1] ?? 0) / 255, (rgb[2] ?? 0) / 255, THREE.SRGBColorSpace);
    }
    const family = leather ? "leather" : selectedFabric.weave === "velvet" ? "velvet" : "woven";
    const look = resolveLook(selectedFabric.id, family, Boolean(selectedFabric.tufted));
    const whiteBase = Boolean(selectedFabric.pattern || selectedFabric.photo);
    const upholstery = new THREE.MeshPhysicalMaterial({ color: fabricColor, ...fabricTexture });
    applyLook(upholstery, look, fabricColor, whiteBase);
    upholstery.userData["baseColor"] = fabricColor;
    upholstery.userData["normalSoften"] = look.normalSoften;
    const feet = new THREE.MeshPhysicalMaterial({
      color: selectedLeg.color,
      ...legTexture,
      bumpScale: leg === "steel" ? 0.000008 : 0.000025,
      ...materialRecipe(leg === "steel" ? "steel" : "wood"),
    });
    // A neutral dark lining replaces stretched upholstery under the base.
    let undersideColor = new THREE.Color();
    if (colorContext) {
      colorContext.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--fabric-underside").trim();
      colorContext.fillRect(0, 0, 1, 1);
      const rgb = colorContext.getImageData(0, 0, 1, 1).data;
      undersideColor.setRGB((rgb[0] ?? 0) / 255, (rgb[1] ?? 0) / 255, (rgb[2] ?? 0) / 255, THREE.SRGBColorSpace);
    }
    upholstery.userData["undersideColor"] = undersideColor;
    projectSurface(upholstery, leather ? leatherDensity(textureScale) : selectedFabric.photo ? tileDensity(textureScale) : weaveDensity(textureScale), scale, patternTexture, tileDensity(textureScale), selectedFabric.tufted ?? false, undersideColor, Boolean(selectedFabric.photo), look.normalSoften, Boolean(selectedFabric.directional));
    projectSurface(feet, leg === "steel" ? 3 : 1.6, scale);
    return [upholstery, feet];
  }, [fabricTexture, legTexture, selectedFabric, selectedLeg, textureScale, scale, leg, patternTexture, leather]);
  const chairMaterials = useMemo(() => materials.map((material, i) => {
    const clone = material.clone();
    const lining = material.userData["undersideColor"];
    const soften = i === 0 ? Number(material.userData["normalSoften"] ?? 0) : 0;
    projectSurface(clone, i === 0 ? selectedFabric.weave === "leather" ? leatherDensity(textureScale) : selectedFabric.photo ? tileDensity(textureScale) : weaveDensity(textureScale) : leg === "steel" ? 3 : 1.6, scale, i === 0 ? patternTexture : null, tileDensity(textureScale), i === 0 && Boolean(selectedFabric.tufted), i === 0 && lining instanceof THREE.Color ? lining : null, i === 0 && Boolean(selectedFabric.photo), soften, i === 0 && Boolean(selectedFabric.directional));
    return clone;
  }), [materials, textureScale, leg, scale, patternTexture, selectedFabric]);
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

// Capture after the seating transition settles, not on every orbit frame.
// Remount for size/scale changes; finite captures keep software GPUs usable.
function SofaContactShadows({ seats, scale }: { seats: SeatCount; scale: number }) {
  const revision = `${seats}-${scale}`;
  const [settled, setSettled] = useState<string | null>(null);
  const color = useMemo(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return new THREE.Color().getStyle();
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--scene-contact-shadow").trim();
    context.fillRect(0, 0, 1, 1);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB((pixel[0] ?? 0) / 255, (pixel[1] ?? 0) / 255, (pixel[2] ?? 0) / 255, THREE.SRGBColorSpace).getStyle();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(revision), 700);
    return () => window.clearTimeout(timer);
  }, [revision]);
  if (settled !== revision) return null;
  return <ContactShadows key={revision} name="sofa-contact-shadow" position={[0, 0.009, 0]} scale={6} far={1.5} opacity={0.38} blur={2.5} resolution={256} frames={1} color={color} depthWrite={false} renderOrder={2} />;
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
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: LIGHTING.exposure, outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl, camera }) => { gl.domElement.dataset["viewerCanvas"] = "true"; camera.layers.enable(1); }}
    >
      <color attach="background" args={[studio ? "#ebe9e4" : "#d9ded8"]} />
      <LightRig />
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow onUpdate={(floor) => floor.layers.set(1)}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={studio ? "#e3e0da" : "#ccd3cc"} roughness={0.96} />
      </mesh>
      {grid && <gridHelper name="floor-grid" args={[12, 24, "#8f948d", "#c4c4bd"]} position-y={0.006} renderOrder={1} onUpdate={(helper) => {
        // The contact camera sees layer 0 only: never bake floor/grid into shadows.
        helper.layers.set(1);
        // Draw after the opaque floor, but keep depth testing so the sofa occludes the lines.
        const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
        materials.forEach((material) => { material.depthWrite = false; });
      }} />}
      <Suspense fallback={null}>
        <SofaModel fabric={fabric} leg={leg} textureScale={textureScale} scale={scale} seats={seats} reducedMotion={reducedMotion} wireframe={wireframe} />
        <SofaContactShadows seats={seats} scale={scale} />
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
    <Button type="button" variant={active ? "selected" : "outline"} size="icon" onClick={onClick} aria-label={label} aria-pressed={active} title={label}>
      {children}
    </Button>
  );
}

export function SofaConfigurator() {
  const [seats, setSeats] = useState<SeatCount>(2);
  const reducedMotion = useReducedMotion();
  const [fabric, setFabric] = useState<FabricId>("oat");
  const [leg, setLeg] = useState<LegId>("oak");
  const [textureScale, setTextureScale] = useState(DEFAULT_TILE_CM);
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
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-border/60 bg-surface px-4 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Box className="size-4" /></div>
          <div><div className="font-display text-base font-semibold leading-none">Panache</div><div className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">Product configurator</div></div>
        </div>
        <div className="hidden text-center md:block"><div className="text-xs font-semibold">Panache OPAA · {seats} seater</div><div className="mt-1 text-[10px] text-muted-foreground">{selectedFabric.name} · {selectedLeg.name}</div></div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={screenshot} aria-label="Download image" title="Download image"><Download className="size-4" /></Button>
          <Button variant="outline" size="icon-sm" onClick={fullscreen} aria-label="Fullscreen" title="Fullscreen"><Expand className="size-4" /></Button>
        </div>
      </header>

      <nav aria-label="Viewer controls" className="absolute left-3 top-20 z-20 flex flex-col gap-2 rounded-md border border-border/60 bg-surface p-1.5 shadow-panel sm:left-5">
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

      <section className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 sm:left-[calc((100%_-_var(--panel-width))/_2)] rounded-md border border-border/60 bg-surface p-1 shadow-panel sm:bottom-5">
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
        <div className="configuration-scroll h-[calc(100%_-_3.25rem)] overflow-y-auto px-4 pb-24 pt-5 sm:h-full sm:pb-6">
          <div><div className="text-[10px] font-semibold uppercase text-muted-foreground">01 / Configuration</div><h1 className="mt-1 font-display text-xl font-semibold leading-tight">Make it yours</h1></div>
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
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-[13px] font-semibold">Upholstery</h2><p className="mt-0.5 text-[10px] text-muted-foreground">{selectedFabric.family}</p></div><span className="max-w-[126px] text-right text-[10px] font-semibold leading-4">{selectedFabric.name}</span></div>
            {([
              { label: "Solids", items: FABRICS.filter((item) => !item.pattern && !item.printed && item.weave !== "leather") },
              { label: "Patterns", items: FABRICS.filter((item) => item.pattern || item.printed) },
              { label: "Leather & Chesterfield", items: FABRICS.filter((item) => item.weave === "leather") },
            ]).map((group) => <div key={group.label} className="mt-2.5">
              <p className="mb-1.5 text-[9px] font-semibold text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-6 gap-1.5">
              {group.items.map((item) => (
                <Button variant="ghost" key={item.id} type="button" onClick={() => { setFabric(item.id); setTextureScale(tileFor(item.id, DEFAULT_TILE_CM)); }} aria-label={`Select ${item.name}`} aria-pressed={fabric === item.id} className={cn("relative h-[70px] min-w-0 flex-col justify-start gap-1 rounded-sm border p-0.5 text-center", fabric === item.id ? "border-primary bg-accent/40 ring-1 ring-primary" : "border-transparent bg-surface")}>
                   <FabricSwatch fabric={item} />
                   <span className={cn("w-full whitespace-normal leading-[11px]", item.tufted ? "text-[7px]" : "text-[8px]", fabric === item.id ? "font-semibold text-foreground" : "text-muted-foreground")}>{item.name}</span>
                  {fabric === item.id && <span className="absolute right-1 top-1 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2" /></span>}
                </Button>
              ))}
              </div>
            </div>)}
            <label className="mt-3 block"><span className="flex items-center justify-between text-[11px]"><span className="font-medium">{selectedFabric.weave === "leather" ? "Grain tile" : selectedFabric.pattern || selectedFabric.photo ? "Pattern tile" : "Weave tile"}</span><span className="font-mono text-muted-foreground">{textureScale.toFixed(1)} cm / tile</span></span><input aria-label="Texture tile size" className="mt-2 w-full accent-primary" type="range" min={MIN_TILE_CM} max={MAX_TILE_CM} step="0.5" value={textureScale} onChange={(event) => setTextureScale(Number(event.target.value))} /></label>
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
  return <div className="rounded-sm border border-border/40 bg-muted/70 px-1.5 py-2.5"><div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-mono text-[11px] font-semibold tabular-nums">{formatDimension(value, unit)}</div></div>;
}

useGLTF.preload(sofaAsset.url);