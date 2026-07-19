package net.minecraftcapes.fabric;

import net.fabricmc.api.DedicatedServerModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FabricServer implements DedicatedServerModInitializer {
    private static final Logger LOGGER = LoggerFactory.getLogger("minecraftcapes");

    @Override
    public void onInitializeServer() {
        LOGGER.warn("MinecraftCapes is a client-side mod. Remove it from your server to avoid issues.");
    }
}
