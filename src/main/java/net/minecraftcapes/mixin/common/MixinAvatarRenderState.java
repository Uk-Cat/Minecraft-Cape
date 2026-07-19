package net.minecraftcapes.mixin.common;

import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.resources.Identifier;
import net.minecraftcapes.player.ExtendedRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

@Mixin(AvatarRenderState.class)
public class MixinAvatarRenderState implements ExtendedRenderState {
    @Unique
    private boolean minecraftcapes$capeEnabled = false;
    @Unique
    private boolean minecraftcapes$capeGlint = false;
    @Unique
    private boolean minecraftcapes$earsEnabled = false;
    @Unique
    private Identifier minecraftcapes$earsTexture = null;

    @Override
    public boolean minecraftcapes$isCapeEnabled() { return minecraftcapes$capeEnabled; }

    @Override
    public void minecraftcapes$setCapeEnabled(boolean enabled) { this.minecraftcapes$capeEnabled = enabled; }

    @Override
    public boolean minecraftcapes$isCapeGlint() { return minecraftcapes$capeGlint; }

    @Override
    public void minecraftcapes$setCapeGlint(boolean glint) { this.minecraftcapes$capeGlint = glint; }

    @Override
    public boolean minecraftcapes$isEarsEnabled() { return minecraftcapes$earsEnabled; }

    @Override
    public void minecraftcapes$setEarsEnabled(boolean enabled) { this.minecraftcapes$earsEnabled = enabled; }

    @Override
    public Identifier minecraftcapes$getEarsTexture() { return minecraftcapes$earsTexture; }

    @Override
    public void minecraftcapes$setEarsTexture(Identifier texture) { this.minecraftcapes$earsTexture = texture; }
}
