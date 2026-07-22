import { create } from 'zustand';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'circle' | 'rectangle';
export type EditorMode = 'cape' | 'elytra';

// ═══════════════════════════════════════════════════════════════
// Template Data — Both Cape AND Elytra on the same 64×32 texture
//
// Cape layout (left side, x=0-21):
//   Row 0:  [Left] [  Top (1-10)  ] [Right] [ Bottom (11-20) ]
//   Row 1+: [Left] [ Front (1-10) ] [Right] [ Back   (12-21) ]
//
// Elytra layout (right side, x=22+, based on MinecraftCapes reference):
//   Row 0:  [  Top (24-33) ] [ Bottom (34-43) ]
//   Row 2+: [L Edge] [ Front (24-33) ] [R Edge] [ Back (36-45) ]
// ═══════════════════════════════════════════════════════════════

interface CapeFaceDef {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  edgeColor: string;
  label: string;
  edgeWidth: number;
}

// Cape faces (1px edges)
const TEMPLATE_CAPE_FACES: CapeFaceDef[] = [
  { x: 1, y: 1, w: 10, h: 16, color: '#DC143C', edgeColor: '#9B1030', label: 'Front', edgeWidth: 1 },
  { x: 12, y: 1, w: 10, h: 16, color: '#1565C0', edgeColor: '#0D47A1', label: 'Back', edgeWidth: 1 },
  { x: 11, y: 1, w: 1, h: 16, color: '#2E7D32', edgeColor: '#1B5E20', label: 'Right Edge', edgeWidth: 1 },
  { x: 0, y: 1, w: 1, h: 16, color: '#7B1FA2', edgeColor: '#4A148C', label: 'Left Edge', edgeWidth: 1 },
  { x: 1, y: 0, w: 10, h: 1, color: '#FF8F00', edgeColor: '#E65100', label: 'Top Edge', edgeWidth: 1 },
  { x: 11, y: 0, w: 10, h: 1, color: '#00838F', edgeColor: '#006064', label: 'Bottom Edge', edgeWidth: 1 },
];

// Elytra faces (2px edges, positioned at x=22+ per MinecraftCapes reference)
const TEMPLATE_ELYTRA_FACES: CapeFaceDef[] = [
  { x: 24, y: 2, w: 10, h: 20, color: '#E91E63', edgeColor: '#AD1457', label: 'Elytra Front', edgeWidth: 2 },
  { x: 36, y: 2, w: 10, h: 20, color: '#283593', edgeColor: '#1A237E', label: 'Elytra Back', edgeWidth: 2 },
  { x: 34, y: 2, w: 2, h: 20, color: '#E64A19', edgeColor: '#BF360C', label: 'Elytra R Edge', edgeWidth: 2 },
  { x: 22, y: 2, w: 2, h: 20, color: '#689F38', edgeColor: '#33691E', label: 'Elytra L Edge', edgeWidth: 2 },
  { x: 24, y: 0, w: 10, h: 2, color: '#F9A825', edgeColor: '#F57F17', label: 'Elytra Top', edgeWidth: 2 },
  { x: 34, y: 0, w: 10, h: 2, color: '#0097A7', edgeColor: '#00695C', label: 'Elytra Bottom', edgeWidth: 2 },
];

function generateTemplate(): (string | null)[][] {
  const grid = createEmptyGrid();
  const allFaces = [...TEMPLATE_CAPE_FACES, ...TEMPLATE_ELYTRA_FACES];
  for (const face of allFaces) {
    for (let dy = 0; dy < face.h; dy++) {
      for (let dx = 0; dx < face.w; dx++) {
        const px = face.x + dx;
        const py = face.y + dy;
        if (px < 0 || px >= CAPE_WIDTH || py < 0 || py >= CAPE_HEIGHT) continue;
        const isEdge = dx < face.edgeWidth || dy < face.edgeWidth || dx >= face.w - face.edgeWidth || dy >= face.h - face.edgeWidth;
        grid[py][px] = isEdge ? face.edgeColor : face.color;
      }
    }
  }
  return grid;
}

export { TEMPLATE_CAPE_FACES, TEMPLATE_ELYTRA_FACES, type CapeFaceDef };

export const CAPE_WIDTH = 64;
export const CAPE_HEIGHT = 32;

// Minecraft color palette
export const MINECRAFT_COLORS = [
  '#000000', '#1D1D1D', '#4E4E4E', '#6D6D6D', '#939393', '#BEBEBE', '#E0E0E0', '#FFFFFF',
  '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E', '#F4A460', '#FAEBD7', '#FFE4C4',
  '#FF0000', '#B22222', '#DC143C', '#FF4500', '#FF6347', '#FF7F50', '#FFA07A', '#FA8072',
  '#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#B8860B', '#D2B48C', '#F0E68C', '#FAFAD2',
  '#00FF00', '#32CD32', '#228B22', '#006400', '#2E8B57', '#3CB371', '#66CDAA', '#8FBC8F',
  '#0000FF', '#0000CD', '#191970', '#000080', '#4169E1', '#6495ED', '#87CEEB', '#ADD8E6',
  '#4B0082', '#800080', '#9400D3', '#9932CC', '#BA55D3', '#DA70D6', '#EE82EE', '#FF00FF',
  '#FF1493', '#C71585', '#DB7093', '#FFB6C1', '#FF69B4', '#FFC0CB', '#F08080', '#E9967A',
];

interface CapeEditorState {
  // Pixel data - 64x32 grid, null = transparent
  pixels: (string | null)[][];
  // Current drawing color
  currentColor: string;
  // Current tool
  currentTool: Tool;
  // Brush size for pencil/eraser (1-8 px square)
  brushSize: number;
  // Show grid overlay
  showGrid: boolean;
  // Player username for Crafatar skin
  playerName: string;
  // Zoom level for the canvas
  zoom: number;
  // Editor mode: cape or elytra (only affects 3D preview visibility)
  mode: EditorMode;
  // Undo/Redo
  history: (string | null)[][];
  historyIndex: number;
  // Canvas image data as data URL for 3D preview
  canvasDataURL: string | null;
  setCanvasDataURL: (url: string | null) => void;

  // Actions
  setPixel: (x: number, y: number, color: string | null) => void;
  setPixelBatch: (pixels: { x: number; y: number; color: string | null }[]) => void;
  setColor: (color: string) => void;
  setTool: (tool: Tool) => void;
  setBrushSize: (size: number) => void;
  toggleGrid: () => void;
  setPlayerName: (name: string) => void;
  setZoom: (zoom: number) => void;
  setMode: (mode: EditorMode) => void;
  clearCanvas: () => void;
  loadTemplate: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  fillArea: (startX: number, startY: number, newColor: string | null) => void;
  eyedrop: (x: number, y: number) => string | null;
  exportAsPNG: () => string | null;
}

function createEmptyGrid(): (string | null)[][] {
  return Array.from({ length: CAPE_HEIGHT }, () =>
    Array.from({ length: CAPE_WIDTH }, () => null)
  );
}

function cloneGrid(grid: (string | null)[][]): (string | null)[][] {
  return grid.map(row => [...row]);
}

export const useCapeEditorStore = create<CapeEditorState>((set, get) => ({
  pixels: createEmptyGrid(),
  currentColor: '#FF0000',
  currentTool: 'pencil',
  brushSize: 1,
  showGrid: true,
  playerName: '',
  zoom: 1,
  mode: 'cape',
  history: [createEmptyGrid()],
  historyIndex: 0,
  canvasDataURL: null,
  setCanvasDataURL: (url) => set({ canvasDataURL: url }),

  setPixel: (x, y, color) => {
    const state = get();
    if (x < 0 || x >= CAPE_WIDTH || y < 0 || y >= CAPE_HEIGHT) return;
    const newPixels = cloneGrid(state.pixels);
    newPixels[y][x] = color;
    set({ pixels: newPixels });
  },

  setPixelBatch: (pixelUpdates) => {
    const state = get();
    const newPixels = cloneGrid(state.pixels);
    for (const { x, y, color } of pixelUpdates) {
      if (x >= 0 && x < CAPE_WIDTH && y >= 0 && y < CAPE_HEIGHT) {
        newPixels[y][x] = color;
      }
    }
    set({ pixels: newPixels });
  },

  setColor: (color) => set({ currentColor: color }),
  setTool: (tool) => set({ currentTool: tool }),
  setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(8, size)) }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setPlayerName: (name) => set({ playerName: name }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setMode: (mode) => set({ mode }),

  clearCanvas: () => {
    set({ pixels: createEmptyGrid() });
    get().pushHistory();
  },

  loadTemplate: () => {
    set({ pixels: generateTemplate() });
    get().pushHistory();
  },

  pushHistory: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(cloneGrid(state.pixels));
    // Keep max 100 history entries
    if (newHistory.length > 100) {
      newHistory.shift();
    }
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        pixels: cloneGrid(state.history[newIndex]),
        historyIndex: newIndex,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        pixels: cloneGrid(state.history[newIndex]),
        historyIndex: newIndex,
      });
    }
  },

  fillArea: (startX, startY, newColor) => {
    const state = get();
    if (startX < 0 || startX >= CAPE_WIDTH || startY < 0 || startY >= CAPE_HEIGHT) return;

    const targetColor = state.pixels[startY][startX];
    if (targetColor === newColor) return;

    const newPixels = cloneGrid(state.pixels);
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      if (x < 0 || x >= CAPE_WIDTH || y < 0 || y >= CAPE_HEIGHT) continue;
      if (newPixels[y][x] !== targetColor) continue;

      visited.add(key);
      newPixels[y][x] = newColor;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    set({ pixels: newPixels });
  },

  eyedrop: (x, y) => {
    const state = get();
    if (x < 0 || x >= CAPE_WIDTH || y < 0 || y >= CAPE_HEIGHT) return null;
    return state.pixels[y][x];
  },

  exportAsPNG: () => {
    const state = get();
    const canvas = document.createElement('canvas');
    canvas.width = CAPE_WIDTH;
    canvas.height = CAPE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill with transparent
    ctx.clearRect(0, 0, CAPE_WIDTH, CAPE_HEIGHT);

    for (let y = 0; y < CAPE_HEIGHT; y++) {
      for (let x = 0; x < CAPE_WIDTH; x++) {
        const color = state.pixels[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    return canvas.toDataURL('image/png');
  },
}));
