package net.minecraftcapes.gui;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Util;
import net.minecraftcapes.player.CloudflareManager;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

public class LocalDesignerServer {
    private static HttpServer server;
    private static int port = 0;
    private static final Gson GSON = new Gson();

    public static synchronized void start() {
        if (server != null) return;
        try {
            server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            port = server.getAddress().getPort();
            server.createContext("/", new IndexHandler());
            server.createContext("/api/load", new LoadHandler());
            server.createContext("/api/save", new SaveHandler());
            server.createContext("/api/player", new PlayerUuidHandler());
            server.setExecutor(Util.backgroundExecutor());
            server.start();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static synchronized void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
            port = 0;
        }
    }

    public static String getUrl() {
        return "http://localhost:" + port + "/";
    }

    private static class IndexHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            try (InputStream is = LocalDesignerServer.class.getResourceAsStream("/assets/minecraftcapes/web/designer.html")) {
                if (is == null) {
                    byte[] response = "HTML template not found inside jar!".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "text/plain");
                    exchange.sendResponseHeaders(404, response.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(response);
                    }
                    return;
                }

                byte[] bytes = is.readAllBytes();
                exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        }
    }

    private static class LoadHandler implements HttpHandler {
        private static String cachedBase64 = null;

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            UUID uuid = Minecraft.getInstance().getUser().getProfileId();
            String uuidStr = uuid.toString().replace("-", "");

            if (cachedBase64 != null) {
                sendCapeResponse(exchange, uuidStr, cachedBase64);
                return;
            }

            CloudflareManager.pullCape(uuidStr,
                    image -> {
                        try {
                            byte[] pngBytes = imageToPngBytes(image);
                            String base64 = Base64.getEncoder().encodeToString(pngBytes);
                            image.close();
                            cachedBase64 = base64;
                            sendCapeResponse(exchange, uuidStr, base64);
                        } catch (Exception e) {
                            sendError(exchange, e.getMessage());
                        }
                    },
                    error -> sendError(exchange, error)
            );
        }

        public static void invalidateCache() {
            cachedBase64 = null;
        }

        private static void sendCapeResponse(HttpExchange exchange, String uuid, String base64) throws IOException {
            JsonObject response = new JsonObject();
            response.addProperty("status", "success");
            response.addProperty("uuid", uuid);
            response.addProperty("image", base64);

            byte[] jsonBytes = response.toString().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, jsonBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(jsonBytes);
            }
        }
    }

    private static class SaveHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            try {
                InputStreamReader isr = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8);
                BufferedReader br = new BufferedReader(isr);
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }

                JsonObject body = JsonParser.parseString(sb.toString()).getAsJsonObject();
                String base64Image = body.get("image").getAsString();

                byte[] imageBytes = Base64.getDecoder().decode(base64Image);
                NativeImage image = NativeImage.read(imageBytes);

                UUID uuid = Minecraft.getInstance().getUser().getProfileId();
                String uuidStr = uuid.toString().replace("-", "");

                CloudflareManager.replaceCape(uuidStr, image, success -> {
                    image.close();
                    try {
                        if (success) {
                            LoadHandler.invalidateCache();
                        }
                        JsonObject response = new JsonObject();
                        if (success) {
                            response.addProperty("status", "success");
                        } else {
                            response.addProperty("status", "failed");
                            response.addProperty("message", "Upload rejected by server");
                        }

                        byte[] jsonBytes = response.toString().getBytes(StandardCharsets.UTF_8);
                        exchange.sendResponseHeaders(200, jsonBytes.length);
                        try (OutputStream os = exchange.getResponseBody()) {
                                os.write(jsonBytes);
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            } catch (Exception e) {
                sendError(exchange, e.getMessage());
            }
        }
    }

    private static class PlayerUuidHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Content-Type", "application/json");

            UUID uuid = Minecraft.getInstance().getUser().getProfileId();
            String uuidStr = uuid.toString().replace("-", "");

            JsonObject response = new JsonObject();
            response.addProperty("status", "success");
            response.addProperty("uuid", uuidStr);

            byte[] jsonBytes = response.toString().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, jsonBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(jsonBytes);
            }
        }
    }

    private static void sendError(HttpExchange exchange, String message) {
        try {
            JsonObject response = new JsonObject();
            response.addProperty("status", "error");
            response.addProperty("message", message);
            byte[] jsonBytes = response.toString().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, jsonBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(jsonBytes);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static byte[] imageToPngBytes(NativeImage image) throws IOException {
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("cape_load", ".png");
        try {
            image.writeToFile(tempFile);
            return java.nio.file.Files.readAllBytes(tempFile);
        } finally {
            java.nio.file.Files.deleteIfExists(tempFile);
        }
    }
}
