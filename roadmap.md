# Sofa seating variants
- [x] Add one-, two-, and three-seater variants derived from the uploaded design.
- [x] Animate seating changes and update measurements while preserving finishes.
- [x] Verify size switching, reset, and smaller-screen controls.
- [x] Close the inserted three-seater module's mismatched cut profile across fabrics.
- [x] Display scaled ruler labels and panel measurements in cm, mm, and inches.
- [x] Verify joins and measurement conversions in the viewer.
## Compact configuration panel
- [x] Shrink fabric swatches and tighten panel spacing and type sizes.
- [x] Verify panel width, collapse behaviour, and that controls still work.
## Finish and model quality
- [x] Refine fabric relief, sheen, and leg surface finishes.
- [x] Improve one- and three-seater geometry without duplication artifacts.
- [x] Verify all seating sizes, finishes, joins, and measurements in the viewer.
## Wireframe inspection
- [x] Add a left-toolbar wireframe toggle that works across all seating sizes.
- [x] Verify wireframe on/off for one-, two-, and three-seater models.
## Pointer zoom
- [x] Enable mouse-wheel and trackpad-pinch zoom toward the cursor with distance limits.
- [x] Verify wheel zoom in and out in the viewer.
## Supplied size chart
- [x] Calibrate actual one-, two-, and three-seater geometry to the exact inch dimensions.
- [x] Verify model bounds, rulers, and panel conversions at different scales.
## Patterned upholstery
- [x] Add multicolour patterns with matching compact swatch previews and physical-coordinate mapping.
- [x] Verify patterns on all seating sizes, scale changes, and retained leg finishes.
## Fabric scale and swatch corrections
- [x] Connect pattern repeat and plain weave size to the weave-scale control.
- [x] Prevent canvas preview shrinkage and label every compact fabric swatch.
- [x] Verify all twelve fabrics on all seaters and compare scale endpoints visually.
## Subtle texture and leather
- [x] Limit oversized weave detail without removing visible scale adjustment.
- [x] Add leather finishes and matching swatches on all seating sizes.
- [x] Verify finish changes and texture-scale endpoints in the viewer.
## Chesterfield leather
- [x] Add two leather finishes with padded diamond tufting and matching swatches.
- [x] Make leather grain scale visibly adjustable without scaling tufting or changing dimensions.
- [x] Verify all seating sizes and leather scale endpoints.
## Chesterfield padded depth correction
- [x] Form genuine recessed diamond seams and button pockets rather than shading alone.
- [x] Verify both Chesterfield finishes on all seating sizes, ordinary leather restoration, and unchanged measurements.
## Chesterfield realism refinement
- [x] Reduce displacement cracks and sharp diamond ridges while retaining padded depth.
- [x] Refine recessed buttons, leather highlights, and matching swatch profiles.
- [x] Verify all sizes and both finishes, grain adjustment, and ordinary upholstery restoration.
## Fuller Chesterfield padding
- [x] Deepen rounded diamond padding and button pockets without reopening joins.
- [x] Verify both finishes on all seating sizes and retained grain-scale control.
## Clean Chesterfield edges and legs
- [x] Stop tufting tearing across rolled edges, corners and wrinkled cushion borders.
- [x] Remove upholstery colour and dark marks from the legs.
- [x] Deepen padding and seam shading; verify Saddle and Oxblood on all sizes.
## Restore Chesterfield bounce
- [x] Re-extend deep padding across seats, back cushions and sides while keeping edges clean.
## Subtle interface refinement and floor grid
- [x] Restore the visible floor grid and verify its toggle.
- [x] Refine the interface subtly without changing its theme or working features.
## Fabric artefact corrections
- [x] Apply renderer-maximum anisotropy and mipmaps to all upholstery textures; use 1024px patterned tiles.
- [x] Diagnose black-leather facets with relief disabled and correct shading without removing leather detail.
- [x] Replace downward-facing patterned upholstery with a plain dark underside.
- [x] Antialias analytic Chesterfield dents and highlights while preserving padded depth.
- [x] Verify the four fixes across all seating variants and retain accurate dimensions and controls.
## Conservative triangle reduction
- [x] Create a separate sofa asset with 20% fewer triangles, preserving module cut bands, legs and cushion curves.
- [x] Check reduction and protected vertices with automated tests; confirm unchanged geometry bounds.
- [x] Verify all seating sizes with linen, patterned upholstery and Chesterfield before using the optimized copy.
## Natural cushion folds
- [x] Restrict dark lining to the hidden base underside and blend its boundary smoothly.
- [x] Verify light fabrics and Chesterfield folds across seating sizes without changing padding or dimensions.
## Client Wisdom fabric
- [x] Replace Sage Weave with the uploaded Wisdom photograph in the sidebar and upholstery.
- [x] Verify the photo finish on all seating sizes, scale adjustment and unchanged legs.
## Physical material realism
- [x] Apply and test separate physical recipes for woven fabric, velvet, leather and legs.
- [x] Soften studio lighting and add contact shadows without hiding the floor grid.
- [x] Diagnose cushion lumps with plain grey shading and verify finishes on all seating sizes.
## Texture foundations and filtering
- [x] Explicitly set colour/data spaces, ACES exposure and scene-level environment intensity.
- [x] Enforce maximum anisotropy and linear mipmap filtering, and increase tuft tiles to 2048px while retaining analytic antialiasing.
- [x] Verify velvet and Chesterfield across all seating sizes in the live viewer.
## Chesterfield and physical texture repeats
- [x] Reduce vertex relief and refine analytic seat/back/arm normal shading.
- [x] Show centimeters per tile and break up Wisdom repeats without module seams.
- [x] Test physical repeat conversion and verify finishes on all seating sizes.
## Client Orange Pattern fabric
- [x] Replace Teal Diamond with the uploaded Orange Pattern photograph in the sidebar and upholstery.
- [x] Verify the photo finish on all seating sizes, tile adjustment and unchanged legs.
## Remove unused stripe fabrics
- [x] Delete Ocean Stripe and Graphite Stripe, their colour tokens and the unused stripe generator.
- [x] Verify the remaining sixteen fabrics and that the sofa still renders on all seating sizes.
## Remove Pearl Linen and Ivory Leather
- [x] Delete both finishes, their colour tokens and swatch rule; update the architecture guide.
- [x] Verify the remaining fourteen fabrics and that the sofa still renders with them.
## Panache lighting and colour patch
- [x] Switch to Neutral tone mapping at exposure 1; lower ambient to 0.15 and directional to 0.6, retaining the studio environment.
- [x] Verify Neutral/exposure/light settings in Viewer, successful live Ink Velvet/Wisdom switching with no runtime errors, and update the architecture guide.
## Per-fabric looks
- [x] Add resolveLook/applyLook with per-fabric overrides, colour-faithful sheen, and retained relief; remove the inline tweed override.
- [x] Pass eight material tests; verify Ink Velvet, Wisdom, Swatch Urban and Saddle Chesterfield on all three sizes without runtime errors; update architecture documentation.
## Real leather grain
- [x] Add seamless 512px cellular leather grain, crease contrast/roughness and accurate swatch sampling; lower ordinary leather bump depth.
- [x] Pass fourteen grain/material/repeat tests; verify all five leathers on all three seating sizes and 5/25cm tile endpoints without runtime errors; update architecture documentation.
## Chesterfield analytic normals
- [x] Apply dominant-panel profile probes for tuft normals, retain fine-grain derivatives and bump the shader cache version to v19.
- [x] Verify GPU program linking without GLSL/console errors for both Chesterfields on all seating sizes and 80/120% scale; inspect close-up edges and update documentation.

## Dev tuning panel
- [x] Add leva dependency and src/lib/dev-tuning.tsx (DevPanel, LightRig, useLookTuner)
- [x] Replace Viewer lights block with LightRig; mount DevPanel; wire useLookTuner after chairMaterials
- [x] Replace material-looks.ts and leather-grain.ts with the uploaded Worley-grain / lerp-sheen versions; update tests
## Fixed material settings
- [x] Remove live tuning and reset controls, replace lighting with a static rig and remove leva.
- [x] Apply weave contrast, directional photo mapping, preset tile selection and preset-driven shader settings; retain existing tile/relief values and zero softening where no new numbers were supplied.
- [x] Verify material tests and the live viewer across seating variants.

## Sofa specification and texture patch
- [x] Share existing dimensions and floor lift via sofa-spec.ts.
- [x] Use leather swatch maps for Chesterfield and add the supplied development scale audit.
- [x] Apply bouclé, leather tile minimum and leg bump presets (boucleHeightField wired into createSurfaceMaps, MIN_LEATHER_TILE_CM 14, LEG_BUMP wood 0.6 / steel 0.2)
- [x] Verify Oat, Cognac and Oxblood in the viewer; all render with no browser errors and build OK.
## Shared real-world sizes
- [x] Move every real-world size into one module (two-seater 58×33×32", 24" per extra seat, studio lift 1.5 cm, AR lift 0).
- [x] Verify displayed sizes still read 86.4 / 147.3 / 208.3 cm wide, 83.8 deep, 81.3 high.
- [x] Live INR price card (mock rates: ₹150/seat, fabric ₹50/80/100, legs ₹100) — src/lib/pricing.ts + tested
- [x] Move the price card to the bottom-right beside the sidebar; the orbit/zoom hint returns to the bottom-left.
- [x] Reclassify Wisdom as a Pattern fabric (₹80) so its sidebar group and price category match; Solids keeps only the four ₹50 fabrics.
