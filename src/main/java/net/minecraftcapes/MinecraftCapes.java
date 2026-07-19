package net.minecraftcapes;

import net.minecraft.resources.Identifier;
import net.minecraftcapes.config.MinecraftCapesConfig;

import java.nio.file.Path;

public class MinecraftCapes {
    public static final String MOD_ID = "minecraftcapes";
    public static final String MINECRAFT_VERSION = "1.21.11";
    public static Path configDir;

    public static void onEnable(Path configDirPath) {
        configDir = configDirPath.resolve(MOD_ID);
        MinecraftCapesConfig.loadConfig(configDir);
    }

    public static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MOD_ID, path);
    }
}
