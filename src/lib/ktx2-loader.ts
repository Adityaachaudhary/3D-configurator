import type { WebGLRenderer } from "three";
import type { GLTFLoader } from "three-stdlib";
import { DRACOLoader, KTX2Loader } from "three-stdlib";

let ktx2Loader: KTX2Loader | undefined;
let dracoLoader: DRACOLoader | undefined;

function getDRACOLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    dracoLoader.setWorkerLimit(2);
  }
  return dracoLoader;
}

export function preloadARAssets() {
  getDRACOLoader().preload();
  const modelLink = document.createElement("link");
  modelLink.rel = "preload";
  modelLink.as = "fetch";
  modelLink.crossOrigin = "anonymous";
  modelLink.href = `${import.meta.env.BASE_URL}Panache-OPAA-optimized.glb`;
  document.head.append(modelLink);
}

export function configureModelLoaders(loader: GLTFLoader, renderer: WebGLRenderer) {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
  }
  loader.setKTX2Loader(ktx2Loader.detectSupport(renderer));
  loader.setDRACOLoader(getDRACOLoader());
}
