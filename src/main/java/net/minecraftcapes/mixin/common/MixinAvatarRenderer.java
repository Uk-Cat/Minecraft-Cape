package net.minecraftcapes.mixin.common;

import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.world.entity.Avatar;
import net.minecraftcapes.config.MinecraftCapesConfig;
import net.minecraftcapes.player.ExtendedRenderState;
import net.minecraftcapes.player.PlayerHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(AvatarRenderer.class)
public class MixinAvatarRenderer {

    @Inject(method = "extractRenderState(Lnet/minecraft/world/entity/Avatar;Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;F)V", at = @At("TAIL"))
    private void minecraftcapes$extractRenderState(Avatar player, AvatarRenderState renderState, float partialTick, CallbackInfo ci) {
        PlayerHandler handler = PlayerHandler.getOrCreate(player.getUUID());
        if (!handler.hasInfo()) return;

        if (renderState instanceof ExtendedRenderState extended) {
            extended.minecraftcapes$setCapeEnabled(MinecraftCapesConfig.isCapeVisible());
            extended.minecraftcapes$setCapeGlint(handler.hasCapeGlint());
            extended.minecraftcapes$setEarsEnabled(MinecraftCapesConfig.isEarsVisible());
        }
    }
}
