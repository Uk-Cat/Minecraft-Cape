'use client';

import React, { useRef, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import PixelCanvas, {
  type PixelCanvasHandle,
} from '@/components/cape-editor/pixel-canvas';
import Toolbar from '@/components/cape-editor/toolbar';
import { useCapeEditorStore, CAPE_WIDTH, CAPE_HEIGHT } from '@/components/cape-editor/cape-editor-store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Upload,
  Diamond,
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
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30" style={{ minHeight: 380 }}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Diamond className="size-8 animate-pulse" />
          <p className="text-sm">Loading 3D Preview...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const canvasRef = useRef<PixelCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGuides, setShowGuides] = useState(false);

  const exportAsPNG = useCapeEditorStore((s) => s.exportAsPNG);
  const clearCanvas = useCapeEditorStore((s) => s.clearCanvas);
  const setPixelBatch = useCapeEditorStore((s) => s.setPixelBatch);
  const pushHistory = useCapeEditorStore((s) => s.pushHistory);

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Diamond className="size-6 text-emerald-400" />
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Cape Creator
            </h1>
          </div>
          <span className="hidden rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 sm:inline-block">
            Minecraft
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            size="sm"
            className="gap-1.5 text-zinc-300 hover:text-white"
            onClick={handleImport}
          >
            <Upload className="size-3.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-zinc-300 hover:text-red-400"
            onClick={handleClear}
          >
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
            onClick={handleExport}
          >
            <Download className="size-3.5" />
            <span>Export PNG</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left Panel: Editor */}
        <div className="flex flex-1 flex-col border-r border-border lg:min-w-0">
          {/* Toolbar */}
          <div className="border-b border-border bg-zinc-950 p-2">
            <Toolbar
              onToggleGuides={handleToggleGuides}
              showGuides={showGuides}
            />
          </div>

          {/* Canvas Area */}
          <div className="flex-1 overflow-hidden p-3">
            <PixelCanvas ref={canvasRef} />
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between border-t border-border bg-zinc-950 px-4 py-1.5 text-xs text-zinc-500">
            <span>64 × 32 pixels</span>
            <span>Ctrl+Z Undo • Ctrl+Shift+Z Redo • Ctrl+Scroll Zoom</span>
          </div>
        </div>

        {/* Right Panel: 3D Preview */}
        <div className="flex w-full min-h-0 flex-col lg:w-[420px] xl:w-[480px]">
          <div className="border-b border-border bg-zinc-950 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              3D Preview
            </h2>
            <p className="text-xs text-zinc-500">
              Enter a username to load a player skin
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
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
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-zinc-950 px-4 py-2 text-center text-xs text-zinc-500">
        Minecraft Cape Creator — Design custom capes with pixel-perfect precision
      </footer>
    </div>
  );
}