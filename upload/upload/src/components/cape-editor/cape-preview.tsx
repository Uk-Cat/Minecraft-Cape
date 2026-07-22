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
import { Loader2 } from 'lucide-react';

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
// Format: [+x right, -x left, +y top, -y bottom, +z front, -z back]
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

// Cape UV layout (64×32 texture)
// Layout:
//   Row 0:  [Left] [  Top (1-10)  ] [ Bottom (11-20) ]
//   Row 1+: [Left] [ Front (1-10) ] [Right] [ Back (12-21) ]
const UV_CAPE: FaceUVMap = [
  [11, 1, 1, 16],   // right edge
  [0, 1, 1, 16],    // left edge
  [1, 0, 10, 1],    // top edge
  [11, 0, 10, 1],   // bottom edge (right of Top, above Back)
  [1, 1, 10, 16],   // front
  [12, 1, 10, 16],  // back
];

// ═══════════════════════════════════════════════════════════════
// Default Steve Colors (fallback when no skin is loaded)
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

    // Convert pixel coords to UV space (0–1), flipping Y for OpenGL
    const u0 = px / texW;
    const u1 = (px + pw) / texW;
    const vBottom = 1 - (py + ph) / texH; // bottom of texture region
    const vTop = 1 - py / texH;            // top of texture region

    // Three.js BoxGeometry vertex order per face:
    //   base+0 = top-left,  base+1 = top-right,
    //   base+2 = bottom-left, base+3 = bottom-right
    // Faces: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
    // The -X and -Z faces have their U-axis mirrored by the geometry,
    // so we must flip U to prevent the texture from appearing mirrored.
    const flipU = face === 1 || face === 5;
    const lu0 = flipU ? u1 : u0;
    const lu1 = flipU ? u0 : u1;

    const base = face * 4;
    uvAttr.setXY(base,     lu0, vTop);    // top-left
    uvAttr.setXY(base + 1, lu1, vTop);    // top-right
    uvAttr.setXY(base + 2, lu0, vBottom); // bottom-left
    uvAttr.setXY(base + 3, lu1, vBottom); // bottom-right
  }

  uvAttr.needsUpdate = true;
  return geo;
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: BodyPart
// ═══════════════════════════════════════════════════════════════

function BodyPart({
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
    () => new THREE.MeshLambertMaterial({ color: fallbackColor }),
    [fallbackColor],
  );

  return (
    <mesh
      geometry={geometry}
      material={skinMaterial ?? fallbackMat}
      position={position}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: CapeMesh
// Manages its own texture from the store without React state
// to avoid synchronous setState in effects.
// ═══════════════════════════════════════════════════════════════

function CapeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const materialRef = useRef<THREE.MeshLambertMaterial | null>(null);
  const prevURLRef = useRef<string | null>(null);

  const canvasDataURL = useCapeEditorStore((s) => s.canvasDataURL);

  const capeGeo = useMemo(
    () => createUVBox(10, 16, 1, UV_CAPE, CAPE_TEX_W, CAPE_TEX_H),
    [],
  );

  useEffect(() => {
    // Skip if the data URL hasn't actually changed
    if (canvasDataURL === prevURLRef.current) return;
    prevURLRef.current = canvasDataURL;

    // Dispose previous texture
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }

    // No data URL → hide cape, clear material map
    if (!canvasDataURL) {
      if (materialRef.current) {
        materialRef.current.map = null;
        materialRef.current.needsUpdate = true;
      }
      if (meshRef.current) {
        meshRef.current.visible = false;
      }
      return;
    }

    // Load new texture asynchronously
    const loader = new THREE.TextureLoader();
    loader.load(canvasDataURL, (texture) => {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;

      textureRef.current = texture;

      // Create or update the material
      if (!materialRef.current) {
        materialRef.current = new THREE.MeshLambertMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        });
        if (meshRef.current) {
          meshRef.current.material = materialRef.current;
        }
      } else {
        materialRef.current.map = texture;
        materialRef.current.needsUpdate = true;
      }

      if (meshRef.current) {
        meshRef.current.visible = true;
      }
    });
  }, [canvasDataURL]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      materialRef.current?.dispose();
    };
  }, []);

  return (
    <mesh
      ref={meshRef}
      geometry={capeGeo}
      position={[0, 0, -3]}
      rotation={[0.05, 0, 0]}
      visible={false}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: PlayerModel
// ═══════════════════════════════════════════════════════════════

function PlayerModel({ skinTexture }: { skinTexture: THREE.Texture | null }) {
  // Create UV-mapped geometries (stable, created once)
  const headGeo = useMemo(() => createUVBox(8, 8, 8, UV_HEAD), []);
  const bodyGeo = useMemo(() => createUVBox(8, 12, 4, UV_BODY), []);
  const rightArmGeo = useMemo(() => createUVBox(4, 12, 4, UV_RIGHT_ARM), []);
  const leftArmGeo = useMemo(() => createUVBox(4, 12, 4, UV_LEFT_ARM), []);
  const rightLegGeo = useMemo(() => createUVBox(4, 12, 4, UV_RIGHT_LEG), []);
  const leftLegGeo = useMemo(() => createUVBox(4, 12, 4, UV_LEFT_LEG), []);

  // Shared skin material (used by all body parts when skin is loaded)
  const skinMaterial = useMemo(() => {
    if (!skinTexture) return null;
    return new THREE.MeshLambertMaterial({
      map: skinTexture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.FrontSide,
    });
  }, [skinTexture]);

  // Positions are in Minecraft pixel coords, with Y centered (subtracted 16)
  // so the model's midpoint (y=16) becomes y=0
  return (
    <group scale={MODEL_SCALE}>
      {/* Head: 8×8×8, original position (0, 28, 0) → centered (0, 12, 0) */}
      <BodyPart
        geometry={headGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.head}
        position={[0, 12, 0]}
      />

      {/* Body: 8×12×4, original (0, 18, 0) → centered (0, 2, 0) */}
      <BodyPart
        geometry={bodyGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.body}
        position={[0, 2, 0]}
      />

      {/* Right Arm: 4×12×4, original (-6, 18, 0) → centered (-6, 2, 0) */}
      <BodyPart
        geometry={rightArmGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.rightArm}
        position={[-6, 2, 0]}
      />

      {/* Left Arm: 4×12×4, original (6, 18, 0) → centered (6, 2, 0) */}
      <BodyPart
        geometry={leftArmGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.leftArm}
        position={[6, 2, 0]}
      />

      {/* Right Leg: 4×12×4, original (-2, 6, 0) → centered (-2, -10, 0) */}
      <BodyPart
        geometry={rightLegGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.rightLeg}
        position={[-2, -10, 0]}
      />

      {/* Left Leg: 4×12×4, original (2, 6, 0) → centered (2, -10, 0) */}
      <BodyPart
        geometry={leftLegGeo}
        skinMaterial={skinMaterial}
        fallbackColor={STEVE_COLORS.leftLeg}
        position={[2, -10, 0]}
      />

      {/* Cape: 10×16×1, hangs from shoulders (Y=8) behind the body */}
      <CapeMesh />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-Component: AutoRotateControls
// Auto-rotates by default, pauses on user interaction, resumes after 3s
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
// Contains all 3D scene content (lighting, model, ground, controls)
// ═══════════════════════════════════════════════════════════════

function Scene({ skinTexture }: { skinTexture: THREE.Texture | null }) {
  return (
    <>
      {/* Sky-blue background */}
      <color attach="background" args={['#78b9ff']} />
      {/* Fog for depth */}
      <fog attach="fog" args={['#78b9ff', 15, 30]} />

      {/* Lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} />
      <directionalLight position={[-4, 6, -5]} intensity={0.3} />
      <hemisphereLight args={['#b1e1ff', '#4a6741', 0.2]} />

      {/* Player Model (includes cape via CapeMesh) */}
      <PlayerModel skinTexture={skinTexture} />

      {/* Ground shadow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.25, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle ground grid */}
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

      {/* Camera Controls */}
      <AutoRotateControls />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component: CapePreview
// ═══════════════════════════════════════════════════════════════

export function CapePreview() {
  // Skin texture state (managed here for UI feedback)
  const [skinTexture, setSkinTexture] = useState<THREE.Texture | null>(null);
  const skinTextureRef = useRef<THREE.Texture | null>(null);

  // UI state
  const [isLoadingSkin, setIsLoadingSkin] = useState(false);
  const [inputName, setInputName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [skinLoaded, setSkinLoaded] = useState(false);

  // Helper: configure a texture for pixel-art rendering
  const configurePixelTexture = useCallback((texture: THREE.Texture) => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, []);

  // Load skin texture from Crafatar API (triggered by user action, not an effect)
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

  // Cleanup skin texture on unmount
  useEffect(() => {
    return () => {
      skinTextureRef.current?.dispose();
    };
  }, []);

  // Clear skin handler
  const handleClearSkin = useCallback(() => {
    if (skinTextureRef.current) {
      skinTextureRef.current.dispose();
      skinTextureRef.current = null;
    }
    setSkinTexture(null);
    setSkinLoaded(false);
    setInputName('');
  }, []);

  // Keyboard handler for Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleLoadSkin();
    },
    [handleLoadSkin],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Player Name Input */}
      <div className="flex shrink-0 gap-2 items-center">
        <div className="flex-1">
          <Input
            placeholder="Enter Minecraft username..."
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value);
              if (loadError) setLoadError('');
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoadingSkin}
            aria-label="Minecraft username"
          />
        </div>
        <Button
          onClick={handleLoadSkin}
          disabled={isLoadingSkin || !inputName.trim()}
          variant="default"
          size="default"
          aria-label="Load player skin"
        >
          {isLoadingSkin ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Loading...</span>
            </>
          ) : (
            'Load Skin'
          )}
        </Button>
        {skinLoaded && !isLoadingSkin && (
          <Button
            onClick={handleClearSkin}
            variant="ghost"
            size="icon"
            aria-label="Clear skin"
            title="Clear loaded skin"
          >
            <span className="text-xs leading-none">✕</span>
          </Button>
        )}
      </div>

      {/* Error message */}
      {loadError && (
        <p className="text-sm text-destructive px-1 shrink-0">{loadError}</p>
      )}

      {/* 3D Canvas — fills remaining vertical space */}
      <div className="relative min-h-0 flex-1 rounded-xl overflow-hidden shadow-lg border border-border bg-background">
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
      </div>

      {/* Hint text */}
      <p className="shrink-0 text-xs text-muted-foreground text-center">
        Drag to rotate · Scroll to zoom · Auto-rotates after 3 s
      </p>
    </div>
  );
}