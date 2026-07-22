package net.minecraftcapes.gui;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.network.chat.Component;

public class CapePreviewWidget extends AbstractWidget {
    private static final int HALF_WIDTH = 32;
    private static final int HALF_HEIGHT = 32;
    private static final int LABEL_HEIGHT = 10;
    private static final int SPACING = 6;

    private final int previewScale;
    private NativeImage sourceImage;

    public CapePreviewWidget(int x, int y, int scale) {
        super(x, y, HALF_WIDTH * scale * 2 + SPACING + 4, LABEL_HEIGHT + HALF_HEIGHT * scale + 4, Component.empty());
        this.previewScale = scale;
    }

    public void setSourceImage(NativeImage image) {
        this.sourceImage = image;
    }

    @Override
    protected void renderWidget(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        int x = getX() + 2;
        int y = getY() + 2;
        var font = Minecraft.getInstance().font;

        int frontW = HALF_WIDTH * previewScale;
        int backW = HALF_WIDTH * previewScale;
        int totalW = frontW + SPACING + backW;

        graphics.fill(x - 2, y - 2, x + totalW + 2, y + LABEL_HEIGHT + HALF_HEIGHT * previewScale + 6, 0xFF444444);
        graphics.fill(x - 1, y - 1, x + totalW + 1, y + LABEL_HEIGHT + HALF_HEIGHT * previewScale + 5, 0x66000000);

        graphics.drawString(font, "Front", x + (frontW - font.width("Front")) / 2, y, 0xFFFFFF);
        graphics.drawString(font, "Back", x + frontW + SPACING + (backW - font.width("Back")) / 2, y, 0xFFFFFF);

        int imageY = y + LABEL_HEIGHT + 2;
        renderHalf(graphics, x, imageY, 0, false);
        renderHalf(graphics, x + frontW + SPACING, imageY, HALF_WIDTH, true);

        graphics.fill(x - 2, y + LABEL_HEIGHT + 1, x + totalW + 2, y + LABEL_HEIGHT + 2, 0xFF444444);

        graphics.fill(x - 2, imageY - 1, x - 1, imageY + HALF_HEIGHT * previewScale + 1, 0xFF444444);
        graphics.fill(x + totalW + 1, imageY - 1, x + totalW + 2, imageY + HALF_HEIGHT * previewScale + 1, 0xFF444444);
        graphics.fill(x - 2, imageY + HALF_HEIGHT * previewScale, x + totalW + 2, imageY + HALF_HEIGHT * previewScale + 1, 0xFF444444);
    }

    private void renderHalf(GuiGraphics graphics, int startX, int startY, int sourceOffset, boolean flip) {
        for (int py = 0; py < HALF_HEIGHT; py++) {
            for (int px = 0; px < HALF_WIDTH; px++) {
                int sx = flip ? HALF_WIDTH - 1 - px : px;
                int abgr = 0;
                if (sourceImage != null && sx + sourceOffset < sourceImage.getWidth() && py < sourceImage.getHeight()) {
                    abgr = sourceImage.getPixel(sx + sourceOffset, py);
                }
                int a = (abgr >> 24) & 0xFF;
                int color;
                if (a == 0) {
                    boolean white = ((px + py) & 1) == 0;
                    color = white ? 0xFF2B2B2B : 0xFF353535;
                } else {
                    int b = (abgr >> 16) & 0xFF;
                    int g = (abgr >> 8) & 0xFF;
                    int r = abgr & 0xFF;
                    color = 0xFF000000 | (r << 16) | (g << 8) | b;
                }
                graphics.fill(startX + px * previewScale, startY + py * previewScale,
                        startX + px * previewScale + previewScale, startY + py * previewScale + previewScale, color);
            }
        }

        for (int px = 1; px < HALF_WIDTH; px++) {
            graphics.fill(startX + px * previewScale - 1, startY, startX + px * previewScale, startY + HALF_HEIGHT * previewScale, 0x22000000);
        }
        for (int py = 1; py < HALF_HEIGHT; py++) {
            graphics.fill(startX, startY + py * previewScale - 1, startX + HALF_WIDTH * previewScale, startY + py * previewScale, 0x22000000);
        }
    }

    @Override
    protected void updateWidgetNarration(NarrationElementOutput output) {
    }
}
