'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ImageIcon, Check, Loader2 } from 'lucide-react';
import { useCapeEditorStore, CAPE_WIDTH, CAPE_HEIGHT } from './cape-editor-store';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

/**
 * CapeFromImageDialog — Upload an image, crop it to 10:16 ratio,
 * and map it onto the cape/elytra texture.
 * Inspired by https://github.com/MinecraftCapes/minecraft-cape-creator
 */
export function CapeFromImageDialog() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [showOnElytra, setShowOnElytra] = useState(true);
  const [autoColor, setAutoColor] = useState(true);
  const [manualColor, setManualColor] = useState('#FF0000');
  const [isProcessing, setIsProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewDataURL, setPreviewDataURL] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updatePreviewRef = useRef<() => void>(() => {});

  const setPixelBatch = useCapeEditorStore((s) => s.setPixelBatch);
  const pushHistory = useCapeEditorStore((s) => s.pushHistory);

  // Calculate average color from image data
  const calculateAverageColor = useCallback((imageData: ImageData): string => {
    const { data } = imageData;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 128) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }
    if (count === 0) return '#000000';
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }, []);

  // Update the preview based on current crop + settings
  const updatePreview = useCallback(() => {
    if (!cropperRef.current) return;

    const croppedCanvas = cropperRef.current.getCroppedCanvas({
      width: 10,
      height: 16,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    });

    if (!croppedCanvas) return;

    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return;
    const croppedImageData = ctx.getImageData(0, 0, 10, 16);
    const avgColor = calculateAverageColor(croppedImageData);
    const fillColor = autoColor ? avgColor : manualColor;

    // Build the full cape texture
    const offscreen = document.createElement('canvas');
    offscreen.width = CAPE_WIDTH;
    offscreen.height = CAPE_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, CAPE_WIDTH, CAPE_HEIGHT);
    offCtx.imageSmoothingEnabled = false;

    // Draw cropped image onto the front face (x=1, y=1, w=10, h=16)
    offCtx.drawImage(croppedCanvas, 1, 1, 10, 16);

    // Elytra: draw on the RIGHT wing (x=36, y=2, w=10, h=20)
    // Minecraft mirrors the right wing for both wings in-game.
    if (showOnElytra) {
      offCtx.drawImage(croppedCanvas, 36, 2, 10, 20);
    }

    // Fill edges and back with the derived color
    offCtx.fillStyle = fillColor;

    // Cape outlines/back
    offCtx.fillRect(0, 1, 1, 16);   // Left edge
    offCtx.fillRect(1, 0, 10, 1);   // Top edge
    offCtx.fillRect(11, 1, 1, 16);  // Right edge
    offCtx.fillRect(11, 0, 10, 1);  // Bottom edge
    offCtx.fillRect(12, 1, 10, 16); // Back face

    if (!showOnElytra) {
      // Fill the right wing with color when no elytra image
      offCtx.fillRect(36, 2, 10, 20);
    }

    // Elytra extra fills (edges & structural parts)
    offCtx.fillRect(22, 11, 1, 11); // Inside Wing
    offCtx.fillRect(31, 0, 3, 1);   // Shoulder
    offCtx.fillRect(32, 1, 2, 1);   // Shoulder
    offCtx.fillRect(34, 0, 6, 1);   // Bottom
    offCtx.fillRect(34, 2, 1, 2);   // Outside Wing
    offCtx.fillRect(35, 2, 1, 9);   // Outside Wing

    // Remove stray elytra pixels (wing shape cuts)
    offCtx.clearRect(36, 16, 1, 6);  // Bottom Left
    offCtx.clearRect(37, 19, 1, 3);  // Bottom Left
    offCtx.clearRect(38, 21, 1, 1);  // Bottom Left
    offCtx.clearRect(42, 2, 1, 1);   // Top Right
    offCtx.clearRect(43, 2, 1, 2);   // Top Right
    offCtx.clearRect(44, 2, 1, 5);   // Top Right
    offCtx.clearRect(45, 2, 1, 9);   // Top Right

    setPreviewDataURL(offscreen.toDataURL('image/png'));
  }, [autoColor, manualColor, showOnElytra, calculateAverageColor]);

  // Keep ref in sync so cropper callbacks can use the latest version
  useEffect(() => {
    updatePreviewRef.current = updatePreview;
  }, [updatePreview]);

  // Initialize / replace cropper when image changes
  useEffect(() => {
    if (!imageSrc || !imageRef.current) return;

    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }

    cropperRef.current = new Cropper(imageRef.current, {
      aspectRatio: 10 / 16,
      guides: false,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      responsive: true,
      background: true,
      cropend: () => updatePreviewRef.current(),
      ready: () => updatePreviewRef.current(),
    });
  }, [imageSrc]);

  // Cleanup cropper on close
  useEffect(() => {
    if (!open && cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
  }, [open]);

  // Re-update preview when settings change (async to avoid cascading render warning)
  useEffect(() => {
    if (cropperRef.current && imageSrc) {
      const timer = setTimeout(() => updatePreview(), 0);
      return () => clearTimeout(timer);
    }
  }, [autoColor, manualColor, showOnElytra, updatePreview, imageSrc]);

  // Handle image upload
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setPreviewDataURL(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // Apply the generated cape texture to the editor canvas
  const handleApply = useCallback(() => {
    if (!previewDataURL) return;
    setIsProcessing(true);

    const img = new window.Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = CAPE_WIDTH;
      tempCanvas.height = CAPE_HEIGHT;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, CAPE_WIDTH, CAPE_HEIGHT);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, CAPE_WIDTH, CAPE_HEIGHT);

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

          if (a > 128) {
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            pixels.push({ x, y, color: hex });
          } else {
            pixels.push({ x, y, color: null });
          }
        }
      }

      setPixelBatch(pixels);
      pushHistory();
      setIsProcessing(false);
      setOpen(false);

      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
      setImageSrc(null);
      setPreviewDataURL(null);
    };
    img.src = previewDataURL;
  }, [previewDataURL, setPixelBatch, pushHistory]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    setImageSrc(null);
    setPreviewDataURL(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleClose(); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-zinc-400 hover:text-zinc-100"
          aria-label="Cape from Image"
          title="Cape from Image"
        >
          <ImageIcon className="size-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Cape from Image</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Upload an image, crop it, and map it onto your cape and elytra texture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image upload */}
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-zinc-700 text-zinc-300 hover:text-zinc-100"
              >
                <ImageIcon className="size-4 mr-2" />
                Select Image
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cropper area */}
              <div className="max-h-[300px] overflow-hidden rounded-lg border border-zinc-700 bg-black">
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Source image for cape"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              {/* Change image button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs"
                >
                  Change Image
                </Button>
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-3 border-t border-zinc-800 pt-3">
            {/* Show on Elytra toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={showOnElytra}
                onCheckedChange={setShowOnElytra}
                aria-label="Show on Elytra"
              />
              <Label className="text-sm text-zinc-300 cursor-pointer">Show on Elytra</Label>
            </div>

            {/* Color mode */}
            <div className="flex items-center gap-3">
              <Switch
                checked={autoColor}
                onCheckedChange={setAutoColor}
                aria-label="Auto color"
              />
              <Label className="text-sm text-zinc-300 cursor-pointer">Auto Color (average from image)</Label>
              {!autoColor && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="color"
                    value={manualColor}
                    onChange={(e) => setManualColor(e.target.value)}
                    className="size-6 cursor-pointer rounded border border-zinc-600 bg-transparent p-0.5"
                    aria-label="Manual color"
                  />
                  <span className="font-mono text-[10px] text-zinc-400">{manualColor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewDataURL && (
            <div className="border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-400 mb-2">Preview (64×32 cape texture)</p>
              <div className="flex items-center gap-3">
                <div
                  className="border border-zinc-700 rounded bg-black overflow-hidden"
                  style={{ width: 192, height: 96 }}
                >
                  <img
                    src={previewDataURL}
                    alt="Cape texture preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  Front face gets the cropped image.<br />
                  Edges, top, bottom, and back are filled with the {autoColor ? 'average' : 'selected'} color.<br />
                  {showOnElytra ? 'Elytra also shows the cropped image.' : 'Elytra is filled with the derived color.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:text-zinc-100">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleApply}
            disabled={!previewDataURL || isProcessing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isProcessing ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Check className="size-4 mr-1" />
            )}
            Apply to Canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
