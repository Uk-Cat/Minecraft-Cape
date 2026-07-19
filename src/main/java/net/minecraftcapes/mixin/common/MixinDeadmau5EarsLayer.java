package net.minecraftcapes.mixin.common;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.layers.Deadmau5EarsLayer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraftcapes.player.ExtendedRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Deadmau5EarsLayer.class)
public class MixinDeadmau5EarsLayer {

    @Inject(method = "submit", at = @At("HEAD"), cancellable = true)
    private void minecraftcapes$renderEars(PoseStack poseStack, SubmitNodeCollector submitNodeCollector, int packedLight, AvatarRenderState renderState, float limbSwing, float limbSwingAmount, CallbackInfo ci) {
        if (!(renderState instanceof ExtendedRenderState extended) || extended.minecraftcapes$isEarsEnabled()) return;
        ci.cancel();
    }
}
