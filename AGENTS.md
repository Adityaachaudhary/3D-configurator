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
- Derive seating variants from fixed end caps and clipped central modules; match inserted cut profiles to the original centre profile with interpolated normals and UVs so joins remain closed across fabrics, and animate transforms without reloading the asset.
- Use one meter-based dimension formatter for ruler labels and panel metrics; keep height/depth rulers separate from width animation so unit changes never distort geometry.
