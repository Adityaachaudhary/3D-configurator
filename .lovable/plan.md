# 3D Sofa Configurator

## Goal
Build a premium, full-screen 3D configurator around the supplied Panache sofa model, with accurate material targeting and direct, button-driven controls.

## Experience
- Present the sofa in a bright, refined studio environment with a solid neutral palette, grid floor, soft shadows, and no gradients.
- Use a restrained desktop layout with a compact top bar, floating view controls, and a material panel; adapt controls into a practical bottom sheet on smaller screens.
- Keep interactions explicit: no hover-triggered zoom or hidden hover behavior.

## Viewer controls
- Orbit by dragging and pan with a deliberate tool/control.
- Add zoom in, zoom out, reset view, fit-to-object, fullscreen, and screenshot buttons with accessible labels and tooltips.
- Add preset front, side, rear, and perspective views.
- Toggle the floor grid, dimensions, auto-rotate, and environment/background presentation.
- Display loading progress while the uploaded model is decoded.

## Product configuration
- Inspect model mesh and material names, then map upholstery and leg meshes separately so changes apply only to the correct parts.
- Offer several tactile fabric presets with procedural woven textures, coordinated colors, and adjustable texture scale.
- Offer distinct leg finishes such as natural oak, walnut, blackened wood, and brushed metal.
- Show the selected fabric and leg finish clearly and provide a reset-to-original action.

## Measurements
- Derive the model’s real bounding box and display width, height, and depth dimension lines around the sofa.
- Include a unit selector for centimeters, millimeters, and inches; scaling changes update the displayed dimensions.
- Provide an explicit scale control without altering the model unexpectedly.

## Technical details
- Install React Three Fiber, Drei, and Three.js versions compatible with React 19.
- Place the GLB in the project’s model assets and load it inside a client-only TanStack route with a local Suspense boundary.
- Normalize and center the model once, preserve its mesh hierarchy, and clone materials before applying configurator choices.
- Generate fabric surface maps locally at runtime with canvas textures; do not depend on remote texture services.
- Add semantic color tokens in the global design system and use them throughout the interface.
- Add unique page metadata for the configurator.

## Validation
- Verify the model renders lit and centered at desktop and mobile sizes.
- Exercise material changes, leg finishes, zoom buttons, view presets, grid, measurement visibility, units, scaling, reset, fullscreen handling, and screenshot export.
- Confirm the browser console, model request, and project build are clean.
