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
- Treat the uploaded sofa as one mesh and separate leg faces spatially (full tapered cone around each detected leg axis, up to the base underside) into a second material group because the source GLB has only one unnamed material.
- Derive seating variants from fixed end caps and clipped central modules; build the inserted cushion from reflected crown halves with exact original centre-profile ends, corrected winding, and smooth mirror-plane normals so joins stay closed without nearest-profile distortion.
- Project neutral fabric and leg colour, relief, and roughness maps in physical coordinates rather than the imported UV atlas because replicated modules must retain consistent texture density and uninterrupted finishes.
- Generate patterned upholstery and swatch previews from the same seamless 1024px artwork and semantic palette; tag colour maps sRGB for GPU decoding before filtering, leave relief/roughness maps NoColorSpace, and apply renderer-maximum anisotropy plus mipmaps so repeats stay consistent and sharp across derived seating modules.
- Bound weave/grain density to realistic thread sizes while independently scaling printed repeats from the same control; keep low-contrast shared swatch/model microstructure and use physical leather grain with roughness and clearcoat instead of cloth sheen.
- Keep Chesterfield tuft relief in a separate physical-coordinate profile shared by swatches and all upholstery materials; combine restrained inward displacement along welded shared tuft directions with physical-derivative relief shading for fuller crowns without opening joins, preserve the calibrated envelope, and keep grain scale independent of tuft diamonds. Choose tuft projection from a neighbourhood-smoothed panel normal and fade tufting via a per-vertex panel mask (rolled edges, wrinkled borders, base welt) because per-vertex projection switching tears the relief.
- Use one meter-based dimension formatter for ruler labels and panel metrics; keep height/depth rulers separate from width animation so unit changes never distort geometry.
- Calibrate each complete joined seating assembly from its actual geometry bounds to the inch-based size chart before applying user scale; use that same chart for rulers, panel metrics, and camera fitting so displayed measurements match the model without separating module joins.
- Toggle wireframe by setting `material.wireframe` on the shared upholstery/leg materials (and chair clones) in an effect, so it applies uniformly across all derived seating modules.
- Use OrbitControls' built-in zoom (zoomToCursor, minDistance 1.7, maxDistance 7) for wheel/pinch; keep the toolbar zoom buttons driving CameraRig's zoomSignal so both share the same distance limits.
- Clamp procedural texture bytes before writing Uint8Array data because out-of-range values wrap to black.
- Render floor grid lines after the opaque floor with depth testing enabled and depth writes disabled so the floor cannot erase them and the sofa still occludes them.
- Smooth coincident upholstery shading normals without welding or moving geometry; leave leg normals intact because the source UV splits otherwise leave visible leather facets.
- Detect upholstery undersides with a separate inverse-transpose world-space facing normal, not the smoothed tuft projection frame, so downward faces receive plain lining without changing legs.
- Antialias the analytic tuft profile using per-projection pixel footprints only in fragment shading; retain derivative-free vertex relief so padded depth and joined geometry remain stable.
- Optimize the sofa offline with the reproducible `scripts/optimize-sofa.mjs` Meshoptimizer pass and a separate asset pointer; retain the original, lock full triangles crossing module cut bands plus legs/base and silhouette extremes, and use normal-weighted simplification with a strict geometric error budget to preserve curves without runtime simplification.
