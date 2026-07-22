'use client';

import {
  useRef,
  useMemo,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useCapeEditorStore } from './cape-editor-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════════════════════

/** UV region in pixel coordinates: [startX, startY, width, height] */
type UVRegion = [number, number, number, number];

/** Six-face UV map ordered: [+x right, -x left, +y top, -y bottom, +z front, -z back] */
type FaceUVMap = UVRegion[];

const MODEL_SCALE = 0.14;
const SKIN_SIZE = 64;
const CAPE_TEX_W = 64;
const CAPE_TEX_H = 32;

// ═══════════════════════════════════════════════════════════════
// Minecraft Skin UV Layouts (64×64 texture)
// Positions match MinecraftCapes/minecraft-skin-viewer
// Body center at (0,0,0), head at (0,10,0), legs at (y=-12)
// ═══════════════════════════════════════════════════════════════

const UV_HEAD: FaceUVMap = [
  [0, 8, 8, 8],    // +X right side
  [16, 8, 8, 8],   // -X left side
  [8, 0, 8, 8],    // +Y top
  [16, 0, 8, 8],   // -Y bottom
  [8, 8, 8, 8],    // +Z front
  [24, 8, 8, 8],   // -Z back
];

const UV_BODY: FaceUVMap = [
  [16, 20, 4, 12],
  [28, 20, 4, 12],
  [20, 16, 8, 4],
  [28, 16, 8, 4],
  [20, 20, 8, 12],
  [32, 20, 8, 12],
];

const UV_RIGHT_ARM: FaceUVMap = [
  [40, 20, 4, 12],
  [48, 20, 4, 12],
  [44, 16, 4, 4],
  [48, 16, 4, 4],
  [44, 20, 4, 12],
  [52, 20, 4, 12],
];

const UV_LEFT_ARM: FaceUVMap = [
  [32, 52, 4, 12],
  [40, 52, 4, 12],
  [36, 48, 4, 4],
  [40, 48, 4, 4],
  [36, 52, 4, 12],
  [44, 52, 4, 12],
];

const UV_RIGHT_LEG: FaceUVMap = [
  [0, 20, 4, 12],
  [8, 20, 4, 12],
  [4, 16, 4, 4],
  [8, 16, 4, 4],
  [4, 20, 4, 12],
  [12, 20, 4, 12],
];

const UV_LEFT_LEG: FaceUVMap = [
  [16, 52, 4, 12],
  [24, 52, 4, 12],
  [20, 48, 4, 4],
  [24, 48, 4, 4],
  [20, 52, 4, 12],
  [28, 52, 4, 12],
];

// Overlay (outer skin layer) UV regions — same dimensions, different texture regions
const UV_HEAD_OVERLAY: FaceUVMap = [
  [32, 8, 8, 8],
  [48, 8, 8, 8],
  [40, 0, 8, 8],
  [48, 0, 8, 8],
  [40, 8, 8, 8],
  [56, 8, 8, 8],
];

const UV_BODY_OVERLAY: FaceUVMap = [
  [16, 36, 4, 12],
  [28, 36, 4, 12],
  [20, 32, 8, 4],
  [28, 32, 8, 4],
  [20, 36, 8, 12],
  [32, 36, 8, 12],
];

const UV_RIGHT_ARM_OVERLAY: FaceUVMap = [
  [40, 36, 4, 12],
  [48, 36, 4, 12],
  [44, 32, 4, 4],
  [48, 32, 4, 4],
  [44, 36, 4, 12],
  [52, 36, 4, 12],
];

const UV_LEFT_ARM_OVERLAY: FaceUVMap = [
  [48, 52, 4, 12],
  [56, 52, 4, 12],
  [52, 48, 4, 4],
  [56, 48, 4, 4],
  [52, 52, 4, 12],
  [60, 52, 4, 12],
];

const UV_RIGHT_LEG_OVERLAY: FaceUVMap = [
  [0, 36, 4, 12],
  [8, 36, 4, 12],
  [4, 32, 4, 4],
  [8, 32, 4, 4],
  [4, 36, 4, 12],
  [12, 36, 4, 12],
];

const UV_LEFT_LEG_OVERLAY: FaceUVMap = [
  [0, 52, 4, 12],
  [8, 52, 4, 12],
  [4, 48, 4, 4],
  [8, 48, 4, 4],
  [4, 52, 4, 12],
  [12, 52, 4, 12],
];

// ═══════════════════════════════════════════════════════════════
// Cape UV layout (64×32 texture)
// ═══════════════════════════════════════════════════════════════

const UV_CAPE: FaceUVMap = [
  [11, 1, 1, 16],   // +X right edge
  [0, 1, 1, 16],    // -X left edge
  [1, 0, 10, 1],    // +Y top edge
  [11, 0, 10, 1],   // -Y bottom edge
  [1, 1, 10, 16],   // +Z front
  [12, 1, 10, 16],  // -Z back
];

// ═══════════════════════════════════════════════════════════════
// Elytra UV layout (64×32 texture)
// ═══════════════════════════════════════════════════════════════

const UV_ELYTRA: FaceUVMap = [
  [34, 2, 2, 20],   // +X right edge
  [22, 2, 2, 20],   // -X left edge
  [24, 0, 10, 2],   // +Y top edge
  [34, 0, 10, 2],   // -Y bottom edge
  [24, 2, 10, 20],  // +Z front (inner wing face)
  [36, 2, 10, 20],  // -Z back (outer wing face)
];

// ═══════════════════════════════════════════════════════════════
// Default Steve Colors (always-visible player body)
// ═══════════════════════════════════════════════════════════════

const STEVE_COLORS = {
  head: '#b58d6e',
  body: '#3ca4c4',
  rightArm: '#b58d6e',
  leftArm: '#b58d6e',
  rightLeg: '#3b3b8e',
  leftLeg: '#3b3b8e',
} as const;

// ═══════════════════════════════════════════════════════════════
// Body part positions — matching MinecraftCapes/minecraft-skin-viewer
// Body center at (0,0,0), head above, legs below
// ═══════════════════════════════════════════════════════════════

const POS_HEAD: [number, number, number] = [0, 10, 0];
const POS_BODY: [number, number, number] = [0, 0, 0];
const POS_RIGHT_ARM: [number, number, number] = [-6, 0, 0];
const POS_LEFT_ARM: [number, number, number] = [6, 0, 0];
const POS_RIGHT_LEG: [number, number, number] = [-2, -12, 0];
const POS_LEFT_LEG: [number, number, number] = [2, -12, 0];

// ═══════════════════════════════════════════════════════════════
// Utility: Create a BoxGeometry with per-face UV mapping
// ═══════════════════════════════════════════════════════════════

function createUVBox(
  width: number,
  height: number,
  depth: number,
  uvMap: FaceUVMap,
  texW: number = SKIN_SIZE,
  texH: number = SKIN_SIZE,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;

  for (let face = 0; face < 6; face++) {
    const [px, py, pw, ph] = uvMap[face];

    const u0 = px / texW;
    const u1 = (px + pw) / texW;
    const vBottom = 1 - (py + ph) / texH;
    const vTop = 1 - py / texH;

    const base = face * 4;

    if (face === 3) {
      // -Y (bottom) face uses [BL, BR, TL, TR] ordering
      uvAttr.setXY(base,     u0, vBottom);
      uvAttr.setXY(base + 1, u1, vBottom);
      uvAttr.setXY(base + 2, u0, vTop);
      uvAttr.setXY(base + 3, u1, vTop);
    } else {
      // All other faces use [TL, TR, BL, BR] ordering
      uvAttr.setXY(base,     u0, vTop);
      uvAttr.setXY(base + 1, u1, vTop);
      uvAttr.setXY(base + 2, u0, vBottom);
      uvAttr.setXY(base + 3, u1, vBottom);
    }
  }

  uvAttr.needsUpdate = true;
  return geo;
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: SkinPart
// Renders the inner skin layer (solid color fallback + texture)
// ═══════════════════════════════════════════════════════════════

function SkinPart({
  geometry,
  skinMaterial,
  fallbackColor,
  position,
}: {
  geometry: THREE.BoxGeometry;
  skinMaterial: THREE.Material | null;
  fallbackColor: string;
  position: [number, number, number];
}) {
  const fallbackMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: fallbackColor,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 1e-5,
    }),
    [fallbackColor],
  );

  return (
    <>
      {/* Base: always-visible solid Steve-colored body */}
      <mesh
        geometry={geometry}
        material={fallbackMat}
        position={position}
      />
      {/* Skin texture overlay when available */}
      {skinMaterial && (
        <mesh
          geometry={geometry}
          material={skinMaterial}
          position={position}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: OverlayPart
// Renders the outer skin layer (+0.5px on each dimension)
// Only visible when a skin texture is loaded
// ═══════════════════════════════════════════════════════════════

function OverlayPart({
  geometry,
  overlayMaterial,
  position,
}: {
  geometry: THREE.BoxGeometry;
  overlayMaterial: THREE.Material | null;
  position: [number, number, number];
}) {
  if (!overlayMaterial) return null;

  return (
    <mesh
      geometry={geometry}
      material={overlayMaterial}
      position={position}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: CapeMesh
// Cape + Elytra rendering matching minecraft-skin-viewer
// ═══════════════════════════════════════════════════════════════

function CapeMesh() {
  const capeRef = useRef<THREE.Mesh>(null);
  const elytraLeftRef = useRef<THREE.Mesh>(null);
  const elytraRightRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const prevURLRef = useRef<string | null>(null);

  const canvasDataURL = useCapeEditorStore((s) => s.canvasDataURL);
  const mode = useCapeEditorStore((s) => s.mode);

  // Cape geometry: 10×16×1 — positioned like minecraft-skin-viewer
  // translate(0, -2.5, 3.5) then rotateX(-0.15) then rotateY(PI)
  const capeGeo = useMemo(() => {
    const geo = createUVBox(10, 16, 1, UV_CAPE, CAPE_TEX_W, CAPE_TEX_H);
    // Match minecraft-skin-viewer: translate so the cape hangs below the attachment point
    geo.translate(0, -2.5, 3.5);
    // Slight backward tilt like a hanging cape
    geo.rotateX(-0.15);
    // Flip to face backward
    geo.rotateY(Math.PI);
    return geo;
  }, []);

  // Elytra wing geometries — matching minecraft-skin-viewer
  const elytraLeftGeo = useMemo(() => {
    const geo = createUVBox(12, 22, 4, UV_ELYTRA, CAPE_TEX_W, CAPE_TEX_H);
    // Match minecraft-skin-viewer: translate(2, -7, -4) then rotate
    geo.translate(2, -7, -4);
    geo.rotateX(0.2617994);  // π/12 = 15°
    geo.rotateZ(0.2617994);  // π/12 = 15°
    return geo;
  }, []);

  const elytraRightGeo = useMemo(() => {
    const geo = createUVBox(12, 22, 4, UV_ELYTRA, CAPE_TEX_W, CAPE_TEX_H);
    // Match minecraft-skin-viewer: scale(-1,1,1), translate(-2, -7, -4) then rotate
    geo.scale(-1, 1, 1);
    geo.translate(-2, -7, -4);
    geo.rotateX(0.2617994);   // π/12 = 15°
    geo.rotateZ(-0.2617994);  // -π/12 = -15°
    return geo;
  }, []);

  // Texture loading effect
  useEffect(() => {
    if (canvasDataURL === prevURLRef.current) return;
    prevURLRef.current = canvasDataURL;

    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

    if (!canvasDataURL) {
      if (materialRef.current) {
        materialRef.current.map = null;
        materialRef.current.needsUpdate = true;
      }
      if (capeRef.current) capeRef.current.visible = false;
      if (elytraLeftRef.current) elytraLeftRef.current.visible = false;
      if (elytraRightRef.current) elytraRightRef.current.visible = false;
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(canvasDataURL, (texture) => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;

      textureRef.current = texture;

      if (!materialRef.current) {
        materialRef.current = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          alphaTest: 1e-5,
          side: THREE.DoubleSide,
        });
        if (capeRef.current) capeRef.current.material = materialRef.current;
        if (elytraLeftRef.current) elytraLeftRef.current.material = materialRef.current;
        if (elytraRightRef.current) elytraRightRef.current.material = materialRef.current;
      } else {
        materialRef.current.map = texture;
        materialRef.current.needsUpdate = true;
      }

      const currentMode = useCapeEditorStore.getState().mode;
      if (capeRef.current) capeRef.current.visible = currentMode === 'cape';
      if (elytraLeftRef.current) elytraLeftRef.current.visible = currentMode === 'elytra';
      if (elytraRightRef.current) elytraRightRef.current.visible = currentMode === 'elytra';
    });
  }, [canvasDataURL]);

  // Update visibility when mode changes
  useEffect(() => {
    const hasTexture = !!textureRef.current;
    if (capeRef.current) capeRef.current.visible = hasTexture && mode === 'cape';
    if (elytraLeftRef.current) elytraLeftRef.current.visible = hasTexture && mode === 'elytra';
    if (elytraRightRef.current) elytraRightRef.current.visible = hasTexture && mode === 'elytra';
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      materialRef.current?.dispose();
    };
  }, []);

  return (
    <>
      {/* Cape: positioned via geometry translation/rotation like minecraft-skin-viewer */}
      <mesh
        ref={capeRef}
        geometry={capeGeo}
        visible={false}
      />
      {/* Elytra: left wing */}
      <mesh
        ref={elytraLeftRef}
        geometry={elytraLeftGeo}
        visible={false}
      />
      {/* Elytra: right wing (mirrored) */}
      <mesh
        ref={elytraRightRef}
        geometry={elytraRightGeo}
        visible={false}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: PlayerModel
// Matches MinecraftCapes/minecraft-skin-viewer rendering:
// - Inner skin layer (always visible, Steve-colored fallback)
// - Outer skin overlay layer (+0.5px, only with skin texture)
// - Cape/Elytra attachment
// ═══════════════════════════════════════════════════════════════

function PlayerModel({ skinTexture }: { skinTexture: THREE.Texture | null }) {
  // Inner skin layer geometries
  const headGeo = useMemo(() => createUVBox(8, 8, 8, UV_HEAD), []);
  const bodyGeo = useMemo(() => createUVBox(8, 12, 4, UV_BODY), []);
  const rightArmGeo = useMemo(() => createUVBox(4, 12, 4, UV_RIGHT_ARM), []);
  const leftArmGeo = useMemo(() => createUVBox(4, 12, 4, UV_LEFT_ARM), []);
  const rightLegGeo = useMemo(() => createUVBox(4, 12, 4, UV_RIGHT_LEG), []);
  const leftLegGeo = useMemo(() => createUVBox(4, 12, 4, UV_LEFT_LEG), []);

  // Outer skin overlay geometries (+0.5px on each dimension)
  const headOverlayGeo = useMemo(() => createUVBox(8.5, 8.5, 8.5, UV_HEAD_OVERLAY), []);
  const bodyOverlayGeo = useMemo(() => createUVBox(8.5, 12.5, 4.5, UV_BODY_OVERLAY), []);
  const rightArmOverlayGeo = useMemo(() => createUVBox(4.5, 12.5, 4.5, UV_RIGHT_ARM_OVERLAY), []);
  const leftArmOverlayGeo = useMemo(() => createUVBox(4.5, 12.5, 4.5, UV_LEFT_ARM_OVERLAY), []);
  const rightLegOverlayGeo = useMemo(() => createUVBox(4.5, 12.5, 4.5, UV_RIGHT_LEG_OVERLAY), []);
  const leftLegOverlayGeo = useMemo(() => createUVBox(4.5, 12.5, 4.5, UV_LEFT_LEG_OVERLAY), []);

  // Inner skin material (front-side only, like minecraft-skin-viewer)
  const skinMaterial = useMemo(() => {
    if (!skinTexture) return null;
    return new THREE.MeshStandardMaterial({
      map: skinTexture,
      transparent: true,
      alphaTest: 1e-5,
      side: THREE.FrontSide,
    });
  }, [skinTexture]);

  // Outer overlay material (same texture, but renders the overlay UV regions)
  const overlayMaterial = useMemo(() => {
    if (!skinTexture) return null;
    return new THREE.MeshStandardMaterial({
      map: skinTexture,
      transparent: true,
      alphaTest: 1e-5,
      side: THREE.DoubleSide,
    });
  }, [skinTexture]);

  // Offset Y to lift player so feet touch the grid:
  // Leg bottom = (-12 - 6) * 0.14 = -2.52, grid at -2.26, offset = 0.26
  return (
    <group scale={MODEL_SCALE} position={[0, 0.26, 0]}>
      {/* Inner skin layer */}
      <SkinPart geometry={headGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.head} position={POS_HEAD} />
      <SkinPart geometry={bodyGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.body} position={POS_BODY} />
      <SkinPart geometry={rightArmGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.rightArm} position={POS_RIGHT_ARM} />
      <SkinPart geometry={leftArmGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.leftArm} position={POS_LEFT_ARM} />
      <SkinPart geometry={rightLegGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.rightLeg} position={POS_RIGHT_LEG} />
      <SkinPart geometry={leftLegGeo} skinMaterial={skinMaterial} fallbackColor={STEVE_COLORS.leftLeg} position={POS_LEFT_LEG} />

      {/* Outer skin overlay layer (+0.5px, only with skin texture) */}
      <OverlayPart geometry={headOverlayGeo} overlayMaterial={overlayMaterial} position={POS_HEAD} />
      <OverlayPart geometry={bodyOverlayGeo} overlayMaterial={overlayMaterial} position={POS_BODY} />
      <OverlayPart geometry={rightArmOverlayGeo} overlayMaterial={overlayMaterial} position={POS_RIGHT_ARM} />
      <OverlayPart geometry={leftArmOverlayGeo} overlayMaterial={overlayMaterial} position={POS_LEFT_ARM} />
      <OverlayPart geometry={rightLegOverlayGeo} overlayMaterial={overlayMaterial} position={POS_RIGHT_LEG} />
      <OverlayPart geometry={leftLegOverlayGeo} overlayMaterial={overlayMaterial} position={POS_LEFT_LEG} />

      {/* Cape / Elytra */}
      <CapeMesh />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: AutoRotateControls
// ═══════════════════════════════════════════════════════════════

function AutoRotateControls() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleInteractionStart = () => {
      controls.autoRotate = false;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        controls.autoRotate = true;
      }, 3000);
    };

    controls.addEventListener('start', handleInteractionStart);

    return () => {
      controls.removeEventListener('start', handleInteractionStart);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      autoRotate
      autoRotateSpeed={1.5}
      enablePan={false}
      minDistance={3}
      maxDistance={12}
      target={[0, 0, 0]}
      maxPolarAngle={Math.PI * 0.85}
      minPolarAngle={Math.PI * 0.05}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: Scene
// ═══════════════════════════════════════════════════════════════

function Scene({ skinTexture }: { skinTexture: THREE.Texture | null }) {
  return (
    <>
      <color attach="background" args={['#78b9ff']} />
      <fog attach="fog" args={['#78b9ff', 15, 30]} />

      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <directionalLight position={[-4, 6, -5]} intensity={0.8} />
      <directionalLight position={[0, 5, -8]} intensity={1.0} />
      <hemisphereLight args={['#b1e1ff', '#4a6741', 0.5]} />

      <PlayerModel skinTexture={skinTexture} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.25, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <Grid
        position={[0, -2.26, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#3d5a3d"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#5a7a5a"
        fadeDistance={12}
        infiniteGrid
        fadeStrength={1.5}
      />

      <AutoRotateControls />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component: CapePreview
// ═══════════════════════════════════════════════════════════════

export function CapePreview() {
  const [skinTexture, setSkinTexture] = useState<THREE.Texture | null>(null);
  const skinTextureRef = useRef<THREE.Texture | null>(null);

  const [isLoadingSkin, setIsLoadingSkin] = useState(false);
  const [inputName, setInputName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [skinLoaded, setSkinLoaded] = useState(false);

  const mode = useCapeEditorStore((s) => s.mode);
  const setMode = useCapeEditorStore((s) => s.setMode);

  const configurePixelTexture = useCallback((texture: THREE.Texture) => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, []);

  const handleLoadSkin = useCallback(() => {
    const name = inputName.trim();
    if (!name) return;

    setIsLoadingSkin(true);
    setLoadError('');

    const loader = new THREE.TextureLoader();
    const url = `/api/crafatar?username=${encodeURIComponent(name)}&type=skin`;

    loader.load(
      url,
      (texture) => {
        configurePixelTexture(texture);
        if (skinTextureRef.current) {
          skinTextureRef.current.dispose();
        }
        skinTextureRef.current = texture;
        setSkinTexture(texture);
        setSkinLoaded(true);
        setIsLoadingSkin(false);
      },
      undefined,
      () => {
        if (skinTextureRef.current) {
          skinTextureRef.current.dispose();
          skinTextureRef.current = null;
        }
        setSkinTexture(null);
        setSkinLoaded(false);
        setLoadError('Failed to load skin. Check the username and try again.');
        setIsLoadingSkin(false);
      },
    );
  }, [inputName, configurePixelTexture]);

  useEffect(() => {
    return () => {
      skinTextureRef.current?.dispose();
    };
  }, []);

  const handleClearSkin = useCallback(() => {
    if (skinTextureRef.current) {
      skinTextureRef.current.dispose();
      skinTextureRef.current = null;
    }
    setSkinTexture(null);
    setSkinLoaded(false);
    setInputName('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleLoadSkin();
    },
    [handleLoadSkin],
  );

  return (
    <div className="relative min-h-0 flex-1 rounded-xl overflow-hidden shadow-lg border border-border bg-background">
      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [0, 0.5, 7],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Scene skinTexture={skinTexture} />
      </Canvas>

      {/* Overlay controls at top of 3D canvas */}
      <div className="absolute top-2 left-2 right-2 flex items-start gap-2 pointer-events-none">
        {/* Username input group */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 border border-white/10">
          <Input
            placeholder="Username..."
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value);
              if (loadError) setLoadError('');
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoadingSkin}
            aria-label="Minecraft username"
            className="h-6 w-24 sm:w-32 border-0 bg-transparent text-xs text-white placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 px-1"
          />
          <Button
            onClick={handleLoadSkin}
            disabled={isLoadingSkin || !inputName.trim()}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-zinc-300 hover:text-white hover:bg-white/10"
            aria-label="Load player skin"
          >
            {isLoadingSkin ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Load'
            )}
          </Button>
          {skinLoaded && !isLoadingSkin && (
            <Button
              onClick={handleClearSkin}
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-400 hover:text-white hover:bg-white/10"
              aria-label="Clear skin"
              title="Clear loaded skin"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Cape/Elytra toggle */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-sm px-1.5 py-1 border border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('cape')}
            className={`h-6 px-2 text-[10px] ${mode === 'cape' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            Cape
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('elytra')}
            className={`h-6 px-2 text-[10px] ${mode === 'elytra' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            Elytra
          </Button>
        </div>
      </div>

      {/* Error message overlay */}
      {loadError && (
        <div className="absolute top-12 left-2 right-2">
          <p className="text-[10px] text-red-300 bg-red-900/60 backdrop-blur-sm rounded px-2 py-1 border border-red-500/20">
            {loadError}
          </p>
        </div>
      )}

      {/* Hint overlay at bottom */}
      <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
        <p className="text-[10px] text-white/50">
          Drag to rotate · Scroll to zoom · Auto-rotates after 3s
        </p>
      </div>
    </div>
  );
}
