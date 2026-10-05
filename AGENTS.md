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
- Derive seating variants by clipping the source into fixed end caps and reusable central modules; animate module transforms with delta-time damping to preserve arm and leg proportions without reloading the asset.
