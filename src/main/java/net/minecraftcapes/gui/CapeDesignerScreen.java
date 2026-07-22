package net.minecraftcapes.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

public class CapeDesignerScreen extends Screen {
    private final Screen parent;
    private boolean openedBrowser = false;

    public CapeDesignerScreen(Screen parent) {
        super(Component.translatable("gui.minecraftcapes.designer.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        LocalDesignerServer.start();
        if (!openedBrowser) {
            Util.getPlatform().openUri(LocalDesignerServer.getUrl());
            openedBrowser = true;
        }

        int btnW = 150;
        int btnH = 20;
        int centerX = width / 2;
        int centerY = height / 2;

        addRenderableWidget(Button.builder(
                Component.translatable("button.minecraftcapes.designer"),
                btn -> Util.getPlatform().openUri(LocalDesignerServer.getUrl())
        ).bounds(centerX - btnW / 2, centerY + 10, btnW, btnH).build());

        addRenderableWidget(Button.builder(
                Component.translatable("button.minecraftcapes.designer.save"),
                btn -> onClose()
        ).bounds(centerX - btnW / 2, centerY + 35, btnW, btnH).build());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        super.render(graphics, mouseX, mouseY, partialTick);

        int centerX = width / 2;
        int centerY = height / 2;

        graphics.drawCenteredString(font, title, centerX, centerY - 50, 0xFFFFFF);
        graphics.drawCenteredString(font, "Cape Creator has been opened in your web browser.", centerX, centerY - 25, 0xAAAAAA);
        graphics.drawCenteredString(font, "Use Pencil, Eraser, Fill & more to design your cape. Save & Upload when done.", centerX, centerY - 12, 0x888888);
    }

    @Override
    public void onClose() {
        LocalDesignerServer.stop();
        Minecraft.getInstance().setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
