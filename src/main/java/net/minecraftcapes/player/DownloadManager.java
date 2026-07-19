package net.minecraftcapes.player;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.util.Util;
import net.minecraft.client.Minecraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import net.minecraftcapes.MinecraftCapes;

public class DownloadManager {
    private static final Logger LOGGER = LoggerFactory.getLogger("minecraftcapes");
    private static final HttpClient CLIENT = HttpClient.newHttpClient();
    private static final String CAPE_BASE_URL = "https://raw.githubusercontent.com/Uk-Cat/Minecraft-Cape/main/Capes/";

    public static void prepareDownload(PlayerHandler playerHandler) {
        Util.backgroundExecutor().execute(() -> {
            try {
                String uuidStr = playerHandler.getUuidString();
                String url = CAPE_BASE_URL + uuidStr + ".png";
                NativeImage capeImage = downloadOrLoad(url, "capes", uuidStr);
                if (capeImage != null) {
                    Minecraft.getInstance().execute(() -> playerHandler.applyCape(capeImage));
                    playerHandler.setInfo(true);
                    LOGGER.info("Loaded cape for {}", uuidStr);
                }
            } catch (Exception e) {
                LOGGER.error("Failed to load cape for {}", playerHandler.getUuidString(), e);
            }
        });
    }

    private static NativeImage downloadOrLoad(String url, String type, String uuidStr) throws IOException {
        Path cacheDir = MinecraftCapes.configDir.resolve(type);
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

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();
            HttpResponse<InputStream> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() == 200) {
                Files.createDirectories(cacheFile.getParent());
                try (InputStream in = response.body()) {
                    Files.copy(in, cacheFile);
                }
                return NativeImage.read(Files.newInputStream(cacheFile));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return null;
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
