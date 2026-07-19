package net.minecraftcapes.mixin;

import org.objectweb.asm.tree.ClassNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.extensibility.IMixinConfigPlugin;
import org.spongepowered.asm.mixin.extensibility.IMixinInfo;

import java.util.List;
import java.util.Set;

public class MinecraftCapesMixinPlugin implements IMixinConfigPlugin {
    private static final Logger LOGGER = LoggerFactory.getLogger("minecraftcapes");
    private boolean lunarDetected = false;

    @Override
    public void onLoad(String mixinPackage) {
        try {
            Class.forName("com.moonsworth.lunar.genesis.Genesis");
            lunarDetected = true;
            LOGGER.info("Lunar Client detected, using Lunar ear mixin");
        } catch (ClassNotFoundException e) {
            lunarDetected = false;
            LOGGER.info("Vanilla Minecraft detected, using Vanilla ear mixin");
        }
    }

    @Override
    public String getRefMapperConfig() {
        return null;
    }

    @Override
    public boolean shouldApplyMixin(String targetClassName, String mixinClassName) {
        if (mixinClassName.contains("lunar.MixinPlayerEarsModel")) {
            return lunarDetected;
        }
        if (mixinClassName.contains("vanilla.MixinPlayerEarsModel")) {
            return !lunarDetected;
        }
        return true;
    }

    @Override
    public void acceptTargets(Set<String> myTargets, Set<String> otherTargets) {}

    @Override
    public List<String> getMixins() {
        return null;
    }

    @Override
    public void preApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {}

    @Override
    public void postApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {}
}
