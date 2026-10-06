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
- Treat the uploaded sofa as one mesh and separate leg faces spatially into a second material group because the source GLB has only one unnamed material.
- Derive seating variants from fixed end caps and clipped central modules; build the inserted cushion from reflected crown halves with exact original centre-profile ends, corrected winding, and smooth mirror-plane normals so joins stay closed without nearest-profile distortion.
- Project neutral fabric and leg colour, relief, and roughness maps in physical coordinates rather than the imported UV atlas because replicated modules must retain consistent texture density and uninterrupted finishes.
- Generate patterned upholstery and swatch previews from the same seamless artwork and semantic palette; sample pattern colour separately from fabric microstructure in shared physical coordinates with explicit sRGB decoding so repeats stay consistent across derived seating modules.
- Bound weave/grain density to realistic thread sizes while independently scaling printed repeats from the same control; keep low-contrast shared swatch/model microstructure and use physical leather grain with roughness and clearcoat instead of cloth sheen.
- Use one meter-based dimension formatter for ruler labels and panel metrics; keep height/depth rulers separate from width animation so unit changes never distort geometry.
- Calibrate each complete joined seating assembly from its actual geometry bounds to the inch-based size chart before applying user scale; use that same chart for rulers, panel metrics, and camera fitting so displayed measurements match the model without separating module joins.
- Toggle wireframe by setting `material.wireframe` on the shared upholstery/leg materials (and chair clones) in an effect, so it applies uniformly across all derived seating modules.
- Use OrbitControls' built-in zoom (zoomToCursor, minDistance 1.7, maxDistance 7) for wheel/pinch; keep the toolbar zoom buttons driving CameraRig's zoomSignal so both share the same distance limits.
