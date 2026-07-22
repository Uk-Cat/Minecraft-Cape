import { create } from 'zustand';

export type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'circle' | 'rectangle';

// ═══════════════════════════════════════════════════════════════
// Template Cape Data
// Each face of the cape gets a unique color with darker 1px edges.
// Face regions match the UV_CAPE layout in cape-preview.tsx:
//   [+X right, -X left, +Y top, -Y bottom, +Z front, -Z back]
//
// Layout on the 64×32 canvas:
//   Row 0:  [Left] [  Top (1-10)  ] [Right] [ Bottom (12-21) ]
//   Row 1+: [Left] [ Front (1-10) ] [Right] [ Back   (12-21) ]
// ═══════════════════════════════════════════════════════════════

interface CapeFaceDef {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  edgeColor: string;
  label: string;
}

const TEMPLATE_FACES: CapeFaceDef[] = [
  { x: 1, y: 1, w: 10, h: 16, color: '#DC143C', edgeColor: '#9B1030', label: 'Front' },
  { x: 12, y: 1, w: 10, h: 16, color: '#1565C0', edgeColor: '#0D47A1', label: 'Back' },
  { x: 11, y: 1, w: 1, h: 16, color: '#2E7D32', edgeColor: '#1B5E20', label: 'Right Edge' },
  { x: 0, y: 1, w: 1, h: 16, color: '#7B1FA2', edgeColor: '#4A148C', label: 'Left Edge' },
  { x: 1, y: 0, w: 10, h: 1, color: '#FF8F00', edgeColor: '#E65100', label: 'Top Edge' },
  { x: 11, y: 0, w: 10, h: 1, color: '#00838F', edgeColor: '#006064', label: 'Bottom Edge' },
];

function generateTemplateCape(): (string | null)[][] {
  const grid = createEmptyGrid();
  for (const face of TEMPLATE_FACES) {
    for (let dy = 0; dy < face.h; dy++) {
      for (let dx = 0; dx < face.w; dx++) {
        const px = face.x + dx;
        const py = face.y + dy;
        if (px < 0 || px >= CAPE_WIDTH || py < 0 || py >= CAPE_HEIGHT) continue;
        // Use edge color for border pixels (outermost row/col of the face)
        const isEdge = dx === 0 || dy === 0 || dx === face.w - 1 || dy === face.h - 1;
        grid[py][px] = isEdge ? face.edgeColor : face.color;
      }
    }
  }
  return grid;
}

export { TEMPLATE_FACES, type CapeFaceDef };

export const CAPE_WIDTH = 64;
export const CAPE_HEIGHT = 32;

// Minecraft color palette
export const MINECRAFT_COLORS = [
  '#000000', '#1D1D1D', '#4E4E4E', '#6D6D6D', '#939393', '#BEBEBE', '#E0E0E0', '#FFFFFF',
  '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E', '#F4A460', '#FAEBD7', '#FFE4C4',
  '#FF0000', '#B22222', '#DC143C', '#FF4500', '#FF6347', '#FF7F50', '#FFA07A', '#FA8072',
  '#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#B8860B', '#CD853F', '#F0E68C', '#FAFAD2',
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
  // Show grid overlay
  showGrid: boolean;
  // Player username for Crafatar skin
  playerName: string;
  // Zoom level for the canvas
  zoom: number;
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
  toggleGrid: () => void;
  setPlayerName: (name: string) => void;
  setZoom: (zoom: number) => void;
  clearCanvas: () => void;
  loadTemplateCape: () => void;
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
  showGrid: true,
  playerName: '',
  zoom: 1,
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
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setPlayerName: (name) => set({ playerName: name }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),

  clearCanvas: () => {
    set({ pixels: createEmptyGrid() });
    get().pushHistory();
  },

  loadTemplateCape: () => {
    set({ pixels: generateTemplateCape() });
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