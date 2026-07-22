package net.minecraftcapes.gui;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

public class CapeCanvasWidget extends AbstractWidget {
    private static final int CANVAS_WIDTH = 64;
    private static final int CANVAS_HEIGHT = 32;
    private static final int MIN_SCALE = 4;
    private static final int MAX_SCALE = 16;

    private final NativeImage image;
    private int scale = 8;
    private boolean mirrorMode = false;
    private Tool currentTool = Tool.PENCIL;
    private int selectedColor = 0xFFFFFFFF;
    private boolean dragging = false;
    private int lastPixelX = -1;
    private int lastPixelY = -1;

    private final List<int[]> undoStack = new ArrayList<>();
    private final List<int[]> redoStack = new ArrayList<>();

    private Runnable onImageChanged;

    public enum Tool {
        PENCIL, ERASER, FILL, EYEDROPPER
    }

    public CapeCanvasWidget(int x, int y) {
        super(x, y, CANVAS_WIDTH * 8, CANVAS_HEIGHT * 8, Component.empty());
        this.image = new NativeImage(CANVAS_WIDTH, CANVAS_HEIGHT, true);
        clearImage();
        saveUndoState();
    }

    public void setOnImageChanged(Runnable onImageChanged) {
        this.onImageChanged = onImageChanged;
    }

    public NativeImage getImage() {
        return image;
    }

    public void loadImage(NativeImage newImage) {
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                image.setPixel(x, y, newImage.getPixel(x, y));
            }
        }
        undoStack.clear();
        redoStack.clear();
        saveUndoState();
        if (onImageChanged != null) onImageChanged.run();
    }

    public void clearImage() {
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                image.setPixel(x, y, 0);
            }
        }
    }

    private void saveUndoState() {
        int[] pixels = new int[CANVAS_WIDTH * CANVAS_HEIGHT];
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                pixels[y * CANVAS_WIDTH + x] = image.getPixel(x, y);
            }
        }
        undoStack.add(pixels);
    }

    public void undo() {
        if (undoStack.size() <= 1) return;
        int[] current = new int[CANVAS_WIDTH * CANVAS_HEIGHT];
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                current[y * CANVAS_WIDTH + x] = image.getPixel(x, y);
            }
        }
        redoStack.add(current);

        undoStack.remove(undoStack.size() - 1);
        int[] restore = undoStack.get(undoStack.size() - 1);
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                image.setPixel(x, y, restore[y * CANVAS_WIDTH + x]);
            }
        }
        if (onImageChanged != null) onImageChanged.run();
    }

    public void redo() {
        if (redoStack.isEmpty()) return;
        int[] current = new int[CANVAS_WIDTH * CANVAS_HEIGHT];
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                current[y * CANVAS_WIDTH + x] = image.getPixel(x, y);
            }
        }
        undoStack.add(current);

        int[] next = redoStack.remove(redoStack.size() - 1);
        for (int y = 0; y < CANVAS_HEIGHT; y++) {
            for (int x = 0; x < CANVAS_WIDTH; x++) {
                image.setPixel(x, y, next[y * CANVAS_WIDTH + x]);
            }
        }
        if (onImageChanged != null) onImageChanged.run();
    }

    public void setScale(int scale) {
        this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        setWidth(CANVAS_WIDTH * this.scale);
        setHeight(CANVAS_HEIGHT * this.scale);
    }

    public int getScale() { return scale; }

    public void setCurrentTool(Tool tool) { this.currentTool = tool; }
    public Tool getCurrentTool() { return currentTool; }

    public void setSelectedColor(int color) { this.selectedColor = color; }
    public int getSelectedColor() { return selectedColor; }

    public void setMirrorMode(boolean mirror) { this.mirrorMode = mirror; }
    public boolean isMirrorMode() { return mirrorMode; }

    private int getMirrorX(int x) {
        return CANVAS_WIDTH - 1 - x;
    }

    private void setPixel(int x, int y, int color) {
        if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
        image.setPixel(x, y, color);
        if (mirrorMode) {
            int mx = getMirrorX(x);
            image.setPixel(mx, y, color);
        }
    }

    private int getPixel(int x, int y) {
        if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return 0;
        return image.getPixel(x, y);
    }

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean used) {
        if (!isMouseOver(event.x(), event.y())) return false;
        if (event.button() != 0) return false;

        dragging = true;
        int px = (int) ((event.x() - getX()) / scale);
        int py = (int) ((event.y() - getY()) / scale);

        if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
            saveUndoState();
            redoStack.clear();
            applyTool(px, py);
            lastPixelX = px;
            lastPixelY = py;
            if (onImageChanged != null) onImageChanged.run();
        }
        return true;
    }

    @Override
    public boolean mouseDragged(MouseButtonEvent event, double dragX, double dragY) {
        if (!dragging) return false;

        int px = (int) ((event.x() - getX()) / scale);
        int py = (int) ((event.y() - getY()) / scale);

        if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
            if (currentTool == Tool.PENCIL || currentTool == Tool.ERASER) {
                drawLine(lastPixelX, lastPixelY, px, py);
            } else {
                applyTool(px, py);
            }
            lastPixelX = px;
            lastPixelY = py;
            if (onImageChanged != null) onImageChanged.run();
        }
        return true;
    }

    @Override
    public boolean mouseReleased(MouseButtonEvent event) {
        dragging = false;
        lastPixelX = -1;
        lastPixelY = -1;
        return true;
    }

    private void drawLine(int x0, int y0, int x1, int y1) {
        int dx = Math.abs(x1 - x0);
        int dy = Math.abs(y1 - y0);
        int sx = x0 < x1 ? 1 : -1;
        int sy = y0 < y1 ? 1 : -1;
        int err = dx - dy;

        while (true) {
            applyTool(x0, y0);
            if (x0 == x1 && y0 == y1) break;
            int e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    private void applyTool(int px, int py) {
        switch (currentTool) {
            case PENCIL:
                setPixel(px, py, selectedColor);
                break;
            case ERASER:
                setPixel(px, py, 0);
                break;
            case FILL:
                floodFill(px, py, selectedColor);
                break;
            case EYEDROPPER:
                int color = getPixel(px, py);
                if (color != 0) {
                    selectedColor = color;
                }
                break;
        }
    }

    private void floodFill(int startX, int startY, int newColor) {
        int targetColor = getPixel(startX, startY);
        if (targetColor == newColor) return;

        Deque<int[]> stack = new ArrayDeque<>();
        stack.push(new int[]{startX, startY});

        while (!stack.isEmpty()) {
            int[] p = stack.pop();
            int x = p[0];
            int y = p[1];

            if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) continue;
            if (getPixel(x, y) != targetColor) continue;

            setPixel(x, y, newColor);

            stack.push(new int[]{x + 1, y});
            stack.push(new int[]{x - 1, y});
            stack.push(new int[]{x, y + 1});
            stack.push(new int[]{x, y - 1});
        }
    }

    private static int abgrToRgba(int abgr) {
        int a = (abgr >> 24) & 0xFF;
        int b = (abgr >> 16) & 0xFF;
        int g = (abgr >> 8) & 0xFF;
        int r = abgr & 0xFF;
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    @Override
    protected void renderWidget(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        int x = getX();
        int y = getY();
        int w = getWidth();
        int h = getHeight();

        int borderColor = isFocused() ? 0xFF50A6FF : 0xFF2C2C2C;
        graphics.fill(x - 1, y - 1, x + w + 1, y + h + 1, borderColor);

        int checkerSize = scale / 2;
        if (checkerSize < 1) checkerSize = 1;

        for (int py = 0; py < CANVAS_HEIGHT; py++) {
            for (int px = 0; px < CANVAS_WIDTH; px++) {
                int abgr = image.getPixel(px, py);
                int a = (abgr >> 24) & 0xFF;
                int pxScreenX = x + px * scale;
                int pxScreenY = y + py * scale;

                if (a == 0) {
                    int c1 = 0xFF2B2B2B;
                    int c2 = 0xFF353535;
                    int mid = checkerSize;
                    graphics.fill(pxScreenX, pxScreenY, pxScreenX + mid, pxScreenY + mid, c1);
                    graphics.fill(pxScreenX + mid, pxScreenY, pxScreenX + scale, pxScreenY + mid, c2);
                    graphics.fill(pxScreenX, pxScreenY + mid, pxScreenX + mid, pxScreenY + scale, c2);
                    graphics.fill(pxScreenX + mid, pxScreenY + mid, pxScreenX + scale, pxScreenY + scale, c1);
                } else {
                    graphics.fill(pxScreenX, pxScreenY, pxScreenX + scale, pxScreenY + scale, abgrToRgba(abgr));
                }
            }
        }

        if (scale >= 6) {
            int gridColor = 0x22000000;
            for (int px = 1; px < CANVAS_WIDTH; px++) {
                int gx = x + px * scale;
                graphics.fill(gx, y, gx + 1, y + h, gridColor);
            }
            for (int py = 1; py < CANVAS_HEIGHT; py++) {
                int gy = y + py * scale;
                graphics.fill(x, gy, x + w, gy + 1, gridColor);
            }
        }

        if (isHoveredOrFocused() && mouseX >= x && mouseX < x + w && mouseY >= y && mouseY < y + h) {
            int hx = ((mouseX - x) / scale) * scale;
            int hy = ((mouseY - y) / scale) * scale;
            graphics.fill(x + hx, y + hy, x + hx + scale, y + 1, 0xFFFFFFFF);
            graphics.fill(x + hx, y + hy, x + 1, y + hy + scale, 0xFFFFFFFF);
            graphics.fill(x + hx + scale - 1, y + hy, x + hx + scale, y + hy + scale, 0xFFFFFFFF);
            graphics.fill(x + hx, y + hy + scale - 1, x + hx + scale, y + hy + scale, 0xFFFFFFFF);
        }

        if (mirrorMode) {
            int mx = x + (CANVAS_WIDTH / 2) * scale;
            graphics.fill(mx - 1, y, mx, y + h, 0x80FF4444);
        }
    }

    @Override
    protected void updateWidgetNarration(NarrationElementOutput output) {
    }

    public void close() {
        image.close();
    }
}
