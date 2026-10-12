import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import QRCode from "qrcode";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";
import ScanLine from "lucide-react/dist/esm/icons/scan-line";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Move from "lucide-react/dist/esm/icons/move";

import { cn } from "@/lib/utils";
import { BASE_SIZE, seatingWidth } from "@/lib/sofa-spec";
import { totalPrice, formatINR } from "@/lib/pricing";
import { materialRecipe } from "@/lib/material-recipes";
import { applyLook, resolveLook, LEG_BUMP, tileFor } from "@/lib/material-looks";
import {
  createSurfaceMaps,
  isFloorSurfaceTransform,
  projectSurface,
  splitSofaGeometry,
} from "@/lib/ar-surface";
import { DEFAULT_TILE_CM, tileDensity } from "@/lib/texture-repeat";

// ─── types ────────────────────────────────────────────────────────────────────

export type FabricId =
  | "oat"
  | "wisdom"
  | "clay"
  | "ink"
  | "moss"
  | "swatch-urban"
  | "red-fish"
  | "orange-pattern"
  | "cognac-leather"
  | "charcoal-leather"
  | "olive-leather"
  | "chesterfield-oxblood"
  | "chesterfield-saddle";

export type LegId = "oak" | "walnut" | "ebonized" | "steel";

type FabricPreset = {
  id: FabricId;
  name: string;
  color: string;
  weave: string;
  printed?: boolean;
  photo?: string;
};

// ─── data ─────────────────────────────────────────────────────────────────────

export const AR_FABRICS: FabricPreset[] = [
  { id: "oat", name: "Oat Bouclé", color: "#b8aa91", weave: "boucle" },
  {
    id: "wisdom",
    name: "Wisdom",
    color: "#c8bfaa",
    weave: "linen",
    printed: true,
    photo: "/wisdom.png",
  },
  { id: "clay", name: "Clay Twill", color: "#a66f5b", weave: "twill" },
  { id: "moss", name: "Forest Chenille", color: "#46564b", weave: "loop" },
  { id: "ink", name: "Ink Velvet", color: "#34383b", weave: "velvet" },
  { id: "swatch-urban", name: "Swatch Urban", color: "#8a8680", weave: "tweed", printed: true },
  { id: "red-fish", name: "Red Fish", color: "#b44646", weave: "linen", printed: true },
  { id: "orange-pattern", name: "Orange Pattern", color: "#d28c50", weave: "twill", printed: true },
  { id: "cognac-leather", name: "Cognac Leather", color: "#8b5e3c", weave: "leather" },
  { id: "charcoal-leather", name: "Charcoal Leather", color: "#3a3a3a", weave: "leather" },
  { id: "olive-leather", name: "Olive Leather", color: "#5a6645", weave: "leather" },
  { id: "chesterfield-oxblood", name: "Oxblood Chester.", color: "#5c1f1f", weave: "leather" },
  { id: "chesterfield-saddle", name: "Saddle Chester.", color: "#7a4f2e", weave: "leather" },
];

export const AR_LEGS = [
  { id: "oak" as LegId, name: "Natural oak", color: "#9b7147", metalness: 0, roughness: 0.54 },
  { id: "walnut" as LegId, name: "Dark walnut", color: "#4f3225", metalness: 0, roughness: 0.48 },
  {
    id: "ebonized" as LegId,
    name: "Ebonized wood",
    color: "#20211f",
    metalness: 0,
    roughness: 0.42,
  },
  {
    id: "steel" as LegId,
    name: "Brushed steel",
    color: "#898b87",
    metalness: 0.82,
    roughness: 0.3,
  },
];

// ─── URL helpers ──────────────────────────────────────────────────────────────

export function isARLaunch(): boolean {
  return new URLSearchParams(window.location.search).get("ar") === "1";
}

export function buildARUrl(fabricId?: FabricId, legId?: LegId): string {
  const { protocol, hostname, port, pathname } = window.location;
  const secureProtocol =
    protocol === "http:" && !hostname.includes("localhost") && !hostname.startsWith("127.")
      ? "https:"
      : protocol;
  const params = new URLSearchParams({ ar: "1" });
  if (fabricId) params.set("fabric", fabricId);
  if (legId) params.set("leg", legId);
  return `${secureProtocol}//${hostname}${port ? `:${port}` : ""}${pathname}?${params.toString()}`;
}

function isMobileAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

// ─── material helpers ─────────────────────────────────────────────────────────

function buildMaterials(fabricId: FabricId, legId: LegId) {
  const fabric = AR_FABRICS.find((f) => f.id === fabricId) ?? AR_FABRICS[0]!;
  const leg = AR_LEGS.find((l) => l.id === legId) ?? AR_LEGS[0]!;
  const leather = fabric.weave === "leather";
  const tufted = fabric.id.startsWith("chesterfield-");
  const family = leather ? "leather" : fabric.weave === "velvet" ? "velvet" : "woven";
  const look = resolveLook(fabric.id, family, tufted);
  const fabricMaps = createSurfaceMaps(fabric.weave);
  const legMaps = createSurfaceMaps(legId === "steel" ? "steel" : "wood");
  const fabricColor = new THREE.Color(fabric.photo ? "#ffffff" : fabric.color || "#b8aa91");
  const photoMap = fabric.photo
    ? new THREE.TextureLoader().load(fabric.photo, undefined, undefined, (error) =>
        console.error(`AR fabric texture failed to load (${fabric.photo}):`, error),
      )
    : null;
  if (photoMap) {
    photoMap.colorSpace = THREE.SRGBColorSpace;
    photoMap.wrapS = photoMap.wrapT = THREE.RepeatWrapping;
    photoMap.magFilter = THREE.LinearFilter;
    photoMap.minFilter = THREE.LinearMipmapLinearFilter;
    photoMap.generateMipmaps = true;
  }
  const upholstery = new THREE.MeshPhysicalMaterial({
    color: fabricColor,
    ...fabricMaps,
    ...(photoMap ? { map: photoMap } : {}),
  });
  applyLook(upholstery, look, fabricColor, Boolean(fabric.photo));
  projectSurface(upholstery, tileDensity(tileFor(fabric.id, DEFAULT_TILE_CM)), tufted);
  const feet = new THREE.MeshPhysicalMaterial({
    color: leg.color,
    ...legMaps,
    bumpScale: legId === "steel" ? LEG_BUMP.steel : LEG_BUMP.wood,
    ...materialRecipe(legId === "steel" ? "steel" : "wood"),
  });
  projectSurface(feet, legId === "steel" ? 3 : 1.6);
  return {
    upholstery,
    feet,
    dispose() {
      Object.values(fabricMaps).forEach((t) => t.dispose());
      Object.values(legMaps).forEach((t) => t.dispose());
      photoMap?.dispose();
      upholstery.dispose();
      feet.dispose();
    },
  };
}

function applyMaterials(
  scene: THREE.Group,
  u: THREE.MeshPhysicalMaterial,
  f: THREE.MeshPhysicalMaterial,
) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.geometry.userData["arMaterialGroups"]) {
      const source = obj.geometry;
      obj.geometry = splitSofaGeometry(source);
      source.dispose();
    }
    obj.material = [u, f];
    obj.castShadow = obj.receiveShadow = true;
  });
}

function scaleSofa(scene: THREE.Group, sourceBounds: THREE.Box3, userScale = 1) {
  const size = sourceBounds.getSize(new THREE.Vector3());
  const sx = (seatingWidth(2) / size.x) * userScale;
  const sy = (BASE_SIZE.height / size.y) * userScale;
  const sz = (BASE_SIZE.depth / size.z) * userScale;
  scene.scale.set(sx, sy, sz);
}

// ─── QR modal ─────────────────────────────────────────────────────────────────

function QRModal({
  onClose,
  fabric = "oat",
  leg = "oak",
}: {
  onClose: () => void;
  fabric?: FabricId;
  leg?: LegId;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = buildARUrl(fabric, leg);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-base font-semibold text-foreground">
              View in your room
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Scan with your Android phone</p>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="mt-5 flex justify-center rounded-xl border border-border bg-white p-4">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-muted/50 px-3 py-3">
          <p className="text-[11px] font-semibold text-foreground">How it works</p>
          <p className="text-[11px] text-muted-foreground">1. Scan QR with Android phone camera</p>
          <p className="text-[11px] text-muted-foreground">2. Open link in Google Chrome</p>
          <p className="text-[11px] text-muted-foreground">
            3. Tap "Start AR" → point at floor → tap to place
          </p>
          <p className="text-[11px] text-muted-foreground">
            4. Switch fabrics &amp; legs live in AR
          </p>
        </div>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Phone &amp; laptop must be on the same Wi-Fi · open in Chrome
        </p>
      </div>
    </div>
  );
}

// ─── AR overlay UI (DOM overlay rendered on top of camera) ────────────────────

interface AROverlayProps {
  session: XRSession;
  onEnd: () => void;
  initialFabric?: FabricId;
  initialLeg?: LegId;
}

function AROverlay({ session, onEnd, initialFabric = "oat", initialLeg = "oak" }: AROverlayProps) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);   // pivot: placed at floor hit, sofa Y-offset inside
  const sofaRef = useRef<THREE.Group | null>(null);
  const sourceBoundsRef = useRef<THREE.Box3 | null>(null);
  const hitSrcRef = useRef<XRHitTestSource | null>(null);
  const latestHitRef = useRef<XRHitTestResult | null>(null);
  const anchorRef = useRef<XRAnchor | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const floorShadowRef = useRef<THREE.Mesh | null>(null);
  const placedRef = useRef(false);
  const placementRef = useRef<THREE.Vector3 | null>(null);
  const matRef = useRef<ReturnType<typeof buildMaterials> | null>(null);
  const startedRef = useRef(false);
  const userScaleRef = useRef(1);
  const touchGestureRef = useRef<
    | { type: "drag"; x: number; y: number }
    | { type: "transform"; x: number; y: number; distance: number; angle: number }
    | null
  >(null);
  const floorYRef = useRef<number | null>(null);
  const manualOffsetRef = useRef(new THREE.Vector3());
  const rotationRef = useRef(0);
  const elevationRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  const [fabric, setFabric] = useState<FabricId>(initialFabric);
  const [leg, setLeg] = useState<LegId>(initialLeg);
  const [placed, setPlaced] = useState(false);
  const [userScale, setUserScale] = useState(1);
  const [elevation, setElevation] = useState(0); // elevation in meters relative to floor
  const [fabricOpen, setFabricOpen] = useState(false);
  const [legOpen, setLegOpen] = useState(false);

  const selectedFabric = AR_FABRICS.find((f) => f.id === fabric) ?? AR_FABRICS[0]!;
  const selectedLeg = AR_LEGS.find((l) => l.id === leg) ?? AR_LEGS[0]!;
  const price = formatINR(totalPrice(2, selectedFabric, selectedLeg.id));

  // live material swap
  useEffect(() => {
    if (!sofaRef.current) return;
    const mats = buildMaterials(fabric, leg);
    matRef.current?.dispose();
    matRef.current = mats;
    applyMaterials(sofaRef.current, mats.upholstery, mats.feet);
  }, [fabric, leg]);

  const adjustElevation = useCallback((deltaM: number) => {
    setElevation((prev) => {
      const next = THREE.MathUtils.clamp(prev + deltaM, -0.4, 0.6);
      elevationRef.current = next;
      // Directly update pivot Y — no bounds-based math needed
      if (pivotRef.current) {
        pivotRef.current.position.y = (floorYRef.current ?? 0) + next;
      }
      return next;
    });
  }, []);

  const resetElevation = useCallback(() => {
    setElevation(0);
    elevationRef.current = 0;
    if (pivotRef.current) {
      pivotRef.current.position.y = floorYRef.current ?? 0;
    }
  }, []);

  const resetScale = useCallback(() => {
    setUserScale(1);
    userScaleRef.current = 1;
    if (sofaRef.current && sourceBoundsRef.current) {
      // Rescale sofa inside the pivot; re-normalise local Y so legs stay at Y=0
      scaleSofa(sofaRef.current, sourceBoundsRef.current, 1);
      sofaRef.current.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(sofaRef.current);
      sofaRef.current.position.y -= b.min.y;
      if (floorShadowRef.current) {
        floorShadowRef.current.scale.set(1, 1, 1);
      }
    }
  }, []);

  const startReposition = useCallback(() => {
    setPlaced(false);
    placedRef.current = false;
    anchorRef.current?.delete();
    anchorRef.current = null;
    if (pivotRef.current) pivotRef.current.visible = false;
    if (floorShadowRef.current) floorShadowRef.current.visible = false;
  }, []);

  const rotateSofa = useCallback((amount: number) => {
    if (!pivotRef.current) return;
    rotationRef.current += amount;
    // Rotate the pivot — sofa stays inside, legs stay on floor
    pivotRef.current.rotation.y = rotationRef.current;
  }, []);

  const moveSofaOnFloor = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const pivot = pivotRef.current;
    const xrCamera = rendererRef.current?.xr.getCamera();
    const camera = xrCamera?.cameras[0] ?? xrCamera;
    if (!pivot || !camera || !placementRef.current) return;
    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const floorY = floorYRef.current ?? placementRef.current.y;
    const projectToFloor = (x: number, y: number) => {
      const ndc = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const directionY = raycaster.ray.direction.y;
      if (Math.abs(directionY) < 0.0001) return null;
      const distance = (floorY - raycaster.ray.origin.y) / directionY;
      if (distance <= 0) return null;
      return raycaster.ray.at(distance, new THREE.Vector3());
    };
    const previousPoint = projectToFloor(fromX, fromY);
    const currentPoint = projectToFloor(toX, toY);
    if (!previousPoint || !currentPoint) return;
    const delta = currentPoint.sub(previousPoint);
    delta.y = 0;
    // Accumulate into manualOffset only — pivot.position is set from this each render frame
    manualOffsetRef.current.add(delta);
    placementRef.current.add(delta);
    if (floorShadowRef.current) {
      floorShadowRef.current.position.set(
        placementRef.current.x,
        floorY - 0.002,
        placementRef.current.z,
      );
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-ar-ui]")) return;
    if (e.touches.length === 2) {
      const first = e.touches[0]!;
      const second = e.touches[1]!;
      touchGestureRef.current = {
        type: "transform",
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
        distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
        angle: Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX),
      };
    } else if (e.touches.length === 1 && placedRef.current) {
      touchGestureRef.current = {
        type: "drag",
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
      };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-ar-ui]")) return;
      e.preventDefault();

      if (e.touches.length === 2 && placedRef.current && sofaRef.current) {
        const first = e.touches[0]!;
        const second = e.touches[1]!;
        const x = (first.clientX + second.clientX) / 2;
        const y = (first.clientY + second.clientY) / 2;
        const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
        const angle = Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX);
        const previous = touchGestureRef.current;
        if (previous?.type !== "transform") {
          touchGestureRef.current = { type: "transform", x, y, distance, angle };
          return;
        }

        // Two-finger vertical swipe → Adjust elevation (Y axis via pivot.position.y)
        const deltaY = y - previous.y;
        if (Math.abs(deltaY) > 0.5) {
          const nextElevation = THREE.MathUtils.clamp(
            elevationRef.current - deltaY * 0.0015,
            -0.4,
            0.6,
          );
          elevationRef.current = nextElevation;
          if (pivotRef.current) {
            pivotRef.current.position.y = (floorYRef.current ?? 0) + nextElevation;
          }
          setElevation(nextElevation);
        }

        moveSofaOnFloor(previous.x, previous.y, x, y);

        const rotationDelta = Math.atan2(
          Math.sin(angle - previous.angle),
          Math.cos(angle - previous.angle),
        );
        rotateSofa(rotationDelta);

        if (previous.distance > 0 && sourceBoundsRef.current && sofaRef.current) {
          const newScale = THREE.MathUtils.clamp(
            userScaleRef.current * (distance / previous.distance),
            0.3,
            3,
          );
          userScaleRef.current = newScale;
          scaleSofa(sofaRef.current, sourceBoundsRef.current, newScale);
          // Re-normalise: keep legs at local Y=0 inside pivot after scale change
          sofaRef.current.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(sofaRef.current);
          sofaRef.current.position.y -= b.min.y;
          setUserScale(newScale);
          if (floorShadowRef.current) {
            floorShadowRef.current.scale.set(newScale, newScale, newScale);
          }
        }
        touchGestureRef.current = { type: "transform", x, y, distance, angle };
      } else if (e.touches.length === 1 && placedRef.current) {
        const touch = e.touches[0]!;
        const previous = touchGestureRef.current;
        if (previous?.type !== "drag") {
          touchGestureRef.current = { type: "drag", x: touch.clientX, y: touch.clientY };
          return;
        }
        moveSofaOnFloor(previous.x, previous.y, touch.clientX, touch.clientY);
        touchGestureRef.current = { type: "drag", x: touch.clientX, y: touch.clientY };
      }
    },
    [moveSofaOnFloor, rotateSofa],
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-ar-ui]")) return;
    if (e.touches.length === 1) {
      touchGestureRef.current = {
        type: "drag",
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
      };
    } else {
      touchGestureRef.current = null;
    }
  }, []);

  // setup renderer + scene
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Canvas must live on body, NOT inside the DOM-overlay div.
    // WebXR composites the canvas independently; putting it inside the overlay
    // div causes the browser to hide it behind the camera feed.
    renderer.domElement.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;";
    document.body.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();

    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-2, 4, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.001;
    threeScene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(3, 2, -2);
    threeScene.add(fill);

    const floorShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.24 }),
    );
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.receiveShadow = true;
    floorShadow.visible = false;
    floorShadow.renderOrder = 1;
    floorShadowRef.current = floorShadow;
    threeScene.add(floorShadow);

    // reticle
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.12, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    threeScene.add(reticle);
    reticleRef.current = reticle;

    // ── Pivot pattern (ARCore / SceneViewer industry standard) ────────────────
    // A pivot Group sits exactly at the detected floor plane (Y = floor.y).
    // The sofa is added INSIDE the pivot with its feet at local Y = 0.
    // In the render loop we only ever touch pivot.position – the sofa stays put.
    const pivot = new THREE.Group();
    pivot.visible = false;
    threeScene.add(pivot);
    pivotRef.current = pivot;

    // load sofa
    new GLTFLoader().load("/Panache-OPAA-optimized.glb", (gltf) => {
      const sofa = gltf.scene;
      sofaRef.current = sofa;

      // 1. Measure raw bounds before any scaling
      const rawBounds = new THREE.Box3().setFromObject(sofa);
      sourceBoundsRef.current = rawBounds;

      // 2. Scale to target real-world dimensions
      scaleSofa(sofa, rawBounds, 1);

      // 3. Normalise: shift sofa inside pivot so its lowest vertex is at local Y=0
      //    (this is what ARCore SceneViewer does automatically)
      sofa.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(sofa);
      sofa.position.y -= scaledBounds.min.y;   // legs now sit at Y = 0 in pivot space

      pivot.add(sofa);

      const mats = buildMaterials("oat", "oak");
      matRef.current = mats;
      applyMaterials(sofa, mats.upholstery, mats.feet);
    });

    async function startXR() {
      // The reference space must be selected before entering the XR session.
      renderer.xr.setReferenceSpaceType("local-floor");
      await renderer.xr.setSession(session as never);

      const viewerSpace = await (
        session as never as {
          requestReferenceSpace(t: string): Promise<XRReferenceSpace>;
        }
      ).requestReferenceSpace("viewer");

      const hitSrc = await session.requestHitTestSource!({ space: viewerSpace as XRSpace });
      hitSrcRef.current = hitSrc ?? null;

      // renderer.setAnimationLoop is the ONLY correct way to drive a Three.js XR loop.
      // It hooks into the XR session's rAF and ensures the XR camera matrices are
      // updated before each render call.
      renderer.setAnimationLoop((_time, frame) => {
        if (!frame) return;
        // refSpace must be read inside the loop — it's only valid after setSession
        const refSpace = renderer.xr.getReferenceSpace();

        // ── Before placement: show reticle on upward floor surfaces only ──────
        if (hitSrcRef.current && reticleRef.current && !placedRef.current && refSpace) {
          const hits = (frame as XRFrame).getHitTestResults(hitSrcRef.current);
          const floorHit = hits
            .map((hit) => ({ hit, pose: hit.getPose(refSpace as XRSpace) }))
            .find(({ pose }) => pose && isFloorSurfaceTransform(pose.transform.matrix));
          if (floorHit?.pose) {
            latestHitRef.current = floorHit.hit;
            reticleRef.current.visible = true;
            reticleRef.current.matrix.fromArray(floorHit.pose.transform.matrix);
            reticleRef.current.matrixWorldNeedsUpdate = true;
          } else {
            latestHitRef.current = null;
            reticleRef.current.visible = false;
          }
        }

        // ── After placement: pivot.position = floor hit + manual offsets ──────
        // The pivot sits exactly at floor.y – the sofa's feet are at pivot local Y=0,
        // so the sofa is guaranteed on the floor with zero per-frame drift.
        if (placedRef.current && pivotRef.current) {
          const floorY = floorYRef.current ?? 0;
          const offset = manualOffsetRef.current;
          const px = (placementRef.current?.x ?? 0) + offset.x;
          const pz = (placementRef.current?.z ?? 0) + offset.z;
          const py = floorY + elevationRef.current;

          // Anchor: update XZ from anchor pose if available (drift correction)
          if (anchorRef.current && refSpace) {
            const pose = (frame as XRFrame).getPose(anchorRef.current.anchorSpace, refSpace);
            if (pose) {
              const ax = pose.transform.position.x + offset.x;
              const az = pose.transform.position.z + offset.z;
              pivotRef.current.position.set(ax, py, az);
              floorShadowRef.current?.position.set(ax, floorY - 0.002, az);
            } else {
              pivotRef.current.position.set(px, py, pz);
              floorShadowRef.current?.position.set(px, floorY - 0.002, pz);
            }
          } else {
            pivotRef.current.position.set(px, py, pz);
            floorShadowRef.current?.position.set(px, floorY - 0.002, pz);
          }
        }

        renderer.render(threeScene, renderer.xr.getCamera());
      });

      session.addEventListener("end", () => {
        hitSrc?.cancel();
        placedRef.current = false;
        anchorRef.current?.delete();
        anchorRef.current = null;
        renderer.setAnimationLoop(null);
        matRef.current?.dispose();
        floorShadow.geometry.dispose();
        floorShadow.material.dispose();
        renderer.domElement.remove();
        renderer.dispose();
        onEnd();
      });
    }

    void startXR();

    return () => {
      placedRef.current = false;
      anchorRef.current?.delete();
      anchorRef.current = null;
      hitSrcRef.current?.cancel();
      renderer.setAnimationLoop(null);
      matRef.current?.dispose();
      floorShadow.geometry.dispose();
      floorShadow.material.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback((e: React.MouseEvent) => {
    // ignore taps on the UI panel
    if ((e.target as HTMLElement).closest("[data-ar-ui]")) return;

    if (placedRef.current) {
      const now = performance.now();
      if (now - lastTapTimeRef.current < 320) {
        // Double-tap detected: snap elevation to floor and scale to 100%
        resetElevation();
        resetScale();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;
      return;
    }

    if (!reticleRef.current?.visible || !pivotRef.current || !sofaRef.current) return;

    // Extract the hit position from the reticle matrix
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    reticleRef.current.matrix.decompose(pos, quat, scl);

    // Store the detected floor Y — this is the authoritative floor height
    floorYRef.current = pos.y;
    // Reset any manual XZ drift
    manualOffsetRef.current.set(0, 0, 0);
    // placementRef holds the XZ anchor position (Y comes from floorYRef each frame)
    placementRef.current = new THREE.Vector3(pos.x, pos.y, pos.z);

    // Place the pivot at the exact hit position: legs land flush on the real floor
    pivotRef.current.position.set(pos.x, pos.y + elevationRef.current, pos.z);

    // Face the sofa toward the user (rotate pivot, not the sofa itself)
    const camera = rendererRef.current?.xr.getCamera();
    if (camera) {
      const gaze = camera.getWorldDirection(new THREE.Vector3());
      let facingX = -gaze.x;
      let facingZ = -gaze.z;
      if (Math.hypot(facingX, facingZ) <= 0.001) {
        const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
        facingX = cameraPosition.x - pos.x;
        facingZ = cameraPosition.z - pos.z;
      }
      if (Math.hypot(facingX, facingZ) > 0.001) {
        pivotRef.current.rotation.y = Math.atan2(facingX, facingZ);
      }
    }
    rotationRef.current = pivotRef.current.rotation.y;

    const hit = latestHitRef.current;
    if (hit?.createAnchor) {
      void hit
        .createAnchor()
        .then((anchor) => {
          if (!placedRef.current) {
            anchor.delete();
            return;
          }
          anchorRef.current?.delete();
          anchorRef.current = anchor;
        })
        .catch((error: unknown) => {
          console.warn("Could not anchor AR sofa to detected surface:", error);
        });
    }
    latestHitRef.current = null;
    if (floorShadowRef.current) {
      floorShadowRef.current.position.set(pos.x, pos.y - 0.002, pos.z);
      floorShadowRef.current.scale.set(userScaleRef.current, userScaleRef.current, userScaleRef.current);
      floorShadowRef.current.visible = true;
    }
    pivotRef.current.visible = true;
    reticleRef.current.visible = false;
    placedRef.current = true;
    setPlaced(true);
  }, [resetElevation, resetScale]);

  const exitAR = useCallback(() => {
    void session.end().catch(() => {});
  }, [session]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 z-0"
        style={{ touchAction: "none" }}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />
      {/* top bar */}
      <div
        data-ar-ui
        className="pointer-events-auto absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/60 px-4 py-3 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">
            {placed ? "Panache · 2 seater" : "Point at floor · tap to place"}
          </span>
          {placed && (
            <button
              onClick={startReposition}
              className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 active:bg-white/20"
              title="Move sofa with camera"
            >
              <Move className="size-3 text-white/70" />
              <span>Move with Camera</span>
            </button>
          )}
        </div>
        <button
          onClick={exitAR}
          className="flex size-8 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
          title="Exit AR"
        >
          <X className="size-4 text-white" />
        </button>
      </div>

      {placed && (
        <div
          data-ar-ui
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 space-y-2.5 bg-black/75 px-4 pb-7 pt-3 backdrop-blur-md"
        >
          {/* live price & dimensions */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                Total (2-Seater)
              </span>
              <div className="font-display text-lg font-semibold text-white">{price}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-white/50">Dimensions</span>
              <div className="font-mono text-xs text-white/80">
                {(seatingWidth(2) * userScale * 100).toFixed(0)} ×{" "}
                {(BASE_SIZE.depth * userScale * 100).toFixed(0)} ×{" "}
                {(BASE_SIZE.height * userScale * 100).toFixed(0)} cm
              </div>
            </div>
          </div>

          {/* Touch Gesture Guide */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70">
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">1-finger:</span>
              <span>Move on floor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">2-finger swipe:</span>
              <span>Height</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Pinch/Twist:</span>
              <span>Scale & Turn</span>
            </div>
          </div>

          {/* Fabric & Leg Selectors */}
          <div className="grid grid-cols-2 gap-2">
            {/* Fabric */}
            <div className="relative" style={{ touchAction: "pan-y" }}>
              <button
                className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setFabricOpen((v) => !v);
                  setLegOpen(false);
                }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-3.5 shrink-0 rounded-sm border border-white/30"
                    style={{ background: selectedFabric.color || "#b8aa91" }}
                  />
                  <span className="truncate text-xs font-medium text-white">{selectedFabric.name}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3 shrink-0 text-white/60 transition-transform",
                    fabricOpen && "rotate-180",
                  )}
                />
              </button>
              {fabricOpen && (
                <div className="absolute bottom-full mb-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/20 bg-black/95 shadow-xl">
                  {AR_FABRICS.map((f) => (
                    <button
                      key={f.id}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left active:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFabric(f.id);
                        setFabricOpen(false);
                      }}
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm border border-white/20"
                        style={{ background: f.color || "#b8aa91" }}
                      />
                      <span className="flex-1 truncate text-xs text-white">{f.name}</span>
                      {fabric === f.id && <Check className="size-3 text-white/50" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Leg finish */}
            <div className="relative" style={{ touchAction: "pan-y" }}>
              <button
                className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setLegOpen((v) => !v);
                  setFabricOpen(false);
                }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-3.5 shrink-0 rounded-sm border border-white/30"
                    style={{ background: selectedLeg.color }}
                  />
                  <span className="truncate text-xs font-medium text-white">{selectedLeg.name}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3 shrink-0 text-white/60 transition-transform",
                    legOpen && "rotate-180",
                  )}
                />
              </button>
              {legOpen && (
                <div className="absolute bottom-full mb-1 w-full overflow-hidden rounded-lg border border-white/20 bg-black/95 shadow-xl">
                  {AR_LEGS.map((l) => (
                    <button
                      key={l.id}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left active:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLeg(l.id);
                        setLegOpen(false);
                      }}
                    >
                      <span
                        className="size-3 shrink-0 rounded-sm border border-white/20"
                        style={{ background: l.color }}
                      />
                      <span className="flex-1 truncate text-xs text-white">{l.name}</span>
                      {leg === l.id && <Check className="size-3 text-white/50" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] text-white/45">
            1 finger: drag across floor · 2 fingers: pinch scale &amp; twist turn
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AR launch screen (phone opens ?ar=1) ─────────────────────────────────────

export function ARLaunchScreen() {
  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialFabric = (searchParams?.get("fabric") as FabricId) || "oat";
  const initialLeg = (searchParams?.get("leg") as LegId) || "oak";

  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [session, setSession] = useState<XRSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<string[]>([]);

  useEffect(() => {
    const lines: string[] = [];
    lines.push(`UA: ${navigator.userAgent.slice(0, 120)}`);
    lines.push(`navigator.xr: ${String(navigator.xr)}`);
    lines.push(`isSecureContext: ${String(window.isSecureContext)}`);
    lines.push(`protocol: ${window.location.protocol}`);

    if (!navigator.xr) {
      lines.push("FAIL: navigator.xr is undefined");
      setDiag(lines);
      setArSupported(false);
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((ok) => {
        lines.push(`isSessionSupported(immersive-ar): ${String(ok)}`);
        setDiag(lines);
        setArSupported(ok);
      })
      .catch((e: unknown) => {
        lines.push(`isSessionSupported threw: ${String(e)}`);
        setDiag(lines);
        setArSupported(false);
      });
  }, []);

  // Session started directly from button click — no useEffect, no StrictMode issue
  const startAR = useCallback(async () => {
    try {
      const s = await navigator.xr!.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "local-floor"],
        optionalFeatures: ["dom-overlay", "anchors"],
        domOverlay: { root: document.body },
      });
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleEnd = useCallback(() => {
    setSession(null);
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  }, []);

  // Once session is live, render the overlay on top of the camera feed
  if (session) {
    return (
      <AROverlay
        session={session}
        onEnd={handleEnd}
        initialFabric={initialFabric}
        initialLeg={initialLeg}
      />
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#111] px-6">
      <div className="mb-8 text-center">
        <p className="font-display text-2xl font-semibold text-white">Panache</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
          AR Configurator
        </p>
      </div>

      {arSupported === null && <p className="text-sm text-white/50">Checking AR support…</p>}

      {diag.length > 0 && (
        <div className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left">
          {diag.map((line, i) => (
            <p key={i} className="break-all font-mono text-[9px] leading-5 text-white/40">
              {line}
            </p>
          ))}
        </div>
      )}

      {arSupported === false && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-sm font-semibold text-white">AR not available</p>
          {!window.isSecureContext && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-amber-400">
                Camera access requires a secure connection (HTTPS).
              </p>
              <a
                href={`https://${window.location.host}${window.location.pathname}${window.location.search}`}
                className="inline-block rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black active:bg-white/80"
              >
                Open over HTTPS
              </a>
              <p className="text-[10px] text-white/50">
                (If Chrome warns about certificate on local Wi-Fi, tap <em>Advanced &rarr; Proceed</em>)
              </p>
            </div>
          )}
          {window.isSecureContext && (
            <p className="mt-2 text-xs text-white/50">
              Make sure “Google Play Services for AR” is installed and updated from Play Store.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-xs font-semibold text-red-400">Failed to start AR</p>
          <p className="mt-1 break-all text-[10px] text-red-300/70">{error}</p>
        </div>
      )}

      {arSupported === true && !error && (
        <>
          <button
            onClick={() => {
              void startAR();
            }}
            className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-[#111]"
          >
            <Smartphone className="size-4" />
            Start AR
          </button>
          <p className="mt-4 text-center text-xs text-white/40">
            Tap to place · drag to move · pinch to resize · twist to rotate
          </p>
        </>
      )}
    </div>
  );
}

// ─── AR button (configurator header) ─────────────────────────────────────────

interface ARButtonProps {
  seats: number;
  fabric?: FabricId;
  leg?: LegId;
}

export function ARButton({ seats, fabric = "oat", leg = "oak" }: ARButtonProps) {
  const [showQR, setShowQR] = useState(false);
  const [session, setSession] = useState<XRSession | null>(null);
  const [arReady, setArReady] = useState(false);

  useEffect(() => {
    navigator.xr
      ?.isSessionSupported("immersive-ar")
      .then(setArReady)
      .catch(() => {});
  }, []);

  if (seats !== 2) return null;

  const handleClick = async () => {
    if (isMobileAndroid() && arReady) {
      try {
        const s = await navigator.xr!.requestSession("immersive-ar", {
          requiredFeatures: ["hit-test", "local-floor"],
          optionalFeatures: ["dom-overlay", "anchors"],
          domOverlay: { root: document.body },
        });
        setSession(s);
      } catch (e) {
        console.error("AR start failed:", e);
      }
      return;
    }
    setShowQR(true);
  };

  return (
    <>
      <button
        onClick={() => {
          void handleClick();
        }}
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        {isMobileAndroid() && arReady ? (
          <Smartphone className="size-3.5" />
        ) : (
          <ScanLine className="size-3.5" />
        )}
        View in AR
      </button>

      {showQR && <QRModal onClose={() => setShowQR(false)} fabric={fabric} leg={leg} />}

      {session && (
        <AROverlay
          session={session}
          onEnd={() => setSession(null)}
          initialFabric={fabric}
          initialLeg={leg}
        />
      )}
    </>
  );
}
