package net.minecraftcapes.fabric;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;

import net.minecraftcapes.MinecraftCapes;

public class FabricClient implements ClientModInitializer {

    @Override
    public void onInitializeClient() {
        MinecraftCapes.onEnable(FabricLoader.getInstance().getConfigDir());
    }
}
