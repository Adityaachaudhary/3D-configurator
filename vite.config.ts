// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import basicSsl from "@vitejs/plugin-basic-ssl";

// TanStack devtools injects `data-tsd-source` on every JSX element. React Three Fiber treats
// dashed props as nested paths on three.js objects and throws when the value changes on HMR,
// so strip the attribute from the client-only 3D scene module and the static light rig.
const R3F_MODULE_MARKERS = ["SofaConfigurator", "static-light-rig"];
const stripR3FSourceTags = {
  name: "strip-r3f-tsd-source",
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!R3F_MODULE_MARKERS.some((marker) => id.includes(marker)) || !code.includes("data-tsd-source")) return null;
    return {
      code: code.replace(/["']data-tsd-source["']\s*:\s*["'][^"']*["']\s*,?/g, ""),
      map: null,
    };
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripR3FSourceTags, basicSsl()],
    server: { host: "0.0.0.0", port: 3000 },
  },
});
