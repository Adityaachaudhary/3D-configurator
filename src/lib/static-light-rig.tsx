import { Environment, Lightformer } from "@react-three/drei";
import { createElement, Fragment } from "react";
import { LIGHTING } from "./material-looks";

// createElement keeps devtools JSX source tags off Three.js objects.
export function LightRig() {
  return createElement(Fragment, null,
    createElement("ambientLight", { intensity: LIGHTING.ambient }),
    createElement("directionalLight", { position: [-3, 6, 4], intensity: LIGHTING.directional }),
    createElement(Environment, { resolution: 256, environmentIntensity: LIGHTING.environment, frames: 1 },
      createElement(Lightformer, { form: "rect", intensity: LIGHTING.key, position: [-3, 5, 4], target: [0, 0.4, 0], scale: [7, 5, 1] }),
      createElement(Lightformer, { form: "rect", intensity: LIGHTING.fill, position: [4, 2, 3], target: [0, 0.4, 0], scale: [6, 4, 1] }),
      createElement(Lightformer, { form: "rect", intensity: LIGHTING.rim, position: [1, 4, -4], target: [0, 0.4, 0], scale: [5, 3, 1] }),
    ),
  );
}