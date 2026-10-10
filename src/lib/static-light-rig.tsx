import { Environment, Lightformer } from "@react-three/drei";
import { createElement, Fragment } from "react";
import { LIGHTING } from "./material-looks";

// createElement keeps devtools JSX source tags off Three.js objects.
export function LightRig() {
  return createElement(Fragment, null,
    createElement("ambientLight", { intensity: LIGHTING.ambient }),
    createElement("directionalLight", LIGHTING.directional),
    createElement(Environment, { resolution: 256, environmentIntensity: LIGHTING.environmentIntensity, frames: 1 },
      createElement("color", { attach: "background", args: [LIGHTING.envBase, LIGHTING.envBase, LIGHTING.envBase] }),
      createElement(Lightformer, { form: "rect", ...LIGHTING.key, target: [0, 0.4, 0] }),
      createElement(Lightformer, { form: "rect", ...LIGHTING.fill, target: [0, 0.4, 0] }),
      createElement(Lightformer, { form: "rect", ...LIGHTING.rim, target: [0, 0.4, 0] }),
    ),
  );
}