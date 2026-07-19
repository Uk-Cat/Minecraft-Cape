package net.minecraftcapes.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class MinecraftCapesConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static Path configFile;
    private static ConfigData data = new ConfigData();

    private static class ConfigData {
        boolean capeVisible = true;
        boolean earsVisible = true;
    }

    public static void loadConfig(Path configDir) {
        try {
            Files.createDirectories(configDir);
            configFile = configDir.resolve("minecraftcapes.json");
            if (Files.exists(configFile)) {
                data = GSON.fromJson(Files.readString(configFile), ConfigData.class);
                if (data == null) data = new ConfigData();
            } else {
                saveConfig();
            }
        } catch (IOException e) {
            data = new ConfigData();
        }
    }

    public static void saveConfig() {
        try {
            if (configFile != null) {
                Files.writeString(configFile, GSON.toJson(data));
            }
        } catch (IOException ignored) {}
    }

    public static boolean isCapeVisible() { return data.capeVisible; }
    public static boolean isEarsVisible() { return data.earsVisible; }
    public static void setCapeVisible(boolean visible) {
        data.capeVisible = visible;
        saveConfig();
    }
    public static void setEarsVisible(boolean visible) {
        data.earsVisible = visible;
        saveConfig();
    }
}
