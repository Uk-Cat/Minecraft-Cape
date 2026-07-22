'use client';

import React from 'react';
import {
  Pencil,
  Eraser,
  PaintBucket,
  Pipette,
  Minus,
  Circle,
  Square,
  Undo2,
  Redo2,
  Grid3X3,
  Layers,
  ZoomIn,
  ZoomOut,
  LayoutTemplate,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useCapeEditorStore,
  MINECRAFT_COLORS,
  type Tool,
} from './cape-editor-store';
import { CapeFromImageDialog } from './cape-from-image';

interface ToolbarProps {
  onToggleGuides: () => void;
  showGuides?: boolean;
}

const toolDefs: {
  id: Tool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}[] = [
  { id: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'P' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'fill', icon: PaintBucket, label: 'Fill', shortcut: 'G' },
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
];

const BRUSH_SIZE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Toolbar({ onToggleGuides, showGuides }: ToolbarProps) {
  const currentTool = useCapeEditorStore((s) => s.currentTool);
  const currentColor = useCapeEditorStore((s) => s.currentColor);
  const showGrid = useCapeEditorStore((s) => s.showGrid);
  const zoom = useCapeEditorStore((s) => s.zoom);
  const brushSize = useCapeEditorStore((s) => s.brushSize);
  const setTool = useCapeEditorStore((s) => s.setTool);
  const setColor = useCapeEditorStore((s) => s.setColor);
  const toggleGrid = useCapeEditorStore((s) => s.toggleGrid);
  const setZoom = useCapeEditorStore((s) => s.setZoom);
  const setBrushSize = useCapeEditorStore((s) => s.setBrushSize);
  const loadTemplate = useCapeEditorStore((s) => s.loadTemplate);
  const undo = useCapeEditorStore((s) => s.undo);
  const redo = useCapeEditorStore((s) => s.redo);

  const isBrushTool = currentTool === 'pencil' || currentTool === 'eraser';

  return (
    <div className="flex items-center gap-1">
      {/* --- Drawing tool buttons --- */}
      <div className="flex items-center gap-0.5">
        {toolDefs.map((tool) => {
          const Icon = tool.icon;
          const isActive = currentTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={
                    `size-7 ${isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-zinc-400 hover:text-zinc-100'
                    }`
                  }
                  onClick={() => setTool(tool.id)}
                  aria-label={tool.label}
                >
                  <Icon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{tool.label}</p>
                <p className="text-xs opacity-70">({tool.shortcut})</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* --- Brush size (visible only for pencil/eraser) --- */}
      {isBrushTool && (
        <>
          {/* --- Separator --- */}
          <div className="mx-0.5 h-5 w-px bg-zinc-700 shrink-0" />

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-1">
                <PenLine className="size-3 text-zinc-400" />
                <Slider
                  value={[brushSize]}
                  onValueChange={(v) => setBrushSize(v[0])}
                  min={1}
                  max={8}
                  step={1}
                  className="w-16 [&_[role=slider]]:size-3 [&_[role=slider]]:bg-zinc-300 [&_[role=slider]]:border-zinc-500"
                />
                <span className="min-w-[1.25rem] text-center text-[10px] font-medium text-zinc-400 tabular-nums">
                  {brushSize}px
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Brush Size</p>
              <p className="text-xs opacity-70">1–8 px ({isBrushTool ? 'P/E' : ''})</p>
            </TooltipContent>
          </Tooltip>

          {/* Quick size buttons */}
          <div className="flex items-center gap-0">
            {BRUSH_SIZE_OPTIONS.slice(0, 5).map((size) => (
              <Button
                key={size}
                variant="ghost"
                size="icon"
                className={`size-5 text-[9px] tabular-nums ${brushSize === size ? 'bg-accent text-accent-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}
                onClick={() => setBrushSize(size)}
                aria-label={`Brush size ${size}px`}
              >
                {size}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* --- Color picker --- */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 p-0.5"
            title="Color Palette"
            aria-label="Color Palette"
          >
            <div
              className="size-4 rounded-sm border-2 border-zinc-500"
              style={{ backgroundColor: currentColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-auto p-2">
          <p className="mb-1.5 text-[10px] font-medium text-zinc-400">
            Minecraft Colors
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {MINECRAFT_COLORS.map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                className="size-5 rounded-sm border border-zinc-600 transition-transform hover:scale-125 hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: color }}
                onClick={() => setColor(color)}
                title={color}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-zinc-700 pt-2">
            <label className="flex items-center gap-1.5">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setColor(e.target.value)}
                className="size-6 cursor-pointer rounded border border-zinc-600 bg-transparent p-0.5"
                aria-label="Custom color picker"
              />
              <span className="font-mono text-[10px] text-zinc-400">
                {currentColor}
              </span>
            </label>
          </div>
        </PopoverContent>
      </Popover>

      {/* --- Separator --- */}
      <div className="mx-1 h-5 w-px bg-zinc-700 shrink-0" />

      {/* --- Action buttons --- */}
      <div className="flex items-center gap-0.5">
        {/* Undo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-zinc-100"
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Undo</p>
            <p className="text-xs opacity-70">(Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        {/* Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-zinc-100"
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Redo</p>
            <p className="text-xs opacity-70">(Ctrl+Shift+Z)</p>
          </TooltipContent>
        </Tooltip>

        {/* Load template cape */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-amber-400"
              onClick={loadTemplate}
              aria-label="Load cape & elytra template"
            >
              <LayoutTemplate className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Cape & Elytra Template</p>
            <p className="text-xs opacity-70">12-color face guide</p>
          </TooltipContent>
        </Tooltip>

        {/* Cape from Image */}
        <CapeFromImageDialog />
      </div>

      {/* --- Separator --- */}
      <div className="mx-1 h-5 w-px bg-zinc-700 shrink-0" />

      {/* --- Toggle buttons --- */}
      <div className="flex items-center gap-0.5">
        {/* Toggle grid */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={
                `size-7 ${showGrid
                  ? 'bg-accent text-accent-foreground'
                  : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
              onClick={toggleGrid}
              aria-label="Toggle grid"
            >
              <Grid3X3 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Toggle Grid</p>
          </TooltipContent>
        </Tooltip>

        {/* Toggle cape guides */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={
                `size-7 ${showGuides
                  ? 'bg-accent text-accent-foreground'
                  : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
              onClick={onToggleGuides}
              aria-label="Toggle cape guides"
            >
              <Layers className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Toggle Cape Guides</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* --- Separator --- */}
      <div className="mx-1 h-5 w-px bg-zinc-700 shrink-0" />

      {/* --- Zoom controls --- */}
      <div className="flex items-center gap-0.5">
        {/* Zoom out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-zinc-100"
              onClick={() => setZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Zoom Out</p>
          </TooltipContent>
        </Tooltip>

        {/* Zoom indicator */}
        <span className="min-w-[2.5rem] text-center text-[10px] font-medium text-zinc-400">
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom in */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-zinc-100"
              onClick={() => setZoom(zoom + 0.25)}
              disabled={zoom >= 4}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Zoom In</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
