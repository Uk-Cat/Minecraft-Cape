package net.minecraftcapes.mixin.vanilla;

import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PlayerModel.class)
public class MixinPlayerEarsModel {

    @Inject(method = "createEarsLayer", at = @At("RETURN"), cancellable = true)
    private static void minecraftcapes$createEarsLayer(CallbackInfoReturnable<LayerDefinition> cir) {
        MeshDefinition mesh = new MeshDefinition();
        PartDefinition root = mesh.getRoot();

        root.addOrReplaceChild(
                "left_ear",
                CubeListBuilder.create()
                        .texOffs(0, 0)
                        .addBox(-1.0F, -2.0F, -1.0F, 3.0F, 5.0F, 1.0F, new CubeDeformation(1.0F, 1.0F, 0.2F)),
                PartPose.offset(0.0F, 0.0F, 0.0F)
        );

        root.addOrReplaceChild(
                "right_ear",
                CubeListBuilder.create()
                        .texOffs(0, 0)
                        .addBox(-1.0F, -2.0F, -1.0F, 3.0F, 5.0F, 1.0F, new CubeDeformation(1.0F, 1.0F, 0.2F))
                        .mirror(true),
                PartPose.offset(0.0F, 0.0F, 0.0F)
        );

        cir.setReturnValue(LayerDefinition.create(mesh, 14, 7));
    }
}
