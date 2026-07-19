package net.minecraftcapes.fabric;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

import net.minecraftcapes.MinecraftCapes;
import net.minecraftcapes.gui.MenuScreen;

public class FabricClient implements ClientModInitializer {

    private static KeyMapping keyMapping;

    @Override
    public void onInitializeClient() {
        MinecraftCapes.onEnable(FabricLoader.getInstance().getConfigDir());

        keyMapping = KeyBindingHelper.registerKeyBinding(new KeyMapping(
                "key.minecraftcapes.gui",
                GLFW.GLFW_KEY_J,
                KeyMapping.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (keyMapping.consumeClick()) {
                Minecraft.getInstance().setScreen(new MenuScreen(Minecraft.getInstance().screen));
            }
        });
    }
}
