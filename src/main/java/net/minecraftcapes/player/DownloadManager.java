package net.minecraftcapes.player;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.util.Util;
import net.minecraft.client.Minecraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import net.minecraftcapes.MinecraftCapes;

public class DownloadManager {
    private static final Logger LOGGER = LoggerFactory.getLogger("minecraftcapes");

    public static void prepareDownload(PlayerHandler playerHandler) {
        if (playerHandler.hasInfo()) {
            LOGGER.debug("Already loaded cape for {}, skipping", playerHandler.getUuidString());
            return;
        }

        Util.backgroundExecutor().execute(() -> {
            try {
                String uuidStr = playerHandler.getUuidString();
                NativeImage capeImage = tryLoadFromCache(uuidStr);
                if (capeImage != null) {
                    Minecraft.getInstance().execute(() -> playerHandler.applyCape(capeImage));
                    playerHandler.setInfo(true);
                    LOGGER.info("Loaded cape for {} from cache", uuidStr);
                    return;
                }

                CloudflareManager.pullCape(uuidStr,
                        image -> {
                            saveToCache(uuidStr, image);
                            playerHandler.applyCape(image);
                            playerHandler.setInfo(true);
                            LOGGER.info("Loaded cape for {} from worker", uuidStr);
                        },
                        error -> LOGGER.error("Failed to load cape for {}: {}", uuidStr, error)
                );
            } catch (Exception e) {
                LOGGER.error("Failed to load cape for {}", playerHandler.getUuidString(), e);
            }
        });
    }

    private static NativeImage tryLoadFromCache(String uuidStr) throws IOException {
        Path cacheDir = MinecraftCapes.configDir.resolve("capes");
        Files.createDirectories(cacheDir);

        String hash = hashString(uuidStr);
        String prefix = hash.substring(0, 2);
        Path cacheFile = cacheDir.resolve(prefix).resolve(uuidStr + ".png");

        if (Files.exists(cacheFile)) {
            try {
                return NativeImage.read(Files.newInputStream(cacheFile));
            } catch (IOException e) {
                Files.deleteIfExists(cacheFile);
            }
        }
        return null;
    }

    public static void saveToCache(String uuidStr, NativeImage image) {
        try {
            Path cacheDir = MinecraftCapes.configDir.resolve("capes");
            Files.createDirectories(cacheDir);

            String hash = hashString(uuidStr);
            String prefix = hash.substring(0, 2);
            Path cacheFile = cacheDir.resolve(prefix).resolve(uuidStr + ".png");

            Files.createDirectories(cacheFile.getParent());
            image.writeToFile(cacheFile);
        } catch (IOException e) {
            LOGGER.error("Failed to cache cape for {}", uuidStr, e);
        }
    }

    private static String hashString(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes());
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return input;
        }
    }
}
