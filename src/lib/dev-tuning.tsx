// Dev-only live tuning. Dependency: leva (installed).
//
// 1) <DevPanel /> is rendered once in SofaConfigurator, next to <Viewer/>.
// 2) Inside <Canvas>, the ambientLight / directionalLight / <Environment> block
//    is replaced by <LightRig />.
// 3) In SofaModel, after chairMaterials is defined, useLookTuner(...) wires the
//    per-fabric sliders to the live materials.
//
// Sliders edit the live materials without recompiling shaders. When a fabric
// looks right, press "copy JSON" and paste the result into OVERRIDES in
// material-looks.ts.

import { Environment, Lightformer } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Leva, button, useControls } from "leva";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

import { applyLook, type MaterialLook } from "./material-looks";

export function DevPanel() {
  return <Leva hidden={!import.meta.env.DEV} collapsed />;
}

export function useLookTuner(
  id: string,
  look: MaterialLook,
  whiteBase: boolean,
  targets: THREE.MeshPhysicalMaterial[],
) {
  const latest = useRef<MaterialLook>(look);
  const values = useControls(
    `Look · ${id}`,
    {
      roughness: { value: look.roughness, min: 0, max: 1, step: 0.01 },
      sheen: { value: look.sheen, min: 0, max: 1, step: 0.01 },
      sheenRoughness: { value: look.sheenRoughness, min: 0, max: 1, step: 0.01 },
      sheenTint: { value: look.sheenTint, min: 0, max: 1, step: 0.01 },
      sheenGrey: { value: look.sheenGrey, min: 0, max: 1, step: 0.01 },
      clearcoat: { value: look.clearcoat, min: 0, max: 1, step: 0.01 },
      clearcoatRoughness: { value: look.clearcoatRoughness, min: 0, max: 1, step: 0.01 },
      specularIntensity: { value: look.specularIntensity, min: 0, max: 1, step: 0.01 },
      bumpScale: { value: look.bumpScale, min: 0, max: 0.03, step: 0.00001 },
      "copy JSON": button(() => {
        void navigator.clipboard.writeText(JSON.stringify({ [id]: latest.current }, null, 2));
      }),
    },
    [id],
  );
  latest.current = values as unknown as MaterialLook;

  useEffect(() => {
    const base = targets[0]?.userData["baseColor"] as THREE.Color | undefined;
    if (!base) return;
    for (const material of targets) applyLook(material, latest.current, base, whiteBase);
  }, [values, targets, whiteBase]);
}

export function LightRig() {
  const gl = useThree((state) => state.gl);
  const t = useControls("Scene", {
    exposure: { value: 1, min: 0.4, max: 1.8, step: 0.01 },
    ambient: { value: 0.15, min: 0, max: 1, step: 0.01 },
    directional: { value: 0.6, min: 0, max: 2, step: 0.01 },
    environment: { value: 1, min: 0, max: 2, step: 0.01 },
    key: { value: 2.2, min: 0, max: 5, step: 0.1 },
    fill: { value: 1, min: 0, max: 5, step: 0.1 },
    rim: { value: 0.85, min: 0, max: 5, step: 0.1 },
  });
  useEffect(() => {
    gl.toneMappingExposure = t.exposure;
  }, [gl, t.exposure]);

  return (
    <>
      <ambientLight intensity={t.ambient} />
      <directionalLight position={[-3, 6, 4]} intensity={t.directional} />
      {/* frames=Infinity only while tuning so Lightformer sliders update the reflections. */}
      <Environment resolution={256} environmentIntensity={t.environment} frames={import.meta.env.DEV ? Infinity : 1}>
        <Lightformer form="rect" intensity={t.key} position={[-3, 5, 4]} target={[0, 0.4, 0]} scale={[7, 5, 1]} />
        <Lightformer form="rect" intensity={t.fill} position={[4, 2, 3]} target={[0, 0.4, 0]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={t.rim} position={[1, 4, -4]} target={[0, 0.4, 0]} scale={[5, 3, 1]} />
      </Environment>
    </>
  );
}
