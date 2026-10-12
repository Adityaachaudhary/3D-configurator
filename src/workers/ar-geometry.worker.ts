interface SplitRequest {
  positions: Float32Array;
  indices: Uint32Array;
}

import { splitARIndices } from "../lib/ar-geometry";

self.onmessage = (event: MessageEvent<SplitRequest>) => {
  try {
    const { indices, upholsteryIndexCount } = splitARIndices(
      event.data.positions,
      event.data.indices,
    );
    self.postMessage(
      { indices: indices.buffer, upholsteryIndexCount },
      [indices.buffer],
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
