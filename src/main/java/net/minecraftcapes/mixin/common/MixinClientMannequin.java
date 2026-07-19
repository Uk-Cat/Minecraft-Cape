package net.minecraftcapes.mixin.common;

import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.ClientMannequin;
import net.minecraft.world.entity.player.PlayerSkin;
import net.minecraftcapes.player.DownloadManager;
import net.minecraftcapes.player.PlayerHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.UUID;

@Mixin(ClientMannequin.class)
public class MixinClientMannequin {

    @Inject(method = "updateSkin", at = @At("RETURN"))
    private void minecraftcapes$updateSkin(CallbackInfo ci) {
        UUID uuid = Minecraft.getInstance().getUser().getProfileId();
        PlayerHandler handler = PlayerHandler.getOrCreate(uuid);
        if (!handler.hasInfo()) {
            DownloadManager.prepareDownload(handler);
        }
    }

    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void minecraftcapes$getSkin(CallbackInfoReturnable<PlayerSkin> cir) {
        UUID uuid = Minecraft.getInstance().getUser().getProfileId();
        PlayerHandler handler = PlayerHandler.getOrCreate(uuid);
        if (handler.hasInfo()) {
            cir.setReturnValue(handler.getSkin(cir.getReturnValue()));
        }
    }
}
