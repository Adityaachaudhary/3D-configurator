# Panache Sofa Configurator — Codebase Guide

Written after reading every line of `src/components/SofaConfigurator.tsx` (1,302 lines), the routes, the `lib` modules, the tests, the optimizer script, `vite.config.ts`, `styles.css` and `AGENTS.md`. Line numbers refer to `SofaConfigurator.tsx` at the time of writing.

Read in this order: this file → `AGENTS.md` (binding architecture rules) → `roadmap.md` (task history).

---

## 1. What the app does

A full-screen browser 3D configurator for one supplied sofa model (Panache OPAA, a 2-seater GLB).

| Feature | Details |
|---|---|
| Seating | 1, 2 or 3 seater, animated transitions, all derived from the one 2-seater mesh |
| Upholstery | 18 finishes: Solids (6, including client photo fabric "Wisdom"), Patterns (6), Leather & Chesterfield (4 + 2) |
| Legs | Natural oak, Dark walnut, Ebonized wood, Brushed steel |
| Texture tile | Slider 5–25 cm per tile (step 0.5, default 12.5). Label switches between "Grain tile" / "Pattern tile" / "Weave tile" |
| Size | Model scale 80–120 %, exact inch size chart, units cm / mm / in |
| Viewer | Zoom in/out buttons, wheel/pinch zoom to cursor, fit to view, presets (perspective/front/side/rear), grid, measurement rulers, auto-rotate, studio/background change, wireframe |
| Header | Reset configuration, download PNG screenshot, fullscreen |
| Mobile | Right panel becomes a collapsible bottom sheet ("Configure sofa · N seater") |

Design rules: solid colours only, no gradients, no hover-triggered interactions.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, file routing), Vite 7 |
| Styling | Tailwind CSS v4 configured in `src/styles.css` (oklch tokens) |
| 3D engine | three.js — geometry, materials, textures, shader injection |
| React bridge | @react-three/fiber v9 — `Canvas`, `useFrame`, `useThree` |
| Helpers | @react-three/drei v10 — `ContactShadows`, `Environment`, `Lightformer`, `Line`, `OrbitControls`, `useGLTF`, `useTexture` |
| UI | shadcn `Button` (`src/components/ui/button.tsx`, custom `selected` variant), lucide-react icons |
| Tests | Vitest |
| Offline | meshoptimizer (`scripts/optimize-sofa.mjs`) |

No backend, no database. Everything runs in the browser.

---

## 3. File map

```text
src/
  routes/
    __root.tsx           HTML shell, 404/error pages, Google Fonts (Manrope + Sora), default meta "Panache Studio"
    index.tsx            "/" route, ssr: false, page meta "Panache Sofa Configurator", renders <SofaConfigurator/>
  components/
    SofaConfigurator.tsx Entire app: data, texture generation, shaders, geometry, 3D scene, UI
    ui/button.tsx        Button with "selected" variant (used for active toggles)
  lib/
    material-recipes.ts  materialRecipe(family, tufted) – physical parameters
    texture-repeat.ts    DEFAULT/MIN/MAX_TILE_CM, tileDensity(cm)
    utils.ts             cn()
  assets/
    Panache-OPAA.glb.asset.json        original model pointer (kept, unused at runtime)
    Panache-OPAA-80pct.glb.asset.json  optimized model pointer (loaded by the app)
    sofa-optimization-report.json      optimizer output
    wisdom-fabric.png.asset.json       client fabric photo pointer
    red-fish-fabric.png.asset.json     uploaded Red Fish print, replacing Rose Check
  test/
    material-recipes.test.ts   recipe ranges per family
    texture-repeat.test.ts     cm → tiles/m conversion and clamping
    sofa-optimization.test.ts  20 % reduction + protected vertices
    app-routing.test.tsx       route smoke test
  styles.css             tokens: theme, --panel-width, --fabric-*, --pattern-*-base/accent/detail, --leg-*, --scene-contact-shadow, --dimension
  start.ts / server.ts   template error + CSRF middleware (not app logic)
scripts/optimize-sofa.mjs  offline triangle reduction
vite.config.ts             strip-r3f-tsd-source plugin
```

`*.asset.json` files are `{ url, ... }` pointers to CDN files; binaries are not in git.

---

## 4. Map of `SofaConfigurator.tsx`

| Lines | Symbol | Role |
|---|---|---|
| 41–47 | types | `FabricId`, `PatternKind`, `FabricPreset`, `LegId`, `Unit`, `ViewName`, `SeatCount` |
| 49–59 | `useReducedMotion` | Reads `prefers-reduced-motion`; disables animations |
| 61–65 | constants | `MODULE_WIDTH 0.7`, `INCH_METERS`, `seatingWidth()`, `BASE_SIZE` |
| 66–85 | `FABRICS` | 18 presets |
| 86–91 | `LEGS` | 4 leg finishes |
| 92–97 | `VIEWS` | camera positions for presets |
| 101–104 | `formatDimension` | meters → "x cm/mm/in" |
| 108–164 | `createSurfaceMaps` | procedural colour/bump/roughness DataTextures |
| 168–209 | `createPhotoSurfaceMaps` | Wisdom photo → seamless maps |
| 212–250 | `createPatternCanvas` | 1024px pattern artwork |
| 252–278 | `FabricSwatch` | sidebar swatch preview |
| 281–282 | `weaveDensity`, `leatherDensity` | aliases of `tileDensity` |
| 289–312 | `tuftProfileGLSL` | GLSL Chesterfield profile + panel UV functions |
| 314–466 | `projectSurface` | shader injection for all materials |
| 468–581 | `splitSofaGeometry` | separates legs from fabric, prepares attributes |
| 587–644 | `tuftPanelFrame` | smoothed panel direction + tuft mask per vertex |
| 648–706 | `sliceModule` | exact clipping of geometry between two X planes |
| 710–733 | `reflectedGeometry` | mirror in X and fix winding |
| 735–754 | `softenMirrorPlane` | smooth normals at a mirror seam |
| 756–761 | `joinedModule` | 3-seater middle insert |
| 763–981 | `SofaModel` | builds modules, materials, animation, renders meshes |
| 983–998 | `DimensionLabel` | projects HTML label to screen |
| 1000–1036 | `Dimensions` | ruler lines + labels |
| 1038–1072 | `CameraRig` | view presets, fit distance, button zoom |
| 1076–1094 | `SofaContactShadows` | delayed one-shot contact shadow |
| 1096–1151 | `Viewer` | Canvas, lights, floor, grid, controls |
| 1153–1159 | `ToolButton` | toolbar icon button |
| 1161–1296 | `SofaConfigurator` | state + full UI layout |
| 1298–1300 | `Metric` | dimension card |
| 1302 | `useGLTF.preload` | starts model download early |

---

## 5. Data definitions

### Fabrics (`FABRICS`)
`{ id, name, family, color, weave, pattern?, printed?, tufted?, photo? }`

| Group | Fabrics | weave |
|---|---|---|
| Solids | Oat Bouclé (loop), Pearl Linen (linen), Wisdom (linen + photo), Clay Twill (twill), Forest Chenille (loop), Ink Velvet (velvet) | as listed |
| Patterns | Ocean Stripe, Olive Check, Red Fish, Graphite Stripe (linen); Ochre Chevron, Teal Diamond (twill) | procedural `pattern`, or `printed: true` + uploaded `photo` for Red Fish |
| Leather | Cognac, Charcoal, Ivory, Olive | leather |
| Chesterfield | Oxblood, Saddle | leather + `tufted: true` |

Colours: the `color` field is mostly a fallback. The real colour of solids/leathers comes from CSS token `--fabric-<id>`; procedural pattern colours from `--pattern-<id>-base/accent/detail`; Wisdom and Red Fish use white material tint so their photos show unaltered. The UI groups fabrics by filter: patterns = has `pattern` or `printed`, leather = `weave === "leather"`, solids = the rest. `useTexture(selectedFabric.photo ?? wisdomAsset.url)` loads the selected photograph; `createPhotoSurfaceMaps` derives matched colour, relief and roughness maps. Red Fish uses the same joined physical-coordinate projection and per-panel phases as Wisdom on the sofa and chair materials, without changing leg materials.

### Legs (`LEGS`)
`{ id, name, color, metalness, roughness }`. Only `color` is used by the material; physical values come from `materialRecipe("wood" | "steel")`. Sidebar swatch colour uses `.leg-swatch[data-leg]` → `--leg-*`.

### Default state
2 seater, Oat Bouclé, oak, 12.5 cm tile, scale 1, grid on, measures on, rotate off, studio on, wireframe off, cm, perspective. `reset()` restores exactly this.

---

## 6. Rendering setup (`Viewer`)

```text
<Canvas shadows dpr=[1,1.75] camera fov 40 at VIEWS.perspective>
  gl: antialias, preserveDrawingBuffer (screenshot), ACESFilmicToneMapping,
      toneMappingExposure 0.95, outputColorSpace SRGB
  onCreated: tag canvas data-viewer-canvas, camera.layers.enable(1)
  background colour   studio ? #ebe9e4 : #d9ded8
  ambientLight 0.5
  directionalLight [-3,6,4] 0.9
  Environment (resolution 256, environmentIntensity 1)
     Lightformer rect key  [-3,5,4]  intensity 2.2 scale 7×5
     Lightformer rect fill [4,2,3]   intensity 1   scale 6×4
     Lightformer rect rim  [1,4,-4]  intensity 0.85 scale 5×3   (all aimed at [0,0.4,0])
  floor plane 30×30, roughness 0.96, layer 1, colour studio ? #e3e0da : #ccd3cc
  gridHelper 12m / 24 divisions, y 0.006, layer 1, renderOrder 1, depthWrite false
  <Suspense> SofaModel + SofaContactShadows
  Dimensions (if measures)
  OrbitControls
  CameraRig
```

- **Environment from Lightformers** = soft studio reflections without an HDRI file. `environmentIntensity` sets `scene.environmentIntensity`.
- **Layers**: floor and grid are on layer 1. The main camera sees layers 0+1; the contact-shadow camera only layer 0, so floor/grid are never baked into the shadow.
- **Grid**: drawn after the floor with depth test on but depth write off → floor can't hide it, sofa still covers it.
- **Contact shadow** (`SofaContactShadows`): waits 700 ms after any `seats`/`scale` change, then mounts drei `ContactShadows` with `frames={1}` (one capture), position y 0.009, scale 6, far 1.5, opacity 0.38, blur 2.5, resolution 256. Colour from `--scene-contact-shadow`. No shadow work during orbit.
- **OrbitControls**: damping 0.08, zoomSpeed 0.9, `zoomToCursor`, distance 1.7–7, polar 0.35–π/2.02 (can't go under the floor), autoRotate speed 0.7, target [0,0.42,0]. Right-drag pans.
- **CameraRig**: on view/seats/scale/viewport change it computes a fit distance `max(3.2, radius / tan(fov/2) × 1.22)` along the preset direction and lerps the camera there (`1 − e^(−14·dt)`, instant with reduced motion). Zoom buttons increment/decrement `zoomSignal`; each step multiplies distance by 0.82 / 1.22 clamped to 1.7–7. "Fit to view" = perspective preset + reset signal.

---

## 7. Model loading and fabric/leg separation

1. `useGLTF(sofaAsset.url)` loads the optimized GLB (preloaded at module load). The first `Mesh` found by traversal is used.
2. `splitSofaGeometry` (clone of the source geometry):
   - Union-find over the index buffer + welding of vertices with equal positions (`toFixed(5)`) to compute connected components (component bounds are computed; kept for diagnostics).
   - **Leg axes**: for each quadrant (±x, ±z) average x/z of vertices with `y < −0.37`, `|x| > 0.7`, `|z| > 0.2`.
   - **Triangle classification**: centroid `y < −0.3085` and horizontal distance to any leg axis `< 0.0335` → leg, else fabric.
   - Index buffer rewritten as `[fabric..., legs...]` with **group 0 = fabric, group 1 = legs**.
   - `computeVertexNormals()` (source feet normals were inconsistent), then **upholstery normals smoothed** across coincident vertices (UV seams split vertices) without moving geometry. Leg normals untouched.
   - Adds attribute `tuftDirection` (averaged normal per welded position — so duplicate vertices move together when recessed) and `tuftFrame` (from `tuftPanelFrame`).
3. Each mesh gets the material array `[upholstery, legs]`, so a fabric change only rebuilds/affects material 0 and a leg change material 1.

### `tuftPanelFrame`
Per welded vertex: smooths the normal 28 passes over neighbours → stable panel direction (xyz). Mask (w) = panel flatness (`smoothstep(0.70, 0.84, max |axis|)`) × not-a-wrinkle (raw vs smoothed normal) × above the welt (`y` −0.305…−0.265), fabric only, then 6 smoothing passes. Used only by Chesterfield to keep tufts off rolled edges, corners, wrinkles and the base.

---

## 8. Seating variants

Source X range ≈ −1.05…1.05; `MODULE_WIDTH = 0.7`.

`modules` (useMemo):
| # | Geometry | Built by |
|---|---|---|
| 0 | left end cap (x < −0.7) | `sliceModule(g, −∞, −0.7)` |
| 1 | right end cap (x > 0.7) | `sliceModule(g, 0.7, ∞)` |
| 2 | left seat (−0.7…0) | `sliceModule` |
| 3 | right seat (0…0.7) | `sliceModule`, mounted at x −0.35 inside a group |
| 4,5 | middle insert | `joinedModule(g)` |

- `sliceModule` clips each triangle against two X planes (Sutherland–Hodgman), interpolating **all** attributes (position, normal, uv, tuftDirection, tuftFrame), keeps material groups. No gaps at cuts.
- `joinedModule`: takes the half cushion −0.35…0, shifts it right by 0.35, softens the mirror plane, and returns it plus its `reflectedGeometry` → a full cushion whose both ends equal the original centre profile.
- `reflectedGeometry`: negates X of position/normal/tuftDirection/tuftFrame and swaps vertex 2/3 of every triangle to fix winding.
- **1-seater (`chairHalf` + `chairOtherHalf`)**: slice x < −0.35, stretch the inner cushion part ×2 in X so it reaches the centre, correct normals for that stretch, soften the mirror plane, then reflect for the other half. Rendered in a separate `chair-assembly` group with cloned `chairMaterials`.

### Animation (`useFrame` in `SofaModel`)
- `animatedSeats` damps toward `seats` (λ 14).
- For values 2…3: end caps move outward by `(n−2)·0.35`, the insert group's `scale.x` grows 0→1, the right-seat group slides.
- For 1…2: `chairBlend = 2 − n` cross-fades the 2-seater assembly (opacity 1−blend) and the chair (opacity blend, slight 0.95→1 grow). `transparent`/`depthWrite` toggled so the settled state is fully opaque.

### Exact size chart
```ts
seatingWidth(seats) = (34 + (seats − 1) × 24) × 0.0254 m   // 34", 58", 82"
BASE_SIZE.height = 32", BASE_SIZE.depth = 33"
```
Each frame, the whole assembly is scaled from the **real source bounds** so its width = `seatingWidth(current)` (accounting for the inserted module), height = 32", depth = 33", times user `scale`, and placed on the floor (y 0.015) centred. The chair is calibrated from its own bounds. The same numbers drive `Dimensions`, `Metric` cards and `CameraRig`.

`formatDimension`: cm ×100 (1 dp), mm ×1000 (0 dp), in ÷0.0254 (1 dp).

---

## 9. Materials — how a selection becomes a material

`SofaModel` → `materials` useMemo (rebuilt when fabric, leg, tile, scale or pattern changes):

1. **Colour**: read `--fabric-<id>` by painting a 1×1 canvas and reading the pixel (converts oklch to RGB), interpreted as sRGB. Patterns use the fallback (white); photo = white.
2. **Upholstery** = `MeshPhysicalMaterial`:
   - `...fabricTexture` (map, bumpMap, roughnessMap)
   - `bumpScale`: tufted 0.024, leather 0.00045, loop 0.00018, velvet 0.00004, other 0.00009
   - `...materialRecipe("leather" | "velvet" | "woven", tufted)`
   - `sheenColor` = colour lerped 35 % to white
3. **Legs** = `MeshPhysicalMaterial`: leg colour, `...legTexture` (wood or steel maps), bumpScale steel 0.000008 / wood 0.000025, `...materialRecipe("steel" | "wood")`.
4. **Underside lining colour** from `--fabric-underside`.
5. `projectSurface(upholstery, tileDensity(cm), scale, patternTexture, tileDensity(cm), tufted, undersideColor, isPhoto)` and `projectSurface(legs, steel ? 3 : 1.6, scale)`.
6. `chairMaterials` = clones of both with `projectSurface` re-applied (`onBeforeCompile` is not copied by `clone()`).
7. Effects: dispose old materials/textures; `material.wireframe = wireframe` on all of them.

### Physical recipes (`src/lib/material-recipes.ts`)
Base: metalness 0, sheen 0, sheenRoughness 0.5, clearcoat 0, clearcoatRoughness 0.35, specularIntensity 1.

| Family | Overrides |
|---|---|
| woven | roughness 0.96, sheen 0.65 |
| velvet | roughness 0.92, sheen 1, sheenRoughness 0.4 |
| leather | roughness 0.58, clearcoat 0.06 (tufted 0.04), specularIntensity 0.6 |
| wood | roughness 0.56, clearcoat 0.025 |
| steel | roughness 0.3, metalness 0.82 |

---

## 10. Textures — generation

| Function | Output |
|---|---|
| `createSurfaceMaps(kind)` | 256px (2048px for `"tuft"`) seamless `DataTexture`s: `map` (neutral near-white microstructure, sRGB), `bumpMap` (height), `roughnessMap` (0.88–1.0). Kinds: wood (grain sines), steel (brushed lines), loop, velvet (fine noise), leather (pebble grain), tuft (diamond), default linen/twill (warp/weft). All values clamped (Uint8 overflow made black spots). The colour map is neutral so the fabric colour isn't multiplied twice. |
| `createPhotoSurfaceMaps(img, cropPixels?)` | Central square crop of the photo drawn 4× mirrored into a 1024px canvas (seamless, no stretching). Red Fish uses a 128px source crop so its many tiny motifs remain visible at the default physical tile size; Wisdom uses the largest square crop. bump = luminance with 0.45 contrast; roughness ≈ 0.96 inverse to height. |
| `createPatternCanvas(fabric)` | 1024px pattern from 3 token colours, with a faint 3 % thread modulation. stripe/check/chevron/diamond formulas. |
| `patternTexture` | `CanvasTexture` of that canvas (sRGB, repeat). |
| `FabricSwatch` | 192px canvas: procedural patterns tiled 3×3; plain/leather = token colour × `createSurfaceMaps` colour (tuft map for Chesterfield). Wisdom and Red Fish show their original photo `<img>` with the selected fabric's accessible name. |

**Texture settings effect** (lines 902–914): colour maps & pattern → `SRGBColorSpace`; bump/roughness → `NoColorSpace`; `anisotropy = gl.capabilities.getMaxAnisotropy()`; mipmaps; `LinearMipmapLinearFilter` / `LinearFilter`.

---

## 11. Texturing in the shader — `projectSurface`

The GLB UVs are an atlas; cut/mirrored/stretched modules would show stretched and restarted textures. So `projectSurface` hooks `material.onBeforeCompile` and replaces UV lookups with **triplanar sampling in world space**.

### Uniforms
- `surfaceDensity = density / scale` (tiles per meter in world space; dividing by scale makes the pattern grow with the model, so each tile keeps the same size on the sofa)
- `patternMap`, `patternDensity = patternRepeat / scale`
- `undersideColor`
- tuft: `tuftDensity = 4.5 / scale`, `tuftDepth = 0.0015 × scale`

### Vertex shader
- Varyings: `surfacePosition` (world position), `surfaceNormal` (world normal), `surfaceFacingNormal` (world normal from the inverse-transpose normal matrix), `surfaceBaseHeight` (source-space `position.y`).
- Tufted: `surfacePosition`/`surfaceNormal` use the undisplaced position and the smoothed `tuftFrame` panel normal; vertex recessed inward along `tuftDirection` by `tuftDepth × mask × (1 − paddedHeight)` (only seams/buttons sink; crowns keep the original envelope).

### Fragment shader
- `surfaceSample(tex, p)`: weights = `|normal|^6`; samples YZ (arms), XZ (seat), XY (back). For photo fabrics each plane has its own offset and the arm plane is rotated a quarter-turn, to hide the photo repeat. Coordinates are world/joined, never per-module, so cuts don't show.
- Expands `map_fragment`, `roughnessmap_fragment`, `bumpmap_pars_fragment` and rewrites:
  - `texture2D(map, vMapUv)` → `surfaceSample(map, surfacePosition)`
  - roughness likewise
  - bump derivatives use `dFdx(surfacePosition)` (3D) and `surfaceSample` (or `surfaceRelief` for tufted)
- **Pattern**: after `color_fragment`, `diffuseColor *= triplanar(patternMap)` with sharper weights `|n|^12`, offset 1.5 cm in Y.
- **Base lining**: before `alphamap_fragment`, mix to `undersideColor` where `surfaceBaseHeight < −0.305…−0.320` AND facing down (`y < −0.60…−0.85`). Both soft — visible cushion folds keep the fabric.
- **Cache key**: `physical-surface-v18-panel-analytic-<density>-<repeat>-<scale>-<pattern uuid>-<tufted>-<photo>-<lined>`. Bump the version when editing shader text.

---

## 12. Chesterfield tufting (tufted fabrics only)

- `tuftProfile(uv, detail, footprint)` in `tuftProfileGLSL`: diamond cell in rotated coordinates (`u+v`, `u−v`); height = 0.30 + 0.62·crown + 0.08·pleat − 0.34·pocket + 0.16·detail·buttonHead, clamped 0–1. Edge distances are softened by the pixel footprint (antialiasing).
- Panel coordinates: `seatTuftUV = p.xz + (0.035, −0.025)`, `backTuftUV = p.xy + (0.035, 0.075)`, `armTuftUV = p.zy + (−0.025, 0.045)`, × `tuftDensity`.
- `tuftHeight(p)`: blends the three panel profiles with `|n|^12`, `detail` fades button heads smaller than a pixel (`fwidth`), then `mix(1, h, vTuftMask)` so masked areas are smooth.
- Effects on shading:
  - colour × `0.74 + 0.26·smoothstep(0, 0.85, tuftShade)` (darker seams)
  - roughness × `mix(1.22, 0.88, tuftShade)` (glossier crowns)
  - normal perturbed from screen-space derivatives of `paddingHeight = (tuftShade·0.042 + grain·0.00045) × scale` (replaces `normal_fragment_maps`)
  - `surfaceRelief` = tuft height + 0.075 × grain, feeding three's bump code
- Grain size follows the tile slider; diamond size does not (`tuftDensity` fixed 4.5/m).

---

## 13. Measurements

- `Dimensions`: drei `Line`s (colour `#263126`) for width (front, y 0.08), height (right side) and depth (left side). The width group scales in X with the animated seat count; height/depth rulers move only in X, so units/animation never distort them.
- `DimensionLabel`: an empty group in the scene; each frame its world position is projected to screen and written into a pre-rendered `<span data-dimension="width|height|depth">` (outside the Canvas). Hidden when behind the camera.
- Panel `Metric` cards use the same `seatingWidth`/`BASE_SIZE` × scale through `formatDimension`.

---

## 14. UI layout (`SofaConfigurator`)

- `<main data-configurator-root>` full viewport (min 620px high). Viewer fills the area left of `--panel-width` (20rem).
- **Header**: logo + "Panache / Product configurator", centre summary (model · seats, fabric · leg), buttons Reset, Download image (`canvas.toDataURL` → `panache-<seats>-seater-<fabric>-<leg>.png`), Fullscreen (`requestFullscreen` on the root).
- **Left toolbar** (`nav`): Zoom in, Zoom out, Fit to view | Grid, Measurements, Auto rotate, Change studio, Wireframe. Active toggles use `variant="selected"`.
- **View presets** bar at the bottom centre.
- **Right panel** (`aside`, `.configuration-scroll`): "01 / Configuration — Make it yours" → Seating (3 buttons with icons) → Upholstery (3 groups, 6-column grid of 70px swatch buttons, check badge on selection, tile slider) → Leg finish (2×2) → Scale & dimensions (unit toggle, scale slider, 3 Metric cards).
- Hint chip "Drag to orbit · scroll or pinch to zoom · right-drag to pan" (large screens).
- All UI colours are tokens (`bg-surface`, `bg-primary`, `text-muted-foreground`, `bg-dimension`…). Scene colours (background, floor, grid, ruler lines) are hex literals inside the Canvas.

---

## 15. Model optimization (offline)

```bash
bun scripts/optimize-sofa.mjs input.glb output.glb report.json
```
- meshoptimizer `simplifyWithAttributes` (positions + normals), target 80 % of triangles (173,612 → 138,888), absolute error ≤ 1 mm (measured 0.21 mm), `LockBorder`.
- Locked vertices: legs/base (y < −0.265), silhouette extremes (within 6 mm of bounds), every triangle crossing the join planes x = ±0.7, ±0.35, 0 (±1.5 cm), so module cuts still match.
- Fails if a protected vertex disappears. Writes a new GLB and a JSON report; `sofa-optimization.test.ts` checks it.

---

## 16. Gotchas and known leftovers

- **Client-only**: `index.tsx` uses `ssr: false`; WebGL can't render on the server.
- **`data-tsd-source` crash**: TanStack devtools inject this prop on JSX; R3F treats dashed props as nested paths and crashes on reload. `vite.config.ts` strips it from modules whose id contains `SofaConfigurator` — keep scene JSX in that file.
- `material.clone()` drops `onBeforeCompile`; always call `projectSurface` again on clones.
- Bump the shader cache key when changing shader strings.
- Don't select parts by GLB material name (only one exists) and don't use mesh UVs for fabric.
- Clamp procedural byte values before writing Uint8Arrays.
- Leftovers: `--fabric-sage` token and `.fabric-swatch[data-fabric=…]` CSS rules are no longer used (Sage was replaced by Wisdom; swatches are canvases now). Component-bounds arrays in `splitSofaGeometry` are computed but unused. The `"tuft"` texture is only used for swatch previews; the sofa uses the analytic shader.

---

## 17. Run and test

```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run
```

## 18. Where to change things

| Goal | Edit |
|---|---|
| Add a fabric | `FabricId`, `FABRICS`, `--fabric-<id>` (or `--pattern-<id>-*`) in `styles.css` |
| New pattern kind | `PatternKind` + formula in `createPatternCanvas` |
| Add a leg finish | `LegId`, `LEGS`, `--leg-<id>`, `.leg-swatch` rule |
| Roughness / sheen / clearcoat | `src/lib/material-recipes.ts` + its test |
| Bump strength | `bumpScale` in `SofaModel` materials |
| Tile range | `src/lib/texture-repeat.ts` + its test |
| Dimensions | `seatingWidth`, `BASE_SIZE` |
| Lighting / exposure | `Viewer` |
| Contact shadow | `SofaContactShadows` |
| Triplanar / lining / patterns | `projectSurface` |
| Chesterfield look | `tuftProfileGLSL`, tuft parts of `projectSurface`, `tuftPanelFrame` |
| Leg/fabric split | `splitSofaGeometry` |
| Seating geometry / animation | `sliceModule`, `joinedModule`, `chairHalf`, `useFrame` in `SofaModel` |
| Camera behaviour | `VIEWS`, `CameraRig`, `OrbitControls` props |
