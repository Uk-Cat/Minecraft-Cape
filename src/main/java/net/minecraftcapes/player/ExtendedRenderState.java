package net.minecraftcapes.player;

import net.minecraft.resources.Identifier;

public interface ExtendedRenderState {
    boolean minecraftcapes$isCapeEnabled();
    void minecraftcapes$setCapeEnabled(boolean enabled);

    boolean minecraftcapes$isCapeGlint();
    void minecraftcapes$setCapeGlint(boolean glint);

    boolean minecraftcapes$isEarsEnabled();
    void minecraftcapes$setEarsEnabled(boolean enabled);

    Identifier minecraftcapes$getEarsTexture();
    void minecraftcapes$setEarsTexture(Identifier texture);
}
