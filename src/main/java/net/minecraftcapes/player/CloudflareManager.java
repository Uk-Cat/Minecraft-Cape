package net.minecraftcapes.player;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.util.Util;
import net.minecraft.client.Minecraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.minecraftcapes.config.MinecraftCapesConfig;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.Properties;

public class CloudflareManager {
    private static final Logger LOGGER = LoggerFactory.getLogger("minecraftcapes");
    private static final HttpClient CLIENT = HttpClient.newHttpClient();
    private static final Gson GSON = new Gson();
    private static final String WORKER_URL;
    private static final String SECRET_KEY;

    static {
        String url = "";
        String key = "";
        Path envFile = Path.of(".").resolve(".env").normalize();
        Properties props = new Properties();
        try (InputStream is = Files.newInputStream(envFile);
             BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            props.load(br);
            url = props.getProperty("WORKER_URL", "");
            key = props.getProperty("SECRET_KEY", "");
        } catch (Exception e) {
            LOGGER.warn("No .env file found at {}, using defaults", envFile.toAbsolutePath());
            url = "https://cape-storage-worker.ramddomemail-com.workers.dev";
            key = "1EI6A9T1BqbHHPdNjfqTRWroXwKaH29r";
        }
        WORKER_URL = url;
        SECRET_KEY = key;
    }

    private static final Map<String, Long> lastPullTimes = new ConcurrentHashMap<>();

    public static boolean canPull(String uuid) {
        long lastTime = lastPullTimes.getOrDefault(uuid, 0L);
        long elapsed = System.currentTimeMillis() - lastTime;
        int cooldownMs = MinecraftCapesConfig.getRequestCooldownSeconds() * 1000;
        return elapsed >= cooldownMs;
    }

    public static void pullCape(String uuid, Consumer<NativeImage> onSuccess, Consumer<String> onError) {
        if (!canPull(uuid)) {
            Minecraft.getInstance().execute(() -> onError.accept("Cooldown active"));
            return;
        }

        lastPullTimes.put(uuid, System.currentTimeMillis());

        Util.backgroundExecutor().execute(() -> {
            try {
                JsonObject body = new JsonObject();
                body.addProperty("Type", "Pull");
                body.addProperty("Key", SECRET_KEY);
                body.addProperty("UUID", uuid);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(WORKER_URL))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
                        .build();

                HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    onError.accept("HTTP " + response.statusCode());
                    return;
                }

                JsonObject json = GSON.fromJson(response.body(), JsonObject.class);
                String code = json.get("Code").getAsString();

                if (!"200".equals(code)) {
                    onError.accept("Code: " + code);
                    return;
                }

                String imageBase64 = json.get("Image").getAsString();
                byte[] imageBytes = Base64.getDecoder().decode(imageBase64);
                NativeImage image = NativeImage.read(imageBytes);

                Minecraft.getInstance().execute(() -> onSuccess.accept(image));
            } catch (Exception e) {
                lastPullTimes.remove(uuid);
                LOGGER.error("Failed to pull cape for {}", uuid, e);
                Minecraft.getInstance().execute(() -> onError.accept(e.getMessage()));
            }
        });
    }

    public static void pushCape(String uuid, NativeImage image, Consumer<Boolean> callback) {
        pushCape(uuid, image, false, callback);
    }

    public static void replaceCape(String uuid, NativeImage image, Consumer<Boolean> callback) {
        pushCape(uuid, image, true, callback);
    }

    private static void pushCape(String uuid, NativeImage image, boolean isReplace, Consumer<Boolean> callback) {
        Util.backgroundExecutor().execute(() -> {
            Path tempFile = null;
            try {
                tempFile = Files.createTempFile("cape_" + uuid, ".png");
                image.writeToFile(tempFile);
                byte[] pngBytes = Files.readAllBytes(tempFile);
                String base64 = Base64.getEncoder().encodeToString(pngBytes);

                JsonObject body = new JsonObject();
                body.addProperty("Type", isReplace ? "Replace" : "Push");
                body.addProperty("Key", SECRET_KEY);
                body.addProperty("UUID", uuid);
                body.addProperty("Cape", base64);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(WORKER_URL))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
                        .build();

                HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    Minecraft.getInstance().execute(() -> callback.accept(false));
                    return;
                }

                JsonObject json = GSON.fromJson(response.body(), JsonObject.class);
                String code = json.get("Code").getAsString();
                Minecraft.getInstance().execute(() -> callback.accept("200".equals(code)));
            } catch (Exception e) {
                LOGGER.error("Failed to push cape for {}", uuid, e);
                Minecraft.getInstance().execute(() -> callback.accept(false));
            } finally {
                if (tempFile != null) {
                    try {
                        Files.deleteIfExists(tempFile);
                    } catch (IOException ignored) {
                    }
                }
            }
        });
    }

    public static void clearCooldown(String uuid) {
        lastPullTimes.remove(uuid);
    }
}
