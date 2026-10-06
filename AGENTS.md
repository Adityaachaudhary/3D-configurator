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
- Use one meter-based dimension formatter for ruler labels and panel metrics; keep height/depth rulers separate from width animation so unit changes never distort geometry.
