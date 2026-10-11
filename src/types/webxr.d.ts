// Minimal WebXR + DOM Overlay type augmentations not yet in lib.dom.d.ts

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  domOverlay?: { root: Element };
}

interface XRSession {
  requestHitTestSource(options: { space: XRSpace }): Promise<XRHitTestSource>;
  requestAnimationFrame(callback: XRFrameRequestCallback): number;
  end(): Promise<void>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface XRHitTestSource {
  cancel(): void;
}

interface XRHitTestResult {
  getPose(baseSpace: XRSpace): XRPose | null;
  createAnchor?(): Promise<XRAnchor>;
}

interface XRAnchor {
  anchorSpace: XRSpace;
  delete(): void;
}

interface XRFrame {
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
  getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
  getPose(space: XRSpace, baseSpace: XRSpace): XRPose | null;
}

interface XRViewerPose {
  views: XRView[];
}

interface XRView {
  eye: "left" | "right" | "none";
  projectionMatrix: Float32Array;
  transform: XRRigidTransform;
}

interface XRRigidTransform {
  matrix: Float32Array;
  position: DOMPointReadOnly;
  orientation: DOMPointReadOnly;
}

interface XRPose {
  transform: XRRigidTransform;
}

type XRSpace = object;
type XRReferenceSpace = XRSpace;

type XRFrameRequestCallback = (time: number, frame: XRFrame) => void;

interface Navigator {
  xr?: {
    isSessionSupported(mode: string): Promise<boolean>;
    requestSession(mode: string, options?: XRSessionInit): Promise<XRSession>;
  };
}
