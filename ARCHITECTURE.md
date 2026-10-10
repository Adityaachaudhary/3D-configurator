# Panache Sofa Configurator — Codebase Guide

A complete orientation for developers and AI tools. Read this first, then `AGENTS.md` (binding rules) and `roadmap.md` (task history).

---

## 1. What the app is

A full-screen, browser-based 3D configurator for one supplied sofa model (Panache OPAA). Users can:

- Switch between **1-, 2-, and 3-seater** versions (made from one 2-seater model, see §6).
- Pick **18 upholstery finishes**: 6 solids (one is the client's "Wisdom" photo fabric), 6 patterns, 4 leathers, 2 Chesterfield (button-tufted) leathers.
- Pick **4 leg finishes**: oak, walnut, ebonized, brushed steel.
- Set the texture tile size in **cm per tile** (5–25 cm).
- Scale the model (0.8–1.2×) and read the dimensions in **cm / mm / inches**.
- Use viewer tools: zoom buttons, wheel/pinch zoom, preset views (perspective/front/side/rear), reset, fit, fullscreen, screenshot, grid floor, dimension rulers, auto-rotate, studio lighting, wireframe.

Design rules: solid colours only, no gradients, no hover-triggered interactions.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, file-based routing), Vite 7 |
| Styling | Tailwind CSS v4 via `src/styles.css` (semantic tokens, no tailwind.config.js) |
| 3D engine | **three.js** (r18x): geometry, materials, textures, shader injection |
| React bridge | **@react-three/fiber v9** (`Canvas`, `useFrame`, `useThree`) |
| Helpers | **@react-three/drei v10** (`OrbitControls`, `Environment`, `Lightformer`, `ContactShadows`, `useGLTF`, `useTexture`, `useProgress`) |
| UI kit | shadcn/ui (Radix) in `src/components/ui`, icons from lucide-react |
| Tests | Vitest (`src/test/*`) |
| Offline tools | meshoptimizer (`scripts/optimize-sofa.mjs`) |

There is no backend or database. Everything runs in the browser.

---

## 3. File map

```text
src/
  routes/
    __root.tsx            HTML shell, fonts (Sora + Manrope), global <head>
    index.tsx             "/" route. Loads the configurator client-only (ssr: false) + page metadata
  components/
    SofaConfigurator.tsx  THE app: all 3D scene logic + the UI panel (~1300 lines)
    ui/                   shadcn primitives (button.tsx has a custom "selected" variant)
  lib/
    material-recipes.ts   Pure physical parameters per material family (tested)
    texture-repeat.ts     cm-per-tile -> tiles-per-meter conversion (tested)
    utils.ts              cn() class helper
  assets/
    Panache-OPAA.glb.asset.json        Pointer to the original model (CDN)
    Panache-OPAA-80pct.glb.asset.json  Pointer to the optimized model (used in app)
    sofa-optimization-report.json      Output of the optimizer script
    wisdom-fabric.png.asset.json       Pointer to the client fabric photo
  test/
    material-recipes.test.ts  Recipe ranges
    texture-repeat.test.ts    Tile conversion
    sofa-optimization.test.ts Triangle reduction + protected vertices
    app-routing.test.tsx      Route smoke test
  styles.css              Design tokens (colours, fabric/leg swatch colours, fonts, shadows)
scripts/
  optimize-sofa.mjs       Offline 20% triangle reduction
vite.config.ts            Adds the "strip-r3f-tsd-source" plugin (see §12)
AGENTS.md                 Architecture rules (must be followed)
roadmap.md                Task list / history
```

`*.asset.json` files are pointers: `{ url, ... }`. Large binaries live on a CDN, not in git.

---

## 4. Rendering pipeline (top to bottom)

```text
routes/index.tsx  (ssr:false — WebGL can't run on the server)
  └─ SofaConfigurator()          state + UI panel + toolbar
       └─ Viewer                 <Canvas> setup
            ├─ lights + Environment (Lightformers)
            ├─ floor plane + gridHelper (layer 1)
            ├─ SofaModel         geometry, materials, seating animation
            ├─ SofaContactShadows
            ├─ Dimensions        rulers + DimensionLabel
            ├─ CameraRig         view presets, button zoom, fit
            └─ OrbitControls     drag orbit, wheel/pinch zoom, pan
```

### Canvas / renderer settings (in `Viewer`)
- Tone mapping `ACESFilmicToneMapping`, `toneMappingExposure 0.95`, `outputColorSpace SRGB`.
- `preserveDrawingBuffer` so the screenshot button can read pixels.
- `scene.environmentIntensity` set via `<Environment environmentIntensity={1}>` (since three r163, per-material `envMapIntensity` no longer affects `scene.environment`).

### Lighting
- Soft studio: ambient 0.5, one directional light, plus an `Environment` (resolution 256) made of **three broad rectangular Lightformers** (key, fill, rim), all aimed at the sofa. No HDRI file. This gives soft, even highlights.
- "Studio" toggle switches background/presentation.

### Shadows
- `SofaContactShadows`: drei `ContactShadows` captured **once** (frames 1) after the size change settles (700 ms timer keyed on seats + scale). Re-captures when seating or scale changes.
- The floor and grid are on **camera layer 1**, the shadow camera only sees layer 0, so the floor is never baked into the shadow.

### Floor grid
- `gridHelper` renders after the floor (`renderOrder 1`), depth test on, depth write off → the floor can't hide the lines but the sofa still covers them.

### Camera
- `OrbitControls`: damping 0.08, polar limits, `zoomToCursor`, `minDistance 1.7`, `maxDistance 7`.
- `CameraRig` moves the camera smoothly to preset views (`VIEWS`), handles toolbar zoom (`zoomSignal`) with the same limits, and frames the sofa based on seat count and scale.

---

## 5. Loading the model and separating fabric from legs

The GLB contains **one mesh with one unnamed material**, so parts cannot be selected by name. `splitSofaGeometry(source)` separates them by position:

1. Welds vertices by rounded position (`toFixed(5)`) and builds connected pieces (union-find on the index buffer).
2. Detects the four leg axes from vertices low on the model (below y ≈ −0.37) in the four bottom quadrants.
3. Classifies each triangle: if its centre is below the base (y < ≈ −0.3085) and inside a tapered cone around a leg axis → **leg**; otherwise → **upholstery**.
4. Reorders the index buffer into **two material groups**: group 0 = upholstery, group 1 = legs.

The mesh is then rendered with a two-material array `[upholsteryMaterial, legMaterial]`. Changing fabric touches only material 0; changing legs only material 1.

Upholstery normals are smoothed across coincident vertices without moving geometry (removes leather facets); leg normals are left intact.

---

## 6. Seating variants (1 / 2 / 3 seater)

All built from the 2-seater source. Width of one module: `MODULE_WIDTH = 0.7` (source units).

- `sliceModule(geometry, minX, maxX)` — exact triangle clipping along X, interpolating position/normal/UV at the cut.
- `joinedModule(source)` — the centre insert for the 3-seater. Built from two **reflected crown halves** (`reflectedGeometry` mirrors X and fixes triangle winding) with the exact original centre profile at its ends, so the joins are closed. `softenMirrorPlane` smooths normals on the mirror plane.
- **1-seater** = left end cap + right end cap (chair halves, `chairHalf` + `chairOtherHalf`).
- **3-seater** = left cap + inserted middle module + right cap.
- Transitions: `useFrame` damps `animatedSeats` toward the target (disabled with reduced motion).

### Exact dimensions (size chart)
```ts
INCH_METERS = 0.0254
seatingWidth(seats) = (34 + (seats - 1) * 24) inches   // 34", 58", 82"
height = 32", depth = 33"
```
Each finished assembly is measured from its **real geometry bounds** and scaled to the chart, then the user scale is applied. The same chart feeds rulers, panel metrics and camera fitting, so the numbers always match the model.

`formatDimension(meters, unit)`: cm (×100, 1 decimal), mm (×1000, 0 decimals), in (÷0.0254, 1 decimal).

---

## 7. Fabrics and materials — how they get applied

### 7.1 Data
`FABRICS` (in `SofaConfigurator.tsx`) — each preset:
```ts
{ id, name, family, color, weave, pattern?, tufted?, photo? }
```
- `color` is read from CSS tokens (`--fabric-*` in `styles.css`).
- `weave`: linen / boucle / velvet / leather / etc. → selects the procedural surface maps.
- `pattern`: stripe | check | chevron | diamond.
- `tufted: true` → Chesterfield.
- `photo` → client photo fabric (Wisdom).

`LEGS` — id, name, colour, metalness, roughness.

### 7.2 Physical recipes (`src/lib/material-recipes.ts`)
`materialRecipe(family, tufted)` returns MeshPhysicalMaterial parameters:

| Family | Roughness | Extras |
|---|---|---|
| woven | 0.96 | sheen 0.65, sheenRoughness 0.5 |
| velvet | 0.92 | sheen 1, sheenRoughness 0.4 |
| leather | 0.58 | clearcoat 0.06 (tufted 0.04), clearcoatRoughness 0.35, specularIntensity 0.6 |
| wood | 0.56 | clearcoat 0.025 |
| steel | 0.3 | metalness 0.82 |

### 7.3 Building the materials (`SofaModel` → `materials` useMemo)
```text
upholstery = new MeshPhysicalMaterial({
  color, ...fabricTexture (map/bump/roughness),
  bumpScale (by type), ...materialRecipe(family, tufted),
  sheenColor = colour lightened 35% toward white
})
projectSurface(upholstery, density, scale, pattern, ..., tufted, undersideColor, photo)

legs = new MeshPhysicalMaterial({ color, ...legTexture, ...materialRecipe("wood"|"steel") })
```
`chairMaterials` are clones for the 1-seater chair halves. Wireframe is toggled in an effect by setting `material.wireframe` on these shared materials, so all modules switch together.

---

## 8. Texturing — which code does what

| Function | Purpose |
|---|---|
| `createSurfaceMaps(kind)` | Procedurally draws colour, bump (relief) and roughness canvases for each weave/leather/wood/steel. Seamless tiles. Byte values clamped before writing (overflow → black). |
| `createPatternCanvas(fabric)` | Draws the 1024px seamless multicolour pattern. Same artwork is used for the sidebar swatch and the 3D sofa. |
| `createPhotoSurfaceMaps(image)` | Wisdom photo: square crop, mirrored to be seamless, 1024px, plus mild bump/roughness derived from the photo. |
| `FabricSwatch` | Sidebar preview: canvas for procedural/pattern fabrics, `<img>` (original CDN photo) for Wisdom. |
| `tileDensity(cm)` (`texture-repeat.ts`) | cm per tile → tiles per meter (`100 / cm`, clamped 5–25 cm). Every fabric map uses the same density, so the label is the true repeat. |
| `projectSurface(...)` | **Core shader injection** (`material.onBeforeCompile`). See below. |
| `tuftProfileGLSL` | GLSL string: analytic Chesterfield diamond profile. |

### Texture settings (applied in an effect)
- Colour / pattern maps: `SRGBColorSpace`. Bump / roughness: `NoColorSpace` (data).
- `anisotropy = renderer max`, `generateMipmaps`, `minFilter LinearMipmapLinearFilter`, `magFilter LinearFilter`.

### `projectSurface` — why and how
The imported model's UVs are an atlas; when modules are cut and repeated, UV textures would stretch and restart at seams. So **textures are projected in physical (world/model) coordinates instead of UVs**:

1. **Triplanar projection**: samples the map on the XY, XZ and ZY planes and blends by surface normal. Overrides three.js chunks `map_fragment`, `roughnessmap_fragment`, `bumpmap_pars_fragment`.
2. **Density** = `tileDensity(cm)` × model scale, so a tile is a fixed real-world size on every seater.
3. **Patterns** are sampled the same way over `diffuseColor`.
4. **Photo fabric (Wisdom)**: each panel (seat / back / arm) gets its own phase offset and quarter-turn to hide repetition; coordinates are the joined assembly's, so module seams don't show.
5. **Base lining**: only the hidden underside (low source height + downward-facing world normal, smooth masks) turns into a plain dark lining. Visible cushion folds keep the fabric.
6. **Chesterfield** (when `tuft = true`): see §9.
7. Shader programs are cached by a key (`customProgramCacheKey`, e.g. `physical-surface-v18-panel-analytic-...`). Bump the version when changing shader code.

---

## 9. Chesterfield tufting

- Diamond pattern is **evaluated analytically in the fragment shader** (`tuftProfileGLSL`) — resolution-independent, no texture stair-stepping.
- Separate pattern coordinates per panel: seat uses XZ, back uses XY, arms use ZY, each with an offset so diamonds line up with that surface. `tuftPanelFrame` computes a smoothed per-vertex panel direction attribute.
- Relief is **normal perturbation** (shading) plus only a tiny inward vertex recess (`tuftDepth ≈ 0.0015 × scale`) along the welded tuft directions — large displacement made the silhouette wobble and cracked edges.
- Fades to plain leather on rolled edges, corners, welt and legs.
- Antialiased with `fwidth()` pixel footprints (no sparkle).
- Grain scale is independent of diamond size: the tile slider changes grain, not tufting.

---

## 10. UI (in `SofaConfigurator()`)

- **Header**: title, reset.
- **Left toolbar** (`ToolButton`): zoom in/out, fit, grid, measures, auto-rotate, studio light, wireframe, fullscreen, screenshot.
- **Bottom view presets**: perspective, front, side, rear.
- **Right panel** (320px; bottom sheet on small screens): seating size, upholstery (Solids / Patterns / Leather & Chesterfield), leg finish, tile slider ("cm / tile"), scale slider, unit toggle, `Metric` cards (W/H/D).
- `Dimensions` + `DimensionLabel`: ruler lines in 3D; labels are HTML spans projected to screen each frame (drei `<Html>` inside an animated group was unreliable).
- Loading progress from `useProgress`.
- All colours are tokens in `src/styles.css` (`--primary`, `--surface`, `--fabric-*`, `--leg-*`, `--scene-*`). No hardcoded colour utilities, no gradients, no hover effects.

---

## 11. Model optimization (offline)

`scripts/optimize-sofa.mjs`:
```bash
bun scripts/optimize-sofa.mjs input.glb output.glb report.json
```
- Removes 20% of triangles (173,612 → 138,888) with meshoptimizer, max error 1 mm.
- Locks legs/base, silhouette extremes, and every triangle crossing a module cut plane (`JOIN_PLANES`) so seating joins still match.
- Original model kept; the app loads the `-80pct` pointer. Checked by `sofa-optimization.test.ts`.

---

## 12. Gotchas

- **Client-only**: the configurator must never render on the server (`ssr: false`).
- **`data-tsd-source` crash**: TanStack devtools add this attribute to every JSX element in dev; R3F treats dashed props as nested paths and crashes. `vite.config.ts` strips it from `SofaConfigurator` files. Keep scene code in that file.
- Changing shader code → bump the program cache key in `projectSurface`.
- Don't rely on GLB material names — there is only one.
- Don't use mesh UVs for fabric — use physical projection.
- Keep fabric density identical across colour, bump and roughness maps.
- Clamp procedural byte values to 0–255.

---

## 13. Running and testing

```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # unit tests
```

## 14. Where to change common things

| Want to… | Edit |
|---|---|
| Add a fabric | `FABRICS` + a `--fabric-*` token in `styles.css`; pattern kind in `createPatternCanvas` if new |
| Add a leg finish | `LEGS` + `--leg-*` token |
| Tweak roughness/sheen | `src/lib/material-recipes.ts` (+ test) |
| Change tile range | `src/lib/texture-repeat.ts` (+ test) |
| Change dimensions | `seatingWidth` / `BASE_SIZE` |
| Change lighting | `Viewer` (Lightformers, exposure) |
| Change shader texturing/tufting | `projectSurface`, `tuftProfileGLSL` |
| Change leg/fabric split | `splitSofaGeometry` |
| Change module building | `sliceModule`, `reflectedGeometry`, `joinedModule`, `SofaModel` |
