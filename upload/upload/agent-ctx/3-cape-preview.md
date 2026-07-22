# Task 3 — 3D Cape Preview Component

## Summary
Created `/home/z/my-project/src/components/cape-editor/cape-preview.tsx` — a full 3D Minecraft player model preview with cape rendering using React Three Fiber.

## What was built
- **CapePreview** (main): Player name input + "Load Skin" button + 3D canvas
- **Scene**: Sky-blue background, fog, multi-directional + hemisphere lighting, ground shadow disc, infinite grid
- **PlayerModel**: Box-based Minecraft model (head, body, 2 arms, 2 legs) with proper proportions, Y-centered, scaled to ~4.5 units
- **BodyPart**: Reusable mesh with UV-mapped geometry + skin material or fallback Steve colors
- **CapeMesh**: Self-managing component that watches `canvasDataURL` from Zustand store, loads texture via Three.js refs (no React state to avoid lint issues), renders behind the player
- **AutoRotateControls**: Auto-rotates by default, pauses 3s on interaction

## Key technical decisions
1. **UV mapping**: Custom `createUVBox()` modifies BoxGeometry UV attributes per-face for correct Minecraft skin texture mapping (6 face UV maps for head, body, arms, legs, cape)
2. **Cape texture management**: Moved inside R3F canvas as a self-contained component using Three.js refs only (no React setState) to comply with `react-hooks/set-state-in-effect` lint rule
3. **Skin loading**: User-triggered via button, not an effect — avoids the same lint issue
4. **Pixel-art rendering**: `NearestFilter`, no mipmaps, `SRGBColorSpace` on all textures
5. **Texture cleanup**: Proper disposal on replacement and unmount via refs

## Quality checks
- ESLint: 0 errors
- TypeScript: compiles without errors
- Dev server: no compilation issues