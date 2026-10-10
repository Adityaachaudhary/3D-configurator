# Panache Sofa Configurator — Codebase Guide

Written after reading every line of the configurator, routes, `lib` modules, tests, optimizer script, `vite.config.ts`, `styles.css` and `AGENTS.md`; updated for the real leather grain patch. The symbol map below is the navigation reference; line numbers are approximate and shift with edits.

Read in this order: this file → `AGENTS.md` (binding architecture rules) → `roadmap.md` (task history).

---

## 1. What the app does

A full-screen browser 3D configurator for one supplied sofa model (Panache OPAA, a 2-seater GLB).

| Feature | Details |
|---|---|
| Seating | 1, 2 or 3 seater, animated transitions, all derived from the one 2-seater mesh |
| Upholstery | 14 finishes: Solids (5, including client photo fabric "Wisdom"), Patterns (4, three of them client photos), Leather & Chesterfield (3 + 2) |
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
    material-looks.ts    resolveLook(id, family, tufted), OVERRIDES, applyLook – per-fabric upholstery looks
    leather-grain.ts     leatherHeightField(size, cells=40) – Worley leather grain; boucleHeightField(size, cells=14) – bouclé loops
    texture-repeat.ts    DEFAULT/MIN/MAX_TILE_CM, tileDensity(cm)
    utils.ts             cn()
  assets/
    Panache-OPAA.glb.asset.json        original model pointer (kept, unused at runtime)
    Panache-OPAA-80pct.glb.asset.json  optimized model pointer (loaded by the app)
    sofa-optimization-report.json      optimizer output
    wisdom-fabric.png.asset.json       client fabric photo pointer
    red-fish-fabric.png.asset.json     uploaded Red Fish print, replacing Rose Check
    orange-pattern-fabric.png.asset.json  uploaded Orange Pattern stripe, replacing Teal Diamond
    swatch-urban-fabric.png.asset.json    uploaded Swatch Urban tweed, replacing Olive Check
  test/
    material-recipes.test.ts   recipe ranges per family
    material-looks.test.ts     dark velvet/photo sheen, tweed override, relief and clone preservation
    leather-grain.test.ts      bounded leather grain + bouclé domes, deterministic output, seamless edge variation
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
| 44–50 | types | `FabricId`, `PatternKind`, `FabricPreset`, `LegId`, `Unit`, `ViewName`, `SeatCount` |
| 52–62 | `useReducedMotion` | Reads `prefers-reduced-motion`; disables animations |
| 64–68 | constants | `MODULE_WIDTH 0.7`, `INCH_METERS`, `seatingWidth()`, `BASE_SIZE` |
| 70–86 | `FABRICS` | 14 presets |
| 87–92 | `LEGS` | 4 leg finishes |
| 93–98 | `VIEWS` | camera positions for presets |
| 100–105 | `formatDimension` | meters → "x cm/mm/in" |
| 109–166 | `createSurfaceMaps` | procedural colour/bump/roughness DataTextures (256px, leather 512px, tuft 2048px) |
| 168–230 | `createPhotoSurfaceMaps` | client photo → seamless maps (+ tweed crosshatch) |
| 232–269 | `createPatternCanvas` | 1024px pattern artwork |
| 273–300 | `FabricSwatch` | sidebar swatch preview with source-width row stride |
| 300–301 | `weaveDensity`, `leatherDensity` | aliases of `tileDensity` |
| 308–331 | `tuftProfileGLSL` | GLSL Chesterfield profile + panel UV functions |
| 333–485 | `projectSurface` | shader injection for all materials |
| 487–604 | `splitSofaGeometry` | separates legs from fabric, prepares attributes |
| 606–665 | `tuftPanelFrame` | smoothed panel direction + tuft mask per vertex |
| 667–727 | `sliceModule` | exact clipping of geometry between two X planes |
| 729–752 | `reflectedGeometry` | mirror in X and fix winding |
| 754–773 | `softenMirrorPlane` | smooth normals at a mirror seam |
| 775–780 | `joinedModule` | 3-seater middle insert |
| 782–999 | `SofaModel` | builds modules, materials, animation, renders meshes |
| 1001–1016 | `DimensionLabel` | projects HTML label to screen |
| 1018–1054 | `Dimensions` | ruler lines + labels |
| 1056–1092 | `CameraRig` | view presets, fit distance, button zoom |
| 1094–1112 | `SofaContactShadows` | delayed one-shot contact shadow |
| 1114–1169 | `Viewer` | Canvas, lights, floor, grid, controls |
| 1171–1177 | `ToolButton` | toolbar icon button |
| 1179–1314 | `SofaConfigurator` | state + full UI layout |
| 1316–1318 | `Metric` | dimension card |
| 1320 | `useGLTF.preload` | starts model download early |

---

## 5. Data definitions

### Fabrics (`FABRICS`)
`{ id, name, family, color, weave, pattern?, printed?, tufted?, photo? }`

| Group | Fabrics | weave |
|---|---|---|
| Solids | Oat Bouclé (boucle), Wisdom (linen + photo), Clay Twill (twill), Forest Chenille (loop), Ink Velvet (velvet) | as listed |
| Patterns | Ochre Chevron (procedural `pattern`, twill); Swatch Urban, Red Fish, Orange Pattern (`printed: true` + uploaded `photo`) | as listed |
| Leather | Cognac, Charcoal, Olive | leather |
| Chesterfield | Oxblood, Saddle | leather + `tufted: true` |

Colours: the `color` field is mostly a fallback. The real colour of solids/leathers comes from CSS token `--fabric-<id>`; procedural pattern colours from `--pattern-<id>-base/accent/detail`; Wisdom, Swatch Urban, Red Fish and Orange Pattern use white material tint so their photos show unaltered. The UI groups fabrics by filter: patterns = has `pattern` or `printed`, leather = `weave === "leather"`, solids = the rest. `useTexture(selectedFabric.photo ?? wisdomAsset.url)` loads the selected photograph; `createPhotoSurfaceMaps` derives matched colour, relief and roughness maps. Every photo fabric uses the same joined physical-coordinate projection and per-panel phases as Wisdom on the sofa and chair materials, without changing leg materials.

### Legs (`LEGS`)
`{ id, name, color, metalness, roughness }`. Only `color` is used by the material; physical values come from `materialRecipe("wood" | "steel")`. Sidebar swatch colour uses `.leg-swatch[data-leg]` → `--leg-*`.

### Default state
2 seater, Oat Bouclé, oak, 12.5 cm tile, scale 1, grid on, measures on, rotate off, studio on, wireframe off, cm, perspective. `reset()` restores exactly this.

---

## 6. Rendering setup (`Viewer`)

```text
<Canvas shadows dpr=[1,1.75] camera fov 40 at VIEWS.perspective>
  gl: antialias, preserveDrawingBuffer (screenshot), NeutralToneMapping,
      toneMappingExposure 1, outputColorSpace SRGB
  onCreated: tag canvas data-viewer-canvas, camera.layers.enable(1)
  background colour   studio ? #ebe9e4 : #d9ded8
  ambientLight 0.15
  directionalLight [-3,6,4] 0.6
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
- **Product colour accuracy**: Khronos PBR Neutral tone mapping replaces ACES at exposure 1. Reduced ambient/directional fill preserves shadow definition; the existing rectangular environment lights remain unchanged. No Leva or separate development light rig is installed.
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
    - `bumpScale` (three.js convention: ~0.5–3 reads as visible relief; 0 disables it): woven default 2, Oat 0.9, Clay 2.2, Forest 2, velvet 0, leather default 1 (Charcoal 0.8), pattern/photo fabrics 1, Swatch Urban 1.2, Chesterfields 0. `normalSoften` (flat-panel shading softening passed into `projectSurface`) is 0.15 woven, 0.35 velvet, 0.45 leather, 0.3 tufted.
    - `resolveLook(id, family, tufted)` merges family defaults with `OVERRIDES` from `material-looks.ts`; `applyLook` applies the result after constructing the material with its colour/maps. The old inline tweed override is removed.
    - Solid sheen lerps the base colour toward white by `sheenTint` (woven 0.12, velvet 0.14, Oat/Clay 0.15, Forest 0.2), so the fabric keeps its own hue; white-base photo/pattern materials use a flat `sheenGrey` (0.25 via `PATTERN`, Swatch Urban 0.4) applied with `setScalar`, so no white veil sits over dark fabrics.
    - Swatch Urban keeps roughness 1, sheen 0.5, sheenRoughness 0.62, sheenGrey 0.4 and bumpScale 1.2. Oat's bouclé domes use bumpScale 0.9 with normalSoften 0.1; Forest Chenille keeps the woven 2; ordinary leather sits at 1 (Charcoal 0.8), and both Chesterfields set bumpScale 0 because their padding comes from the analytic tuft path instead.
    - `upholstery.userData["baseColor"]` stores the untampered base colour and `userData["normalSoften"]` the look's shading softening. `applyLook` leaves maps and shader hooks alone; `projectSurface` is still installed afterwards, receiving `look.normalSoften` and `Boolean(selectedFabric.directional)` so flat panels can be softened and Orange Pattern's stripes stay vertical on the arms.
3. **Legs** = `MeshPhysicalMaterial`: leg colour, `...legTexture` (wood or steel maps), bumpScale `LEG_BUMP.wood` 0.6 / `LEG_BUMP.steel` 0.2 (three.js convention), `...materialRecipe("steel" | "wood")`.
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
| `createSurfaceMaps(kind)` | 256px, **512px for leather**, 2048px for `"tuft"`: seamless `DataTexture`s for `map` (neutral near-white, sRGB), `bumpMap` (height) and `roughnessMap` (linear data). Leather calls `leatherHeightField(size)` and uses `height = 0.15 + 0.7 * grain`, colour contrast 0.2, and roughness `0.78 + (1 - height) * 0.22` (creases rougher, dome tops smoother). Bouclé calls `boucleHeightField(size)` with `height = grain` and colour contrast 0.35. Other kinds retain roughness `0.88 + height * 0.12`: wood (grain sines), steel (brushed lines), loop, velvet (fine noise), tuft (diamond), default linen/twill (warp/weft). Bytes are clamped to prevent overflow; neutral colour avoids multiplying the fabric colour twice. |
| `leatherHeightField(size, cells = 40)` | Pure `Float32Array` generator: tileable Worley (cellular) grain — jittered sites per cell, nearest/second-nearest distance forming rounded pebbles with steep narrow creases, plus per-cell height variation. Forty cells across a tile gives approximately 3.1mm grain at the default 12.5cm tile. Shared grain drives colour, bump and roughness; no texture downloads or true normal/AO maps. All five leather finishes, including Chesterfields, use these 512px model maps; Chesterfield model tufting stays analytic and the 2048px diamond map is no longer generated. |
| `boucleHeightField(size, cells = 14)` | Same file, same tileable Worley machinery: each cell is a rounded loop (1 at its centre, 0 in the gaps) with a random height per cell, so raised vs recessed is unambiguous — the old symmetric `sin × cos` "loop" height flipped with the lighting and read as reversed relief. Fourteen loops across a tile gives approximately 7mm loops at Oat's 10cm tile. Used by `createSurfaceMaps("boucle")`; Forest Chenille keeps the `loop` height. |
| `createPhotoSurfaceMaps(img, cropPixels?, reliefStrength = 0.45)` | Central square crop of the photo drawn 4× mirrored into a 1024px canvas (seamless, no stretching). Red Fish uses a 128px source crop so its many tiny motifs remain visible at the default physical tile size; Wisdom, Swatch Urban and Orange Pattern use the largest square crop. bump = luminance scaled by `reliefStrength`; roughness inverse to height. When `reliefStrength > 0.6` (Swatch Urban tweed passes 1.1), a synthetic woven crosshatch is added on top of the photo relief: 48 rounded warp/weft yarns per tile with a broken-twill interlace and slub speckle, thread gaps darken the photo colour slightly, and roughness gaps stay flatter — so the weave reads as real threads, not a flat print. |
| `createPatternCanvas(fabric)` | 1024px pattern from 3 token colours, with a faint 3 % thread modulation. check/chevron/diamond formulas. The stripe formula was removed with Ocean Stripe and Graphite Stripe; diamond has no remaining preset since Teal Diamond was replaced by Orange Pattern. |
| `patternTexture` | `CanvasTexture` of that canvas (sRGB, repeat). |
| `FabricSwatch` | 192px canvas: procedural patterns tiled 3×3; plain/leather = token colour × `createSurfaceMaps` colour (tuft map for Chesterfield). Pixel rows use `maps.map.image.width`, not a fixed 256px stride, so 512px leather and 2048px tuft sources sample correctly. Wisdom, Swatch Urban, Red Fish and Orange Pattern show their original photo `<img>` with the selected fabric's accessible name. |

**Texture settings effect** (lines 902–914): colour maps & pattern → `SRGBColorSpace`; bump/roughness → `NoColorSpace`; `anisotropy = gl.capabilities.getMaxAnisotropy()`; mipmaps; `LinearMipmapLinearFilter` / `LinearFilter`.

Leather's material roughness remains 0.55 from the `leather` family defaults; the height-dependent roughness **map multiplies** that value rather than replacing it. The tile slider controls the shared physical density on sofa modules and chair clones; the grain does not alter geometry or tuft diamond size. There is no live tuning panel: every look value is hardcoded in `OVERRIDES` / `DEFAULTS` in `material-looks.ts` — edit the numbers there and re-run the tests.

---

## 11. Texturing in the shader — `projectSurface`

The GLB UVs are an atlas; cut/mirrored/stretched modules would show stretched and restarted textures. So `projectSurface` hooks `material.onBeforeCompile` and replaces UV lookups with **triplanar sampling in world space**.

### Uniforms
- `surfaceDensity = density / scale` (tiles per meter in world space; dividing by scale makes the pattern grow with the model, so each tile keeps the same size on the sofa)
- `patternMap`, `patternDensity = patternRepeat / scale`
- `undersideColor`
- tuft: `tuftDensity = 4.5 / scale`, `tuftDepth = RELIEF.recess × scale` (0.004 m)

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
- **Cache key**: `physical-surface-v19-panel-analytic-<density>-<repeat>-<scale>-<pattern uuid>-<tufted>-<photo>-<lined>`. Bump the version when editing shader text.

---

## 12. Chesterfield tufting (tufted fabrics only)

- `tuftProfile(uv, detail, footprint)` in `tuftProfileGLSL`: diamond cell in rotated coordinates (`u+v`, `u−v`); height = 0.30 + 0.62·crown + 0.08·pleat − 0.34·pocket + 0.16·detail·buttonHead, clamped 0–1. Edge distances are softened by the pixel footprint (antialiasing).
- Panel coordinates: `seatTuftUV = p.xz + (0.035, −0.025)`, `backTuftUV = p.xy + (0.035, 0.075)`, `armTuftUV = p.zy + (−0.025, 0.045)`, × `tuftDensity`.
- `tuftHeight(p)`: blends the three panel profiles with `|n|^12`, `detail` fades button heads smaller than a pixel (`fwidth`), then `mix(1, h, vTuftMask)` so masked areas are smooth.
- Effects on shading:
  - colour × `0.74 + 0.26·smoothstep(0, 0.85, tuftShade)` (darker seams)
  - roughness × `mix(1.22, 0.88, tuftShade)` (glossier crowns)
  - `normal_fragment_maps` is replaced in two stages: fine grain alone keeps screen-space derivatives at `grain × 0.00045 × scale`; tuft normals use central differences of the analytic profile, not derivatives of `tuftShade` across pixel quads.
  - `tuftPanelH(panel, p, detail, fp)` samples one panel profile. Dominant axis selection chooses seat (Y), back (Z) or arm (X), with panel-aligned world-space tangent vectors. Four samples at ±`0.003 × scale` metres yield the two partial derivatives, sharing the centre pixel's antialias footprint/detail.
  - The gradient is divided by twice the probe distance, multiplied by `vTuftMask`, converted to view space, then scaled by `RELIEF.normalHeight × scale` metres (currently 0.085). Its component along the normal is removed before normalizing the perturbed result. Reduce `RELIEF.normalHeight` for flatter padding; increase the 3mm probe to suppress noise or decrease it for sharper pockets. These values live in `material-looks.ts` and are interpolated into the shader template inside `projectSurface`.
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
- **`data-tsd-source` crash**: TanStack devtools inject this prop on JSX; R3F treats dashed props as nested paths and crashes on reload. `vite.config.ts` strips it from modules whose id contains `SofaConfigurator` or `static-light-rig` — add any new scene-JSX module to that marker list.
- `material.clone()` drops `onBeforeCompile`; always call `projectSurface` again on clones.
- Bump the shader cache key when changing shader strings.
- Don't select parts by GLB material name (only one exists) and don't use mesh UVs for fabric.
- Clamp procedural byte values before writing Uint8Arrays.
- Leftovers: `--fabric-sage` token and `.fabric-swatch[data-fabric=…]` CSS rules are no longer used (Sage was replaced by Wisdom; swatches are canvases now), and `--pattern-rose-check-*` tokens are unused (Rose Check was replaced by Red Fish). Component-bounds arrays in `splitSofaGeometry` are computed but unused. The `"tuft"` texture is only used for swatch previews; the sofa uses the analytic shader.

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
| Roughness / sheen / clearcoat | `src/lib/material-looks.ts` per-fabric overrides + tests; `material-recipes.ts` family defaults/legs |
| Upholstery bump strength | `resolveLook` defaults / `OVERRIDES` in `src/lib/material-looks.ts` |
| Leather pebble / bouclé loop shape & density | `src/lib/leather-grain.ts` (`leatherHeightField`, `boucleHeightField`); map resolution, contrast and height-to-roughness in `createSurfaceMaps` |
| Tile range | `src/lib/texture-repeat.ts` + its test |
| Dimensions | `seatingWidth`, `BASE_SIZE` |
| Lighting / exposure | `Viewer` |
| Contact shadow | `SofaContactShadows` |
| Triplanar / lining / patterns | `projectSurface` |
| Chesterfield look | `tuftProfileGLSL`, tuft parts of `projectSurface`, `tuftPanelFrame` |
| Leg/fabric split | `splitSofaGeometry` |
| Seating geometry / animation | `sliceModule`, `joinedModule`, `chairHalf`, `useFrame` in `SofaModel` |
| Camera behaviour | `VIEWS`, `CameraRig`, `OrbitControls` props |
