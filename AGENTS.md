<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the 3D configurator client-only and isolate all Three.js scene logic in `SofaConfigurator.tsx` because WebGL cannot render during SSR.
- Keep tested family defaults in `material-recipes.ts` and fixed upholstery, lighting and relief presets in `material-looks.ts`; apply looks before shader injection and chair cloning to preserve maps, tufting and seating consistency. `static-light-rig.tsx` supplies fixed Viewer lights using createElement to avoid devtools dashed-prop injection into R3F.
- Use broad targeted rectangular environment lights and finite contact-shadow captures after size transitions settle; recapture on seating/scale changes and exclude floor/grid via camera layers so the sofa is grounded without shadow passes during orbit or baking the floor into a dark overlay.
- Treat the uploaded sofa as one mesh and separate leg faces spatially (full tapered cone around each detected leg axis, up to the base underside) into a second material group because the source GLB has only one unnamed material.
- Derive seating variants from fixed end caps and clipped central modules; build the inserted cushion from reflected crown halves with exact original centre-profile ends, corrected winding, and smooth mirror-plane normals so joins stay closed without nearest-profile distortion.
- Project maps in physical coordinates, not imported UVs, to keep module texture density consistent; derive aligned leather maps from the pure tested `leather-grain.ts` height field.
- Client photographic fabrics use the original CDN image in the swatch and a non-stretched mirrored square crop; apply shared per-panel phase offsets/quarter-turns to colour, relief and roughness in joined physical coordinates, not module-local restarts, to disguise photo repetition without cut seams or a second synthetic weave.
- Share seamless 1024px pattern artwork; use sRGB colour, NoColorSpace data, maximum anisotropy and linear mipmap filtering for sharp repeats. Set viewer product-neutral tone mapping/exposure and scene environmentIntensity explicitly for predictable lighting and colour fidelity.
- Keep texture repeat conversion in the pure tested `src/lib/texture-repeat.ts` module and display centimeters per tile; sample all fabric maps with the same physical tile density so the label represents the actual repeat and keep low-contrast weave/grain detail restrained.
- Derive Chesterfield normals with central differences of the analytic profile on the dominant seat/back/arm panel to avoid pixel-quad stairs; use screen derivatives only for fine grain. Keep minimal inward recess along welded tuft directions, independent grain/diamond scales, smoothed edge/welt masks and joined coordinates to preserve silhouettes and seams.
- Use one meter-based dimension formatter for ruler labels and panel metrics; keep height/depth rulers separate from width animation so unit changes never distort geometry.
- Calibrate each complete joined seating assembly from its actual geometry bounds to the inch-based size chart before applying user scale; use that same chart for rulers, panel metrics, and camera fitting so displayed measurements match the model without separating module joins.
- Toggle wireframe by setting `material.wireframe` on the shared upholstery/leg materials (and chair clones) in an effect, so it applies uniformly across all derived seating modules.
- Use OrbitControls' built-in zoom (zoomToCursor, minDistance 1.7, maxDistance 7) for wheel/pinch; keep the toolbar zoom buttons driving CameraRig's zoomSignal so both share the same distance limits.
- Clamp procedural texture bytes before writing Uint8Array data because out-of-range values wrap to black.
- Render floor grid lines after the opaque floor with depth testing enabled and depth writes disabled so the floor cannot erase them and the sofa still occludes them.
- Smooth coincident upholstery shading normals without welding or moving geometry; leave leg normals intact because the source UV splits otherwise leave visible leather facets.
- Restrict plain lining to the hidden base using undeformed source-space height below the base welt plus an inverse-transpose world-space facing normal and smooth masks; downward cushion folds keep upholstery because orientation alone misclassifies visible creases.
- Use 2048px tuft preview maps; antialias analytic model tufting with fragment pixel footprints, keeping vertex relief derivative-free for stable depth and joins.
- Optimize the sofa offline with the reproducible `scripts/optimize-sofa.mjs` Meshoptimizer pass and a separate asset pointer; retain the original, lock triangles crossing module cut bands plus legs/base and silhouette extremes, and use normal-weighted simplification with a strict error budget to preserve curves without runtime simplification.
- Strip TanStack devtools `data-tsd-source` tags from the 3D scene module via a post-transform Vite plugin, because R3F treats dashed props as nested object paths and crashes when they change on reload.
