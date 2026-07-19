package net.minecraftcapes.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.CycleButton;
import net.minecraft.client.gui.layouts.GridLayout;
import net.minecraft.client.gui.layouts.LinearLayout;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import net.minecraftcapes.config.MinecraftCapesConfig;
import net.minecraftcapes.player.PlayerHandler;

import java.util.List;
import java.util.function.Consumer;

public class MenuScreen extends Screen {
    private static final int BUTTON_WIDTH = 200;
    private static final int BUTTON_HEIGHT = 20;

    private final Screen parent;

    public MenuScreen(Screen parent) {
        super(Component.translatable("gui.minecraftcapes.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        LinearLayout layout = LinearLayout.vertical().spacing(4);

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.open_website"),
                btn -> Util.getPlatform().openUri("https://minecraftcapes.net")
        ).width(BUTTON_WIDTH).build());

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.reload_profile"),
                btn -> {
                    PlayerHandler handler = PlayerHandler.getOrCreate(Minecraft.getInstance().getUser().getProfileId());
                    handler.setInfo(false);
                    handler.reloadProfile();
                }
        ).width(BUTTON_WIDTH).build());

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.reload_all"),
                btn -> PlayerHandler.clearAll()
        ).width(BUTTON_WIDTH).build());

        layout.addChild(CycleButton.onOffBuilder(MinecraftCapesConfig.isCapeVisible())
                .displayOnlyValue()
                .create(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, Component.translatable("button.minecraftcapes.cape_visible"),
                        (btn, val) -> MinecraftCapesConfig.setCapeVisible(val)));

        layout.addChild(CycleButton.onOffBuilder(MinecraftCapesConfig.isEarsVisible())
                .displayOnlyValue()
                .create(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, Component.translatable("button.minecraftcapes.ears_visible"),
                        (btn, val) -> MinecraftCapesConfig.setEarsVisible(val)));

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.discord"),
                btn -> Util.getPlatform().openUri("https://discord.gg/minecraftcapes")
        ).width(BUTTON_WIDTH).build());

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.github"),
                btn -> Util.getPlatform().openUri("https://github.com/Uk-Cat/Minecraft-Cape")
        ).width(BUTTON_WIDTH).build());

        layout.addChild(Button.builder(
                Component.translatable("button.minecraftcapes.website"),
                btn -> Util.getPlatform().openUri("https://minecraftcapes.net")
        ).width(BUTTON_WIDTH).build());

        layout.arrangeElements();
        layout.setX((this.width - layout.getWidth()) / 2);
        layout.setY(40);
        layout.visitWidgets(this::addRenderableWidget);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        super.render(graphics, mouseX, mouseY, partialTick);
        graphics.drawCenteredString(font, title, this.width / 2, 8, 0xFFFFFF);
    }

    @Override
    public void onClose() {
        Minecraft.getInstance().setScreen(parent);
    }
}