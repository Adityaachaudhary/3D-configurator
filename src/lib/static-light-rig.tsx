// Hardcoded studio lighting. No leva, no sliders. Edit the numbers in LIGHTING
// (material-looks.ts). Put <LightRig /> in the Canvas where the old ambientLight /
// directionalLight / <Environment> block was.
//
// Also in the Canvas gl props use:
//   toneMapping: THREE.NeutralToneMapping,
//   toneMappingExposure: LIGHTING.exposure,

import { Environment } from "@react-three/drei/core/Environment";
import { Lightformer } from "@react-three/drei/core/Lightformer";

import { LIGHTING as L } from "./material-looks";

const TARGET: [number, number, number] = [0, 0.4, 0];

export function LightRig() {
  return (
    <>
      <ambientLight intensity={L.ambient} />
      <directionalLight position={L.directional.position} intensity={L.directional.intensity} />
      <Environment resolution={256} environmentIntensity={L.environmentIntensity}>
        <color attach="background" args={[L.envBase, L.envBase, L.envBase]} />
        <Lightformer form="rect" intensity={L.key.intensity} position={L.key.position} target={TARGET} scale={L.key.scale} />
        <Lightformer form="rect" intensity={L.fill.intensity} position={L.fill.position} target={TARGET} scale={L.fill.scale} />
        <Lightformer form="rect" intensity={L.rim.intensity} position={L.rim.position} target={TARGET} scale={L.rim.scale} />
      </Environment>
    </>
  );
}
