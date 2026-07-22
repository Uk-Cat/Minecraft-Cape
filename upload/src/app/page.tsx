'use client';

import React, { useRef, useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import PixelCanvas, {
  type PixelCanvasHandle,
} from '@/components/cape-editor/pixel-canvas';
import Toolbar from '@/components/cape-editor/toolbar';
import { useCapeEditorStore, CAPE_WIDTH, CAPE_HEIGHT, type Tool } from '@/components/cape-editor/cape-editor-store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Download,
  Upload,
  Diamond,
  Trash2,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';

// Dynamically import the 3D preview to avoid SSR issues with Three.js
const CapePreview = dynamic(
  () =>
    import('@/components/cape-editor/cape-preview').then((mod) => ({
      default: mod.CapePreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-muted/30 h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Diamond className="size-8 animate-pulse" />
          <p className="text-sm">Loading 3D Preview...</p>
        </div>
      </div>
    ),
  }
);

const TOOL_SHORTCUTS: Record<string, Tool> = {
  p: 'pencil',
  e: 'eraser',
  g: 'fill',
  i: 'eyedropper',
  l: 'line',
  o: 'circle',
  r: 'rectangle',
};

export default function Home() {
  const canvasRef = useRef<PixelCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [show3D, setShow3D] = useState(true);

  const exportAsPNG = useCapeEditorStore((s) => s.exportAsPNG);
  const clearCanvas = useCapeEditorStore((s) => s.clearCanvas);
  const setPixelBatch = useCapeEditorStore((s) => s.setPixelBatch);
  const pushHistory = useCapeEditorStore((s) => s.pushHistory);
  const undo = useCapeEditorStore((s) => s.undo);
  const redo = useCapeEditorStore((s) => s.redo);
  const setTool = useCapeEditorStore((s) => s.setTool);
  const setZoom = useCapeEditorStore((s) => s.setZoom);
  const setBrushSize = useCapeEditorStore((s) => s.setBrushSize);
  const brushSize = useCapeEditorStore((s) => s.brushSize);

  const handleToggleGuides = useCallback(() => {
    setShowGuides((prev) => !prev);
    canvasRef.current?.toggleGuides();
  }, []);

  const handleExport = useCallback(() => {
    const dataURL = exportAsPNG();
    if (!dataURL) return;

    const link = document.createElement('a');
    link.download = 'minecraft-cape.png';
    link.href = dataURL;
    link.click();
  }, [exportAsPNG]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CAPE_WIDTH;
        tempCanvas.height = CAPE_HEIGHT;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        // Clear and draw the image scaled to cape size
        ctx.clearRect(0, 0, CAPE_WIDTH, CAPE_HEIGHT);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, CAPE_WIDTH, CAPE_HEIGHT);

        // Read pixel data
        const imageData = ctx.getImageData(0, 0, CAPE_WIDTH, CAPE_HEIGHT);
        const data = imageData.data;
        const pixels: { x: number; y: number; color: string | null }[] = [];

        for (let y = 0; y < CAPE_HEIGHT; y++) {
          for (let x = 0; x < CAPE_WIDTH; x++) {
            const i = (y * CAPE_WIDTH + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a > 0) {
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              pixels.push({ x, y, color: hex });
            } else {
              pixels.push({ x, y, color: null });
            }
          }
        }

        setPixelBatch(pixels);
        pushHistory();
      };
      img.src = URL.createObjectURL(file);

      // Reset file input
      e.target.value = '';
    },
    [setPixelBatch, pushHistory]
  );

  const handleClear = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
      clearCanvas();
    }
  }, [clearCanvas]);

  // ═══════════════════════════════════════════════════════════════
  // Global keyboard shortcuts
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl+Shift+Z / Ctrl+Y / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setTool(tool);
          return;
        }
      }

      // +/- keys for zoom
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const currentZoom = useCapeEditorStore.getState().zoom;
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom(currentZoom + 0.25);
        } else if (e.key === '-') {
          e.preventDefault();
          setZoom(currentZoom - 0.25);
        }
      }

      // [ / ] keys for brush size
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '[') {
          e.preventDefault();
          setBrushSize(brushSize - 1);
        } else if (e.key === ']') {
          e.preventDefault();
          setBrushSize(brushSize + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, setTool, setZoom, setBrushSize, brushSize]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-foreground">
      {/* Top Toolbar Bar */}
      <div className="border-b border-border bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5">
          {/* Drawing Toolbar */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <Toolbar onToggleGuides={handleToggleGuides} showGuides={showGuides} />
          </div>

          <Separator orientation="vertical" className="h-6 shrink-0" />

          {/* 3D Toggle + File actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle 3D sidebar */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-8 ${show3D ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setShow3D((prev) => !prev)}
              aria-label={show3D ? 'Hide 3D preview' : 'Show 3D preview'}
              title={show3D ? 'Hide 3D Preview' : 'Show 3D Preview'}
            >
              {show3D ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Import cape texture"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-400 hover:text-white"
              onClick={handleImport}
              aria-label="Import PNG"
              title="Import PNG"
            >
              <Upload className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-400 hover:text-red-400"
              onClick={handleClear}
              aria-label="Clear canvas"
              title="Clear canvas"
            >
              <Trash2 className="size-3.5" />
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-500 text-xs px-2"
              onClick={handleExport}
            >
              <Download className="size-3" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Resizable Canvas + 3D Sidebar */}
      <main className="flex min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel: 2D Pixel Canvas */}
          <ResizablePanel id="canvas-panel" defaultSize={show3D ? 60 : 100} minSize={30} order={1}>
            <div className="flex h-full flex-col">
              <div className="flex-1 overflow-hidden p-2">
                <PixelCanvas ref={canvasRef} />
              </div>
            </div>
          </ResizablePanel>

          {/* Resize Handle + 3D Sidebar (conditionally rendered) */}
          {show3D && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel id="preview-panel" defaultSize={40} minSize={20} order={2} collapsible>
                <div className="flex h-full flex-col p-2">
                  <Suspense
                    fallback={
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Diamond className="size-8 animate-pulse" />
                          <p className="text-sm">Loading 3D Preview...</p>
                        </div>
                      </div>
                    }
                  >
                    <CapePreview />
                  </Suspense>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
