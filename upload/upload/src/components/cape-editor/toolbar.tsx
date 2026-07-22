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
  Trash2,
  Grid3X3,
  Layers,
  ZoomIn,
  ZoomOut,
  LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import {
  useCapeEditorStore,
  MINECRAFT_COLORS,
  type Tool,
} from './cape-editor-store';

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

export default function Toolbar({ onToggleGuides, showGuides }: ToolbarProps) {
  const currentTool = useCapeEditorStore((s) => s.currentTool);
  const currentColor = useCapeEditorStore((s) => s.currentColor);
  const showGrid = useCapeEditorStore((s) => s.showGrid);
  const zoom = useCapeEditorStore((s) => s.zoom);
  const setTool = useCapeEditorStore((s) => s.setTool);
  const setColor = useCapeEditorStore((s) => s.setColor);
  const toggleGrid = useCapeEditorStore((s) => s.toggleGrid);
  const setZoom = useCapeEditorStore((s) => s.setZoom);
  const clearCanvas = useCapeEditorStore((s) => s.clearCanvas);
  const loadTemplateCape = useCapeEditorStore((s) => s.loadTemplateCape);
  const undo = useCapeEditorStore((s) => s.undo);
  const redo = useCapeEditorStore((s) => s.redo);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 backdrop-blur-sm">
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
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }
                  onClick={() => setTool(tool.id)}
                  aria-label={tool.label}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{tool.label}</p>
                <p className="text-xs opacity-70">({tool.shortcut})</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Separator orientation="vertical" className="mx-1.5 h-7" />

      {/* --- Color picker --- */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative p-1.5"
            title="Color Palette"
            aria-label="Color Palette"
          >
            <div
              className="size-5 rounded-sm border-2 border-zinc-500"
              style={{ backgroundColor: currentColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-auto p-3">
          <p className="mb-2 text-xs font-medium text-zinc-400">
            Minecraft Color Palette
          </p>
          <div className="grid grid-cols-8 gap-1">
            {MINECRAFT_COLORS.map((color) => (
              <button
                key={color}
                className="size-6 rounded-sm border border-zinc-600 transition-transform hover:scale-125 hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: color }}
                onClick={() => setColor(color)}
                title={color}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-700 pt-3">
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setColor(e.target.value)}
                className="size-8 cursor-pointer rounded border border-zinc-600 bg-transparent p-0.5"
                aria-label="Custom color picker"
              />
              <span className="font-mono text-xs text-zinc-400">
                {currentColor}
              </span>
            </label>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1.5 h-7" />

      {/* --- Action buttons --- */}
      <div className="flex items-center gap-0.5">
        {/* Undo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
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
              className="text-zinc-400 hover:text-zinc-100"
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
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
              className="text-zinc-400 hover:text-amber-400"
              onClick={loadTemplateCape}
              aria-label="Load template cape"
            >
              <LayoutTemplate className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Template Cape</p>
            <p className="text-xs opacity-70">6-color face guide with edges</p>
          </TooltipContent>
        </Tooltip>

        {/* Clear canvas */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-red-400"
              onClick={clearCanvas}
              aria-label="Clear canvas"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Clear Canvas</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-7" />

        {/* Toggle grid */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={
                showGrid
                  ? 'bg-accent text-accent-foreground'
                  : 'text-zinc-400 hover:text-zinc-100'
              }
              onClick={toggleGrid}
              aria-label="Toggle grid"
            >
              <Grid3X3 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
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
                showGuides
                  ? 'bg-accent text-accent-foreground'
                  : 'text-zinc-400 hover:text-zinc-100'
              }
              onClick={onToggleGuides}
              aria-label="Toggle cape guides"
            >
              <Layers className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Toggle Cape Guides</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-7" />

        {/* Zoom out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => setZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
              aria-label="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom Out</p>
            <p className="text-xs opacity-70">(Ctrl+Scroll)</p>
          </TooltipContent>
        </Tooltip>

        {/* Zoom indicator */}
        <span className="min-w-[3rem] text-center text-xs font-medium text-zinc-400">
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom in */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => setZoom(zoom + 0.25)}
              disabled={zoom >= 4}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom In</p>
            <p className="text-xs opacity-70">(Ctrl+Scroll)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}