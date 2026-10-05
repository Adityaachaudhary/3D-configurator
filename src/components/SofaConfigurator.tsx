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

type FabricId = "oat" | "sage" | "clay" | "ink" | "pearl" | "moss";
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
const seatingWidth = (seats: number) => BASE_SIZE.width + (seats - 2) * MODULE_WIDTH;

const BASE_SIZE = { width: 1.901083, height: 0.800197, depth: 0.837505 };
const FABRICS: Array<{ id: FabricId; name: string; family: string; color: string; weave: string }> = [
  { id: "oat", name: "Oat Bouclé", family: "Bouclé 04", color: "#b8aa91", weave: "loop" },
  { id: "pearl", name: "Pearl Linen", family: "Linen 01", color: "#d7d2c7", weave: "linen" },
  { id: "sage", name: "Sage Weave", family: "Weave 12", color: "#788477", weave: "linen" },
  { id: "clay", name: "Clay Twill", family: "Twill 07", color: "#a66f5b", weave: "twill" },
  { id: "moss", name: "Forest Chenille", family: "Chenille 09", color: "#46564b", weave: "loop" },
  { id: "ink", name: "Ink Velvet", family: "Velvet 02", color: "#34383b", weave: "velvet" },
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

function createFabricTexture(color: string, weave: string, repeat: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = color;
  context.fillRect(0, 0, 256, 256);
  context.globalAlpha = weave === "velvet" ? 0.08 : 0.2;
  context.strokeStyle = "#ffffff";
  context.lineWidth = weave === "loop" ? 1.4 : 0.7;
  const gap = weave === "loop" ? 7 : 5;
  for (let i = -256; i < 512; i += gap) {
    context.beginPath();
    if (weave === "twill") {
      context.moveTo(i, 0);
      context.lineTo(i - 256, 256);
    } else {
      context.moveTo(i, 0);
      context.lineTo(i, 256);
    }
    context.stroke();
  }
  context.globalAlpha = weave === "velvet" ? 0.05 : 0.15;
  context.strokeStyle = "#111111";
  for (let i = 0; i < 256; i += gap) {
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(256, weave === "twill" ? i + 256 : i);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
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
    const isLeg = centerY < -0.275 && Math.abs(centerX) > 0.76 && Math.abs(centerZ) > 0.2;
    (isLeg ? legs : fabric).push(...indices);
  }
  geometry.setIndex([...fabric, ...legs]);
  geometry.clearGroups();
  geometry.addGroup(0, fabric.length, 0);
  geometry.addGroup(fabric.length, legs.length, 1);
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

function SofaModel({ fabric, leg, textureScale, scale, seats, reducedMotion }: { fabric: FabricId; leg: LegId; textureScale: number; scale: number; seats: SeatCount; reducedMotion: boolean }) {
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
  const modules = useMemo(() => geometry ? [
    sliceModule(geometry, -Infinity, -MODULE_WIDTH),
    sliceModule(geometry, MODULE_WIDTH, Infinity),
    sliceModule(geometry, -MODULE_WIDTH, 0),
    sliceModule(geometry, 0, MODULE_WIDTH),
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
    half.computeVertexNormals();
    half.computeBoundingSphere();
    return half;
  }, [geometry]);
  useEffect(() => () => chairHalf?.dispose(), [chairHalf]);
  useEffect(() => () => { geometry?.dispose(); modules.forEach((module) => module.dispose()); }, [geometry, modules]);
  useFrame((_, rawDelta) => {
    if (!assembly.current) return;
    const n = reducedMotion ? seats : THREE.MathUtils.damp(animatedSeats.current, seats, 14, Math.min(rawDelta, 0.25));
    animatedSeats.current = Math.abs(n - seats) < 0.001 ? seats : n;
    const current = Math.max(2, animatedSeats.current);
    const chairBlend = THREE.MathUtils.clamp(2 - animatedSeats.current, 0, 1);
    assembly.current.visible = chairBlend < 0.999;
    if (chair.current) {
      chair.current.visible = chairBlend > 0.001;
      chair.current.scale.setScalar(scale * (0.95 + chairBlend * 0.05));
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
  const fabricTexture = useMemo(
    () => createFabricTexture(selectedFabric.color, selectedFabric.weave, textureScale),
    [selectedFabric, textureScale],
  );
  useEffect(() => () => fabricTexture.dispose(), [fabricTexture]);
  const materials = useMemo(() => {
    const upholstery = new THREE.MeshPhysicalMaterial({
      color: selectedFabric.color,
      map: fabricTexture,
      roughness: selectedFabric.weave === "velvet" ? 0.78 : 0.91,
      metalness: 0,
      sheen: selectedFabric.weave === "velvet" ? 0.55 : 0.18,
      sheenColor: new THREE.Color(selectedFabric.color),
      sheenRoughness: 0.85,
    });
    const feet = new THREE.MeshStandardMaterial({
      color: selectedLeg.color,
      roughness: selectedLeg.roughness,
      metalness: selectedLeg.metalness,
    });
    return [upholstery, feet];
  }, [fabricTexture, selectedFabric, selectedLeg]);
  const chairMaterials = useMemo(() => materials.map((material) => material.clone()), [materials]);
  useEffect(() => () => chairMaterials.forEach((material) => material.dispose()), [chairMaterials]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  const [leftCap, rightCap, leftSeat, rightSeat] = modules;
  if (!geometry || !chairHalf || !leftCap || !rightCap || !leftSeat || !rightSeat) return null;
  return (
    <>
    <group ref={assembly} name="sofa-assembly" scale={scale} position={[0, 0.396396 * scale + 0.015, 0]} dispose={null}>
      <mesh geometry={leftCap} material={materials} castShadow receiveShadow />
      <mesh geometry={rightCap} material={materials} castShadow receiveShadow />
      <mesh geometry={leftSeat} material={materials} castShadow receiveShadow />
      <group><mesh geometry={rightSeat} material={materials} position-x={-MODULE_WIDTH / 2} castShadow receiveShadow /></group>
      <group><mesh geometry={leftSeat} material={materials} position-x={MODULE_WIDTH / 2} castShadow receiveShadow /></group>
    </group>
    <group ref={chair} name="chair-assembly" scale={scale} position={[0, 0.396396 * scale + 0.015, 0]} dispose={null}>
      <mesh geometry={chairHalf} material={chairMaterials} castShadow receiveShadow />
      <mesh geometry={chairHalf} material={chairMaterials} scale-x={-1} castShadow receiveShadow />
    </group>
    </>
  );
}

function Dimensions({ scale, unit, seats, reducedMotion }: { scale: number; unit: Unit; seats: SeatCount; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const current = useRef<number>(2);
  useFrame((_, delta) => {
    current.current = reducedMotion ? seats : THREE.MathUtils.damp(current.current, seats, 14, Math.min(delta, 0.25));
    if (group.current) group.current.scale.x = seatingWidth(current.current) / BASE_SIZE.width;
  });
  const width = BASE_SIZE.width * scale;
  const height = BASE_SIZE.height * scale;
  const depth = BASE_SIZE.depth * scale;
  const y = 0.08;
  void unit;
  return (
    <group ref={group}>
      <Line points={[[-width / 2, y, depth / 2 + 0.25], [width / 2, y, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
      <Line points={[[-width / 2, y - 0.06, depth / 2 + 0.25], [-width / 2, y + 0.06, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
      <Line points={[[width / 2, y - 0.06, depth / 2 + 0.25], [width / 2, y + 0.06, depth / 2 + 0.25]]} color="#263126" lineWidth={1} />
      <Line points={[[width / 2 + 0.25, 0.02, 0], [width / 2 + 0.25, height + 0.02, 0]]} color="#263126" lineWidth={1} />
      <Line points={[[-width / 2 - 0.22, y, -depth / 2], [-width / 2 - 0.22, y, depth / 2]]} color="#263126" lineWidth={1} />
    </group>
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

function Viewer({ fabric, leg, textureScale, scale, grid, measures, unit, rotate, studio, view, zoomSignal, seats, reducedMotion }: {
  fabric: FabricId; leg: LegId; textureScale: number; scale: number; grid: boolean; measures: boolean; unit: Unit; rotate: boolean; studio: boolean; view: ViewName; zoomSignal: number; seats: SeatCount; reducedMotion: boolean;
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
        <SofaModel fabric={fabric} leg={leg} textureScale={textureScale} scale={scale} seats={seats} reducedMotion={reducedMotion} />
      </Suspense>
      {measures && <Dimensions scale={scale} unit={unit} seats={seats} reducedMotion={reducedMotion} />}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableZoom={false}
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
  const [unit, setUnit] = useState<Unit>("cm");
  const [view, setView] = useState<ViewName>("perspective");
  const [zoomSignal, setZoomSignal] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const reset = useCallback(() => {
    setSeats(2); setFabric("oat"); setLeg("oak"); setTextureScale(7); setScale(1); setGrid(true); setMeasures(true); setRotate(false); setStudio(true); setUnit("cm"); setView("perspective");
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
      <div className="absolute inset-0 sm:right-[348px]"><Viewer fabric={fabric} leg={leg} textureScale={textureScale} scale={scale} grid={grid} measures={measures} unit={unit} rotate={rotate} studio={studio} view={view} zoomSignal={zoomSignal} seats={seats} reducedMotion={reducedMotion} /></div>
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
      </nav>

      <section className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 sm:left-[calc((100%-348px)/2)] rounded-md border border-border bg-surface/95 p-1 shadow-panel sm:bottom-5">
        <div className="flex items-center gap-1" role="group" aria-label="View presets">
          {(["perspective", "front", "side", "rear"] as ViewName[]).map((item) => (
            <Button key={item} variant={view === item ? "selected" : "ghost"} size="sm" onClick={() => setView(item)} className="capitalize">{item}</Button>
          ))}
        </div>
      </section>

      <aside className={cn("absolute bottom-0 right-0 top-16 z-30 w-full border-l border-border bg-surface shadow-panel transition-transform sm:w-[348px]", panelOpen ? "translate-y-0" : "translate-y-[calc(100%-3.25rem)]", "sm:translate-y-0")}>
        <Button variant="ghost" type="button" aria-expanded={panelOpen} className="flex h-13 w-full items-center justify-between border-b border-border px-5 text-left sm:hidden" onClick={() => setPanelOpen((value) => !value)}>
          <span className="text-sm font-semibold">Configure sofa · {seats} seater</span><ChevronDown className={cn("size-4 transition-transform", panelOpen && "rotate-180")} />
        </Button>
        <div className="h-[calc(100%-3.25rem)] overflow-y-auto px-5 pb-28 pt-5 sm:h-full sm:pb-8">
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase text-muted-foreground">01 / Configuration</div><h1 className="mt-1 font-display text-2xl font-semibold">Make it yours</h1></div><Move3D className="size-5 text-muted-foreground" /></div>
          <section className="mt-6" aria-labelledby="seating-heading">
            <div className="flex items-center justify-between"><h2 id="seating-heading" className="text-sm font-semibold">Seating</h2><span className="text-xs text-muted-foreground">{seats} seater</span></div>
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Seating options">
              {([1, 2, 3] as SeatCount[]).map((count) => (
                <Button key={count} variant={seats === count ? "selected" : "outline"} aria-pressed={seats === count} aria-label={`${count} seater`} onClick={() => setSeats(count)} className="h-20 flex-col gap-2 px-2">
                  <span aria-hidden="true" className="flex h-6 items-center gap-0.5 border-x-2 border-current px-1">
                    {Array.from({ length: count }, (_, i) => <span key={i} className="h-4 w-3 rounded-sm border border-current" />)}
                  </span>
                  <span className="text-xs">{count} seater</span>
                </Button>
              ))}
            </div>
          </section>
          <div className="my-6 h-px bg-border" />
          <section>
            <div className="flex items-end justify-between"><div><h2 className="text-sm font-semibold">Upholstery</h2><p className="mt-1 text-xs text-muted-foreground">{selectedFabric.family}</p></div><span className="text-xs font-medium">{selectedFabric.name}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {FABRICS.map((item) => (
                <button key={item.id} type="button" onClick={() => setFabric(item.id)} aria-label={`Select ${item.name}`} aria-pressed={fabric === item.id} className={cn("relative aspect-square rounded-md border bg-muted p-1.5 text-left", fabric === item.id ? "border-primary ring-1 ring-primary" : "border-border")}>
                  <span className="block h-full rounded-sm" style={{ backgroundColor: item.color }} />
                  {fabric === item.id && <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                </button>
              ))}
            </div>
            <label className="mt-5 block"><span className="flex items-center justify-between text-xs"><span className="font-medium">Weave scale</span><span className="font-mono text-muted-foreground">{textureScale}×</span></span><input className="mt-3 w-full accent-primary" type="range" min="3" max="14" step="1" value={textureScale} onChange={(event) => setTextureScale(Number(event.target.value))} /></label>
          </section>
          <div className="my-6 h-px bg-border" />
          <section>
            <div className="flex items-end justify-between"><div><h2 className="text-sm font-semibold">Leg finish</h2><p className="mt-1 text-xs text-muted-foreground">Frame details</p></div><span className="text-xs font-medium">{selectedLeg.name}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {LEGS.map((item) => (
                <button key={item.id} type="button" onClick={() => setLeg(item.id)} aria-pressed={leg === item.id} className={cn("flex h-12 items-center gap-3 rounded-md border px-3 text-left text-xs font-medium", leg === item.id ? "border-primary bg-accent" : "border-border bg-surface")}>
                  <span className="size-6 rounded-sm border border-border" style={{ backgroundColor: item.color }} />{item.name}{leg === item.id && <Check className="ml-auto size-3.5" />}
                </button>
              ))}
            </div>
          </section>
          <div className="my-6 h-px bg-border" />
          <section>
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Scale & dimensions</h2><p className="mt-1 text-xs text-muted-foreground">Estimated configuration size</p></div><CircleGauge className="size-4 text-muted-foreground" /></div>
            <div className="mt-4 flex rounded-md border border-border p-1">{(["cm", "mm", "in"] as Unit[]).map((item) => <Button key={item} variant={unit === item ? "selected" : "ghost"} size="sm" className="flex-1 uppercase" onClick={() => setUnit(item)}>{item}</Button>)}</div>
            <label className="mt-5 block"><span className="flex items-center justify-between text-xs"><span className="font-medium">Model scale</span><span className="font-mono text-muted-foreground">{Math.round(scale * 100)}%</span></span><input className="mt-3 w-full accent-primary" type="range" min="0.8" max="1.2" step="0.01" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Width" value={seatingWidth(seats) * scale} unit={unit} /><Metric label="Height" value={BASE_SIZE.height * scale} unit={unit} /><Metric label="Depth" value={BASE_SIZE.depth * scale} unit={unit} /></div>
          </section>
        </div>
      </aside>
      <div className="pointer-events-none absolute bottom-20 left-3 hidden items-center gap-2 rounded-md bg-surface/85 px-3 py-2 text-[10px] font-medium text-muted-foreground shadow-sm lg:flex"><Maximize2 className="size-3" /> Drag to orbit · right-drag to pan</div>
    </main>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: Unit }) {
  const factor = unit === "cm" ? 100 : unit === "mm" ? 1000 : 39.3701;
  return <div className="rounded-md bg-muted px-2 py-3"><div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs font-semibold">{Math.round(value * factor)} {unit}</div></div>;
}

useGLTF.preload(sofaAsset.url);