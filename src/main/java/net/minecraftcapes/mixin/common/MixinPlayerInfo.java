package net.minecraftcapes.mixin.common;

import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.world.entity.player.PlayerSkin;
import net.minecraftcapes.player.DownloadManager;
import net.minecraftcapes.player.PlayerHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.UUID;

@Mixin(PlayerInfo.class)
public class MixinPlayerInfo {

    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void minecraftcapes$getSkin(CallbackInfoReturnable<PlayerSkin> cir) {
        UUID uuid = ((PlayerInfo)(Object)this).getProfile().id();
        PlayerHandler handler = PlayerHandler.getOrCreate(uuid);

        if (handler.hasInfo()) {
            cir.setReturnValue(handler.getSkin(cir.getReturnValue()));
        } else {
            DownloadManager.prepareDownload(handler);
        }
    }
}
