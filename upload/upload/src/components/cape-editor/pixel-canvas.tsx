'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  useCapeEditorStore,
  CAPE_WIDTH,
  CAPE_HEIGHT,
} from './cape-editor-store';
import {
  getLinePixels,
  getCirclePixels,
  getRectanglePixels,
} from './drawing-algorithms';

const BASE_PIXEL_SIZE = 16;

export interface PixelCanvasHandle {
  toggleGuides: () => void;
}

interface GridPos {
  x: number;
  y: number;
}

const CAPE_GUIDES = [
  { x: 1, y: 1, w: 10, h: 16, label: 'Front' },
  { x: 12, y: 1, w: 10, h: 16, label: 'Back' },
  { x: 0, y: 1, w: 1, h: 16, label: 'L' },
  { x: 11, y: 1, w: 1, h: 16, label: 'R' },
  { x: 1, y: 0, w: 10, h: 1, label: 'Top' },
  { x: 11, y: 0, w: 10, h: 1, label: 'Bottom' },
];

const PixelCanvas = forwardRef<PixelCanvasHandle>(
  function PixelCanvas(_props, ref) {
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dataURLTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [showGuides, setShowGuides] = useState(false);

    const isDrawing = useRef(false);
    const isMouseOver = useRef(false);
    const mouseGridPos = useRef<GridPos | null>(null);
    const shapeStart = useRef<GridPos | null>(null);
    const lastDrawnPixel = useRef<GridPos | null>(null);

    // Store subscriptions
    const pixels = useCapeEditorStore((s) => s.pixels);
    const currentTool = useCapeEditorStore((s) => s.currentTool);
    const currentColor = useCapeEditorStore((s) => s.currentColor);
    const showGrid = useCapeEditorStore((s) => s.showGrid);
    const zoom = useCapeEditorStore((s) => s.zoom);
    const setPixel = useCapeEditorStore((s) => s.setPixel);
    const setPixelBatch = useCapeEditorStore((s) => s.setPixelBatch);
    const setColor = useCapeEditorStore((s) => s.setColor);
    const setZoom = useCapeEditorStore((s) => s.setZoom);
    const pushHistory = useCapeEditorStore((s) => s.pushHistory);
    const fillArea = useCapeEditorStore((s) => s.fillArea);
    const eyedrop = useCapeEditorStore((s) => s.eyedrop);
    const undo = useCapeEditorStore((s) => s.undo);
    const redo = useCapeEditorStore((s) => s.redo);
    const setCanvasDataURL = useCapeEditorStore((s) => s.setCanvasDataURL);

    const pixelSize = BASE_PIXEL_SIZE * zoom;
    const canvasWidth = CAPE_WIDTH * pixelSize;
    const canvasHeight = CAPE_HEIGHT * pixelSize;

    // Expose imperative handle for parent to toggle guides
    useImperativeHandle(
      ref,
      () => ({
        toggleGuides: () => setShowGuides((g) => !g),
      }),
      []
    );

    // --- Convert mouse event to grid position ---
    const getGridPos = useCallback(
      (e: React.MouseEvent): GridPos | null => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(
          ((e.clientX - rect.left) / rect.width) * CAPE_WIDTH
        );
        const y = Math.floor(
          ((e.clientY - rect.top) / rect.height) * CAPE_HEIGHT
        );
        if (x < 0 || x >= CAPE_WIDTH || y < 0 || y >= CAPE_HEIGHT) return null;
        return { x, y };
      },
      []
    );

    // --- Render the main canvas (pixels, checkerboard, grid, guides) ---
    const renderMainCanvas = useCallback(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // 1. Checkerboard pattern for transparency indication
      for (let y = 0; y < CAPE_HEIGHT; y++) {
        for (let x = 0; x < CAPE_WIDTH; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#c8c8c8' : '#ffffff';
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }

      // 2. Draw colored pixels on top
      for (let y = 0; y < CAPE_HEIGHT; y++) {
        for (let x = 0; x < CAPE_WIDTH; x++) {
          const color = pixels[y][x];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
          }
        }
      }

      // 3. Grid lines (only when zoomed in enough)
      if (showGrid && pixelSize >= 4) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = 0; x <= CAPE_WIDTH; x++) {
          ctx.moveTo(x * pixelSize, 0);
          ctx.lineTo(x * pixelSize, canvasHeight);
        }
        for (let y = 0; y <= CAPE_HEIGHT; y++) {
          ctx.moveTo(0, y * pixelSize);
          ctx.lineTo(canvasWidth, y * pixelSize);
        }
        ctx.stroke();
      }

      // 4. Cape region guides
      if (showGuides) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
        ctx.lineWidth = 1.5;

        for (const guide of CAPE_GUIDES) {
          ctx.strokeRect(
            guide.x * pixelSize,
            guide.y * pixelSize,
            guide.w * pixelSize,
            guide.h * pixelSize
          );
        }

        // Guide labels
        ctx.setLineDash([]);
        const fontSize = Math.max(9, Math.min(pixelSize * 0.6, 14));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 200, 0, 0.65)';

        for (const guide of CAPE_GUIDES) {
          const cx = (guide.x + guide.w / 2) * pixelSize;
          const cy = (guide.y + guide.h / 2) * pixelSize;
          ctx.fillText(guide.label, cx, cy);
        }

        ctx.restore();
      }
    }, [pixels, zoom, showGrid, showGuides, pixelSize, canvasWidth, canvasHeight]);

    // Re-render main canvas when dependencies change
    useEffect(() => {
      renderMainCanvas();
    }, [renderMainCanvas]);

    // --- Render the overlay canvas (cursor highlight + shape preview) ---
    const renderOverlayCanvas = useCallback(() => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const pos = mouseGridPos.current;

      // Shape preview while dragging (line, circle, rectangle)
      if (
        isDrawing.current &&
        shapeStart.current &&
        pos &&
        ['line', 'circle', 'rectangle'].includes(currentTool)
      ) {
        const start = shapeStart.current;
        let shapePixels: { x: number; y: number }[] = [];

        if (currentTool === 'line') {
          shapePixels = getLinePixels(start.x, start.y, pos.x, pos.y);
        } else if (currentTool === 'circle') {
          const rx = Math.abs(pos.x - start.x);
          const ry = Math.abs(pos.y - start.y);
          shapePixels = getCirclePixels(start.x, start.y, rx, ry, false);
        } else if (currentTool === 'rectangle') {
          shapePixels = getRectanglePixels(start.x, start.y, pos.x, pos.y, false);
        }

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = currentColor;
        for (const p of shapePixels) {
          if (
            p.x >= 0 &&
            p.x < CAPE_WIDTH &&
            p.y >= 0 &&
            p.y < CAPE_HEIGHT
          ) {
            ctx.fillRect(
              p.x * pixelSize,
              p.y * pixelSize,
              pixelSize,
              pixelSize
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      // Cursor highlight (only when mouse is over canvas)
      if (
        isMouseOver.current &&
        pos &&
        pos.x >= 0 &&
        pos.x < CAPE_WIDTH &&
        pos.y >= 0 &&
        pos.y < CAPE_HEIGHT
      ) {
        // Dark outer border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          pos.x * pixelSize - 0.5,
          pos.y * pixelSize - 0.5,
          pixelSize + 1,
          pixelSize + 1
        );
        // Light inner border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          pos.x * pixelSize + 0.5,
          pos.y * pixelSize + 0.5,
          pixelSize - 1,
          pixelSize - 1
        );
      }
    }, [currentTool, currentColor, pixelSize, canvasWidth, canvasHeight]);

    // --- Mouse event handlers ---
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        // Prevent focus loss and text selection
        e.preventDefault();

        const pos = getGridPos(e);
        if (!pos) return;

        mouseGridPos.current = pos;
        isDrawing.current = true;
        lastDrawnPixel.current = null;

        if (currentTool === 'pencil') {
          setPixel(pos.x, pos.y, currentColor);
          lastDrawnPixel.current = pos;
        } else if (currentTool === 'eraser') {
          setPixel(pos.x, pos.y, null);
          lastDrawnPixel.current = pos;
        } else if (currentTool === 'fill') {
          fillArea(pos.x, pos.y, currentColor);
          pushHistory();
        } else if (currentTool === 'eyedropper') {
          const color = eyedrop(pos.x, pos.y);
          if (color) setColor(color);
        } else if (['line', 'circle', 'rectangle'].includes(currentTool)) {
          // Record start point; shape is finalized on mouseup
          shapeStart.current = pos;
        }

        renderOverlayCanvas();
      },
      [
        currentTool,
        currentColor,
        getGridPos,
        pushHistory,
        setPixel,
        fillArea,
        eyedrop,
        setColor,
        renderOverlayCanvas,
      ]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const pos = getGridPos(e);
        mouseGridPos.current = pos;

        if (isDrawing.current && pos) {
          if (currentTool === 'pencil') {
            if (
              !lastDrawnPixel.current ||
              lastDrawnPixel.current.x !== pos.x ||
              lastDrawnPixel.current.y !== pos.y
            ) {
              setPixel(pos.x, pos.y, currentColor);
              lastDrawnPixel.current = pos;
            }
          } else if (currentTool === 'eraser') {
            if (
              !lastDrawnPixel.current ||
              lastDrawnPixel.current.x !== pos.x ||
              lastDrawnPixel.current.y !== pos.y
            ) {
              setPixel(pos.x, pos.y, null);
              lastDrawnPixel.current = pos;
            }
          }
          // Shape tools: preview is handled by renderOverlayCanvas below
        }

        renderOverlayCanvas();
      },
      [currentTool, currentColor, getGridPos, setPixel, renderOverlayCanvas]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent) => {
        if (!isDrawing.current) return;

        const pos = getGridPos(e) || mouseGridPos.current;

        // Finalize shape tools
        if (
          shapeStart.current &&
          pos &&
          ['line', 'circle', 'rectangle'].includes(currentTool)
        ) {
          const start = shapeStart.current;
          let shapePixels: { x: number; y: number }[] = [];

          if (currentTool === 'line') {
            shapePixels = getLinePixels(start.x, start.y, pos.x, pos.y);
          } else if (currentTool === 'circle') {
            const rx = Math.abs(pos.x - start.x);
            const ry = Math.abs(pos.y - start.y);
            shapePixels = getCirclePixels(start.x, start.y, rx, ry, false);
          } else if (currentTool === 'rectangle') {
            shapePixels = getRectanglePixels(
              start.x,
              start.y,
              pos.x,
              pos.y,
              false
            );
          }

          setPixelBatch(
            shapePixels.map((p) => ({ x: p.x, y: p.y, color: currentColor }))
          );
          pushHistory();
        }

        // Save history for pencil/eraser strokes
        if (['pencil', 'eraser'].includes(currentTool)) {
          pushHistory();
        }

        isDrawing.current = false;
        shapeStart.current = null;
        lastDrawnPixel.current = null;

        renderOverlayCanvas();
      },
      [
        currentTool,
        currentColor,
        getGridPos,
        pushHistory,
        setPixelBatch,
        renderOverlayCanvas,
      ]
    );

    const handleMouseEnter = useCallback(() => {
      isMouseOver.current = true;
    }, []);

    const handleMouseLeave = useCallback(() => {
      isMouseOver.current = false;
      renderOverlayCanvas();
    }, [renderOverlayCanvas]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
    }, []);

    // --- Global mouseup: catch releases outside the canvas ---
    useEffect(() => {
      const handleGlobalMouseUp = (e: MouseEvent) => {
        if (!isDrawing.current) return;

        const state = useCapeEditorStore.getState();
        const tool = state.currentTool;
        const color = state.currentColor;
        const endPos = mouseGridPos.current;
        const startPos = shapeStart.current;

        if (
          startPos &&
          endPos &&
          ['line', 'circle', 'rectangle'].includes(tool)
        ) {
          let shapePixels: { x: number; y: number }[] = [];

          if (tool === 'line') {
            shapePixels = getLinePixels(
              startPos.x,
              startPos.y,
              endPos.x,
              endPos.y
            );
          } else if (tool === 'circle') {
            const rx = Math.abs(endPos.x - startPos.x);
            const ry = Math.abs(endPos.y - startPos.y);
            shapePixels = getCirclePixels(
              startPos.x,
              startPos.y,
              rx,
              ry,
              false
            );
          } else if (tool === 'rectangle') {
            shapePixels = getRectanglePixels(
              startPos.x,
              startPos.y,
              endPos.x,
              endPos.y,
              false
            );
          }

          state.setPixelBatch(
            shapePixels.map((p) => ({ x: p.x, y: p.y, color }))
          );
          state.pushHistory();
        }

        // Save history for pencil/eraser strokes released outside canvas
        if (['pencil', 'eraser'].includes(tool)) {
          state.pushHistory();
        }

        isDrawing.current = false;
        shapeStart.current = null;
        lastDrawnPixel.current = null;

        // Clear the overlay
        const canvas = overlayCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // --- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo) ---
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (
          (e.ctrlKey || e.metaKey) &&
          ((e.key === 'z' && e.shiftKey) || e.key === 'y')
        ) {
          e.preventDefault();
          redo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // --- Ctrl+scroll for zoom ---
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const currentZoom = useCapeEditorStore.getState().zoom;
          const delta = e.deltaY > 0 ? -0.25 : 0.25;
          setZoom(currentZoom + delta);
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, [setZoom]);

    // --- Debounced data URL generation for 3D preview ---
    useEffect(() => {
      if (dataURLTimerRef.current) {
        clearTimeout(dataURLTimerRef.current);
      }
      dataURLTimerRef.current = setTimeout(() => {
        const state = useCapeEditorStore.getState();
        const currentPixels = state.pixels;

        const offscreen = document.createElement('canvas');
        offscreen.width = CAPE_WIDTH;
        offscreen.height = CAPE_HEIGHT;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CAPE_WIDTH, CAPE_HEIGHT);
        for (let y = 0; y < CAPE_HEIGHT; y++) {
          for (let x = 0; x < CAPE_WIDTH; x++) {
            const color = currentPixels[y]?.[x];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        setCanvasDataURL(offscreen.toDataURL('image/png'));
      }, 300);

      return () => {
        if (dataURLTimerRef.current) {
          clearTimeout(dataURLTimerRef.current);
        }
      };
    }, [pixels, setCanvasDataURL]);

    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-auto rounded-lg border border-zinc-700 bg-[#1a1a2e] shadow-lg"
        style={{ minHeight: 0 }}
      >
        <div
          className="flex items-center justify-center p-4"
          style={{
            minWidth: canvasWidth,
            minHeight: canvasHeight,
          }}
        >
          <div
            className="relative shrink-0"
            style={{ width: canvasWidth, height: canvasHeight }}
          >
            {/* Main canvas: pixels, checkerboard, grid, guides */}
            <canvas
              ref={mainCanvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="absolute inset-0"
              style={{ imageRendering: 'pixelated' }}
            />
            {/* Overlay canvas: cursor highlight, shape preview */}
            <canvas
              ref={overlayCanvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="absolute inset-0 cursor-crosshair"
              style={{ imageRendering: 'pixelated' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>
      </div>
    );
  }
);

export default PixelCanvas;