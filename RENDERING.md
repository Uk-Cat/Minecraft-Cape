# MinecraftCapes Rendering Pipeline

This document explains how custom capes and ears are downloaded, processed, and rendered in-game. Each section corresponds to a source file, tracing the flow from network fetch to final pixel on screen.

---

## 1. `common/.../player/PlayerHandler.java` — Per-Player State & Texture Management

**Role:** Holds the texture state (cape, ears, glint, upside-down) for each player UUID. Manages static vs animated cape textures and responds to frame ticks.

**Key fields:**
- `hasStaticCape` / `hasAnimatedCape` — which type of cape is active
- `hasEars` — whether custom ears are loaded
- `hasCapeGlint` — whether the enchanted glint overlay should render
- `upsideDown` — whether the player model should be flipped
- `animatedCape` — `Int2ObjectMap<NativeImage>` holding each frame of an animated cape
- `lastFrameTime` / `lastFrame` — frame animation timer (100ms per frame)

**Key methods:**

### `getSkin(PlayerSkin original)`
Creates a new `PlayerSkin` replacing the vanilla cape/elytra `ClientAsset.Texture` with a `ClientAsset.ResourceTexture` pointing to `minecraftcapes:capes/{uuid}` (or the current animated frame). This is the **primary injection point** — the cape texture is baked into the player's skin object before rendering begins.

### `applyCape(NativeImage capeImage)`
Detects whether the image is animated (height > width/2). For static capes: resizes to power-of-two dimensions, registers with `DynamicTexture` under `minecraftcapes:capes/{uuid}`. For animated capes: splits the sheet into individual frames, registers each as `minecraftcapes:capes/{uuid}/{frame}`.

### `getCapeLocation()`
Returns the texture `Identifier` for the current cape. For static: `minecraftcapes:capes/{uuid}`. For animated: calls `getFrame()` which cycles every 100ms through frame indices, returning `minecraftcapes:capes/{uuid}/{frame}`.

### `getFrame()`
Timer-based frame selector. Advances one frame every 100ms, wrapping around when reaching the last frame. This means the texture reference in `PlayerSkin` changes over time, causing the cape to animate.

---

## 2. `common/.../player/DownloadManager.java` — Network Fetching & Caching

**Role:** Downloads cape/ear textures from the MinecraftCapes API and caches them to disk.

**Key method:**

### `prepareDownload(PlayerHandler playerHandler)`
Entry point. Checks UUID version: v4 (online) goes directly to `downloadProfile()`, v3 (offline/Bedrock) first resolves the online UUID via `MinecraftApi.getUUID()`.

### `downloadProfile(PlayerHandler playerHandler)`
HTTP GET to `https://api.minecraftcapes.net/profile/{uuid}`. Parses JSON into `ProfileResult`:
```json
{ "cape_url": "...", "ear_url": "...", "capeGlint": false, "upsideDown": false }
```
Then calls `downloadOrLoad()` for the cape and ear URLs, passing the resulting `NativeImage` to `playerHandler.applyCape()` / `playerHandler.applyEars()`.

### `downloadOrLoad(String url, String type)`
Two-tier cache: first checks `{configDir}/{type}/{hash_prefix}/{hash}` on disk. If cached, reads directly. Otherwise downloads the URL, saves to disk, then loads into a `NativeImage`. Disk caching avoids repeated downloads across game sessions.

### `ProfileResult` (inner class)
Maps the API response: `cape_url`, `ear_url`, `capeGlint` (boolean), `upsideDown` (boolean).

---

## 3. `common/.../helpers/MinecraftApi.java` — Mojang UUID Resolution

**Role:** Resolves a username to an online UUID (used for offline-mode players).

### `getUUID(String username)`
Calls `https://api.minecraftapi.net/v3/profile/{username}?params=[full_uuid,name]` and extracts `full_uuid`. This ensures offline-mode players can still have their capes downloaded.

---

## 4. `common/.../mixin/common/MixinPlayerInfo.java` — Tab List Entry Point

**Role:** Intercepts `PlayerInfo.getSkin()` to inject custom cape textures for all players in the tab list.

**Injection:** `@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)`

**Logic:**
1. Gets or creates a `PlayerHandler` for the player's UUID
2. If `hasInfo` is true: replaces the returned `PlayerSkin` with `playerHandler.getSkin(cir.getReturnValue())`
3. If `hasInfo` is false: calls `DownloadManager.prepareDownload()` to trigger async fetch

This fires for every player in the tab list every time their skin is queried, which happens when the player list is rendered or when the skin is otherwise accessed.

---

## 5. `common/.../mixin/common/MixinClientMannequin.java` — Mannequin Support

**Role:** Same logic as `MixinPlayerInfo` but for `ClientMannequin` (armor stand mannequins that display player skins).

**Injections:**
- `updateSkin()` (`@Inject(RETURN)`) — triggers profile loading if not loaded
- `getSkin()` (`@Inject(RETURN, cancellable)`) — replaces skin with custom cape/ears

Ensures mannequins in the world also display custom capes/ears.

---

## 6. `common/.../mixin/common/MixinAvatarRenderer.java` — Render State Population

**Role:** Copies custom cape/ears state from `PlayerHandler` into the `AvatarRenderState` each frame.

**Injection:** `@Inject(method = "extractRenderState", at = @At("TAIL"))`

**Logic:**
1. Gets `PlayerHandler` for the entity's UUID
2. If the profile has loaded (`hasInfo`):
   - Sets `avatarRenderState.isUpsideDown` for flipped cape rendering
   - Sets `avatarRenderState.showExtraEars` (OR'd with existing value) to signal custom ears
   - Sets `ExtendedRenderState` fields: `capeEnabled`, `capeGlint`, `earsEnabled`, `earsTexture`

This runs every frame during render state extraction, ensuring the visual state is always current.

---

## 7. `common/.../mixin/common/MixinAvatarRenderState.java` + `ExtendedRenderState.java` — Extended State Interface

**Role:** Adds custom fields to `AvatarRenderState` via mixin, accessed through the `ExtendedRenderState` interface.

**Fields added to `AvatarRenderState`:**
- `minecraftcapes$capeEnabled` (boolean) — whether to render custom cape
- `minecraftcapes$capeGlint` (boolean) — whether to add enchanted glint
- `minecraftcapes$earsEnabled` (boolean) — whether to render custom ears
- `minecraftcapes$earsTexture` (Identifier) — texture for custom ears

The interface provides getter/setter methods. This avoids needing to store state in maps or static fields — the state lives directly on the render state object.

---

## 8. `common/.../mixin/common/MixinCapeLayer.java` — Cape Rendering Intercept

**Role:** The actual rendering override. Intercepts `CapeLayer.submit()` to replace the cape model submission with the custom texture and optional glint.

**Injection:** `@WrapWithCondition(method = "submit", at = @At(value = "INVOKE", target = "...submitModel(...)"))`

**Logic:**
1. Casts `AvatarRenderState` to `ExtendedRenderState`
2. If `capeEnabled` is true:
   - Submits the cape model with `RenderTypes.armorCutoutNoCull(avatarRenderState.skin.cape().texturePath())`
   - The texture path comes from `PlayerSkin.cape()` which was already replaced by `PlayerHandler.getSkin()` — so this renders the custom cape
   - If `hasCapeGlint` is true: submits a second pass with `RenderTypes.armorEntityGlint()` for the enchanted shimmer effect
   - Returns `false` (cancelling the original vanilla submission)
3. If `capeEnabled` is false: returns `true` (allowing vanilla rendering to proceed)

**Important detail:** The actual cape texture is not set here — it was already set in the `PlayerSkin` object (step 4). This mixin simply decides whether to render it and optionally layers glint on top.

---

## 9. `common/.../mixin/common/MixinDeadmau5EarsLayer.java` — Ears Rendering Intercept

**Role:** Analogous to the cape layer. Intercepts `Deadmau5EarsLayer.submit()` to replace the ears texture.

**Injection:** `@WrapWithCondition(method = "submit", at = @At(value = "INVOKE", target = "...submitModel(...)"))`

**Logic:**
1. If `earsEnabled` is true: submits the ear model with `RenderTypes.armorCutoutNoCull(extendedRenderState.minecraftcapes$getEarsTexture())` using the custom ear texture, returns `false`
2. If `earsEnabled` is false: returns `true` to allow vanilla rendering

---

## 10. `common/.../mixin/vanilla/MixinPlayerEarsModel.java` — Vanilla Ear Model

**Role:** Modifies the ear model geometry for vanilla Minecraft so custom ears have proper thickness.

**Injection:** `@Inject(method = "createEarsLayer", at = @At("RETURN"), cancellable = true)`

**Logic:**
1. Cancels the original return value
2. Builds ear cubes with `CubeDeformation(1.0F, 1.0F, 0.2F)` — the 0.2F z-depth gives ears visible thickness instead of paper-thin
3. Uses a 14×7 pixel texture sheet instead of the vanilla dimensions
4. Returns the modified `LayerDefinition`

---

## 11. `common/.../mixin/lunar/MixinPlayerEarsModel.java` — Lunar Client Ear Model

**Role:** Same geometry change but uses `@Overwrite` (the comment notes Lunar Client compatibility issues with injectors).

**Logic:** Identical cube geometry: `CubeDeformation(1.0F, 1.0F, 0.2F)`, 14×7 texture, same positioning. Only difference is the mixin approach (`@Overwrite` vs `@Inject`).

---

## 12. `common/.../mixin/MinecraftCapesMixinPlugin.java` — Conditional Mixin Loading

**Role:** Decides at runtime whether to apply lunar or vanilla ear mixins.

**Logic:**
- Tries to load `com.moonsworth.lunar.genesis.Genesis`
- If found: only `lunar.MixinPlayerEarsModel` applies
- If not found: only `vanilla.MixinPlayerEarsModel` applies
- All other mixins always apply

---

## 13. `common/.../config/MinecraftCapesConfig.java` — User Toggles

**Role:** Persists user preferences for cape/ears visibility to a JSON config file (`minecraftcapes.json`).

**Fields:** `capeVisible` (default: true), `earsVisible` (default: true)

Referenced by:
- `MixinAvatarRenderer` (step 6) — to decide whether to set `capeEnabled`/`earsEnabled`
- `PlayerHandler.getSkin()` — `isCapeVisible()` check before replacing the cape texture
- `MenuScreen.OptionsTab` — toggle buttons for the user

---

## 14. `common/.../gui/MenuScreen.java` — GUI Menu

**Role:** In-game GUI (opened with J key) providing profile reload, website links, and visibility toggles.

**Tabs:**
- **General** — Open MinecraftCapes website, Relown Profile (clears own `PlayerHandler`), Reload All Profiles (calls `PlayerHandler.clearAll()`)
- **Options** — Toggle custom capes/ears visibility via `MinecraftCapesConfig`
- **Links** — Discord, GitHub, MinecraftCapes website

The GUI also renders a preview of the player entity using `renderEntity()`, applying custom render states so the player is shown with their current cape/ears.

---

## Data Flow Summary

```
PlayerInfo.getSkin() / ClientMannequin.getSkin()
    │
    ▼
MixinPlayerInfo / MixinClientMannequin
    │
    ├─ [not loaded] → DownloadManager.prepareDownload()
    │                       │
    │                       ▼
    │                   HTTP GET api.minecraftcapes.net/profile/{uuid}
    │                       │
    │                       ▼
    │                   ProfileResult (cape_url, ear_url, capeGlint, upsideDown)
    │                       │
    │                       ▼
    │                   downloadOrLoad() → disk cache → NativeImage
    │                       │
    │                       ▼
    │                   PlayerHandler.applyCape() / applyEars()
    │                       │
    │                       ├─ Static: DynamicTexture @ minecraftcapes:capes/{uuid}
    │                       └─ Animated: split frames → DynamicTexture @ minecraftcapes:capes/{uuid}/{frame}
    │
    └─ [loaded] → PlayerHandler.getSkin(vanillaSkin)
                        │
                        ▼
                  New PlayerSkin(capeTexture = ResourceTexture(minecraftcapes:capes/{uuid}))
                        │
                        ▼
                  Returned as player's skin (cape & elytra textures replaced)

=== PER FRAME ===

AvatarRenderer.extractRenderState()
    │
    ▼
MixinAvatarRenderer → sets ExtendedRenderState fields on AvatarRenderState
    │
    ▼
CapeLayer.submit()
    │
    ▼
MixinCapeLayer (@WrapWithCondition)
    │
    ├─ Cape enabled → submitModel(custom texture) + [if glint] submitModel(glint)
    └─ Cape disabled → let vanilla render

Deadmau5EarsLayer.submit()
    │
    ▼
MixinDeadmau5EarsLayer (@WrapWithCondition)
    │
    ├─ Ears enabled → submitModel(custom ear texture)
    └─ Ears disabled → let vanilla render
```
