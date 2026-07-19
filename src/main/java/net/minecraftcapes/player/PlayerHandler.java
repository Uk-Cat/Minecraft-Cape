package net.minecraftcapes.player;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerSkin;
import net.minecraftcapes.config.MinecraftCapesConfig;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class PlayerHandler {
    private static final Map<UUID, PlayerHandler> HANDLERS = new ConcurrentHashMap<>();
    private static final long FRAME_TIME = 100L;

    private final UUID uuid;
    private boolean hasInfo = false;
    private boolean hasStaticCape = false;
    private boolean hasAnimatedCape = false;
    private boolean hasEars = false;
    private boolean hasCapeGlint = false;
    private boolean upsideDown = false;

    private NativeImage staticCapeImage;
    private java.util.Map<Integer, NativeImage> animatedCape;
    private int lastFrame = 0;
    private long lastFrameTime = 0;
    private Identifier cachedCapeLocation;

    public PlayerHandler(UUID uuid) {
        this.uuid = uuid;
    }

    public static PlayerHandler getOrCreate(UUID uuid) {
        return HANDLERS.computeIfAbsent(uuid, PlayerHandler::new);
    }

    public static Map<UUID, PlayerHandler> getAll() {
        return HANDLERS;
    }

    public static void clearAll() {
        HANDLERS.values().forEach(h -> {
            if (h.staticCapeImage != null) h.staticCapeImage.close();
            if (h.animatedCape != null) h.animatedCape.values().forEach(NativeImage::close);
        });
        HANDLERS.clear();
    }

    public boolean hasInfo() { return hasInfo; }
    public boolean hasCapeGlint() { return hasCapeGlint; }
    public boolean isUpsideDown() { return upsideDown; }

    public PlayerSkin getSkin(PlayerSkin original) {
        if (!hasInfo || !MinecraftCapesConfig.isCapeVisible()) return original;
        Identifier capeLocation = getCapeLocation();
        if (capeLocation == null) return original;
        return new PlayerSkin(
                original.body(),
                new ClientAsset.ResourceTexture(capeLocation),
                new ClientAsset.ResourceTexture(capeLocation),
                original.model(),
                original.secure()
        );
    }

    public Identifier getCapeLocation() {
        if (hasAnimatedCape) {
            return getFrame();
        }
        return cachedCapeLocation;
    }

    private Identifier getFrame() {
        long now = System.currentTimeMillis();
        if (now - lastFrameTime >= FRAME_TIME) {
            lastFrame = (lastFrame + 1) % animatedCape.size();
            lastFrameTime = now;
        }
        return Identifier.fromNamespaceAndPath("minecraftcapes", "capes/" + uuid + "/" + lastFrame);
    }

    public void applyCape(NativeImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        boolean animated = height > width / 2;

        if (animated) {
            applyAnimatedCape(image, width, height);
        } else {
            applyStaticCape(image);
        }
    }

    private void applyStaticCape(NativeImage image) {
        String name = "cape_" + uuid;
        DynamicTexture texture = new DynamicTexture(() -> name, image);
        Identifier location = Identifier.fromNamespaceAndPath("minecraftcapes", name);
        Minecraft.getInstance().getTextureManager().register(location, texture);
        cachedCapeLocation = location;
        hasStaticCape = true;
        hasAnimatedCape = false;
        staticCapeImage = image;
    }

    private void applyAnimatedCape(NativeImage sheet, int width, int height) {
        int frameHeight = width / 2;
        int frameCount = height / frameHeight;
        animatedCape = new java.util.HashMap<>();

        for (int i = 0; i < frameCount; i++) {
            NativeImage frame = new NativeImage(width, frameHeight, true);
            for (int y = 0; y < frameHeight; y++) {
                for (int x = 0; x < width; x++) {
                    frame.setPixel(x, y, sheet.getPixel(x, i * frameHeight + y));
                }
            }
            String name = "cape_" + uuid + "_" + i;
            DynamicTexture texture = new DynamicTexture(() -> name, frame);
            Identifier location = Identifier.fromNamespaceAndPath("minecraftcapes", name);
            Minecraft.getInstance().getTextureManager().register(location, texture);
            animatedCape.put(i, frame);
            if (i == 0) cachedCapeLocation = location;
        }
        hasAnimatedCape = true;
        hasStaticCape = false;
    }

    public void setInfo(boolean hasInfo) { this.hasInfo = hasInfo; }
    public void setCapeGlint(boolean glint) { this.hasCapeGlint = glint; }
    public void setUpsideDown(boolean upsideDown) { this.upsideDown = upsideDown; }

    public void reloadProfile() {
        DownloadManager.prepareDownload(this);
    }

    public String getUuidString() {
        return uuid.toString().replace("-", "");
    }
}
