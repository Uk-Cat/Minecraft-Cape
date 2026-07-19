package net.minecraftcapes.mixin.lunar;

import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;

@Mixin(PlayerModel.class)
public class MixinPlayerEarsModel {

    /**
     * @author MinecraftCapes
     * @reason Lunar Client compatibility requires @Overwrite instead of @Inject
     */
    @Overwrite
    public static LayerDefinition createEarsLayer() {
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

        return LayerDefinition.create(mesh, 14, 7);
    }
}
