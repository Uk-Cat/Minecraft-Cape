# MinecraftCapes Mod Architecture

This document covers everything outside the rendering pipeline: the mod's multi-loader build system, entry points, initialization, keybinding, GUI, configuration, language files, and mixin registration.

---

## 1. Multi-Loader Project Structure

The mod uses a **Gradle multi-project** layout with a shared `common` subproject and one subproject per mod loader:

```
MinecraftCapes/
├── common/       # Shared code (mixins, logic, GUI, config)
├── fabric/       # Fabric loader entry point
├── forge/        # Forge loader entry point
├── neoforge/     # NeoForge loader entry point
├── buildSrc/     # Shared Gradle build logic
└── build.gradle  # Root build config
```

Defined in `settings.gradle:59-63`:
```groovy
rootProject.name = 'MinecraftCapes'
include("common")
include("fabric")
include("forge")
include("neoforge")
```

Each loader subproject depends on `common` at compile time and merges its Java sources and resources into its own JAR during the build.

---

## 2. Build System

### `settings.gradle` — Project Definition & Plugin Repositories
Defines the four subprojects and configures plugin resolution from Fabric, Forge, NeoForge, and Sponge maven repositories. Uses the `foojay-resolver-convention` for automatic JDK toolchain provisioning.

### `build.gradle` (root) — Global Plugin Declarations
Declares three loader-specific plugins with `apply false` so they're available to subprojects:
- `net.fabricmc.fabric-loom` (Fabric)
- `net.neoforged.moddev` (NeoForge)
- `io.freefair.lombok` (Lombok code generation)

### `gradle.properties` — Centralized Version Catalog
All version numbers and mod metadata in one place:
- **Project:** `version=1.0.1`, `group=net.minecraftcapes`, `java_version=25`
- **Minecraft:** `minecraft_version=26.2`, `pack_format=88`
- **Mod metadata:** `mod_id=minecraftcapes`, `mod_name=MinecraftCapes`, `license=LGPL-2.1-only`, `description=...`
- **Fabric:** `fabric_version=0.152.2+26.2`, `fabric_loader_version=0.19.3`, `fabric_loom_version=1.17-SNAPSHOT`
- **Forge:** `forge_version=65.0.0`
- **NeoForge:** `neoforge_version=26.2.0.6-beta`
- **Gradle:** `org.gradle.jvmargs=-Xmx3G`, `org.gradle.daemon=false`

### `buildSrc/build.gradle` — BuildSrc Plugin
Enables `groovy-gradle-plugin` so the `.gradle` files in `buildSrc/src/main/groovy/` are available as project-level plugins (`multiloader-common` and `multiloader-loader`).

### `buildSrc/.../multiloader-common.gradle` — Shared Convention Plugin
**Applied by `common/build.gradle`.** Configures:
- Java toolchain, source/target compatibility
- Maven repositories (Sponge, Modrinth, BlameJared)
- Sources & Javadoc JARs
- JAR manifest with specification/implementation attributes
- **Token expansion** in `processResources`: replaces `${variable}` placeholders in `pack.mcmeta`, `fabric.mod.json`, `*.mixins.json`, and Forge/NeoForge mods.toml files using the `expandProps` map of all version/property values
- Capability declarations for Gradle module metadata

### `buildSrc/.../multiloader-loader.gradle` — Loader Subproject Convention
**Applied by `fabric/build.gradle`, `forge/build.gradle`, `neoforge/build.gradle`.** Configures:
- A `commonJava` configuration that pulls Java sources from `:common`
- A `commonResources` configuration that pulls resources from `:common`
- Compile, processResources, javadoc, and sourcesJar tasks all include these common sources/resources

This means **all Java code lives in `common/`** — the loader subprojects only contain their entry point class and `fabric.mod.json` (or `mods.toml`).

### `common/build.gradle` — Common Subproject Build
- Applies `multiloader-common` plugin
- Uses NeoForm (NeoForge's mapping toolchain) to decompile Minecraft for the `common` code
- Depends on Mixin, MixinExtras, and ASM at compile time
- Exports `commonJava` and `commonResources` configurations for consumption by loader subprojects

### `fabric/build.gradle` — Fabric Subproject Build
- Applies `multiloader-loader` (which pulls in common code) + `fabric-loom` + Lombok
- Dependencies: Fabric Loader, Fabric API
- `localRuntime 'net.covers1624:DevLogin:0.1.0.5'` for auto-authentication in dev runs
- Loom run configurations: `clientLogin` (auto-auth), `client` (direct), `server`
- Loads `log4j-dev.xml` for debug logging in development

---

## 3. Initialization Flow

### `common/.../MinecraftCapes.java` — Core Mod Class
**Path:** `common/src/main/java/net/minecraftcapes/MinecraftCapes.java`

```java
public static final String MOD_ID = "minecraftcapes";
public static final String MINECRAFT_VERSION = SharedConstants.getCurrentVersion().name();
public static final KeyMapping KEY_MAPPING = new KeyMapping(
    "key.minecraftcapes.gui",                // translation key
    InputConstants.Type.KEYSYM,               // keyboard key
    GLFW.GLFW_KEY_J,                          // default: J
    KeyMapping.Category.register(...)          // custom category "MinecraftCapes"
);
```

**`onEnable(Path configDir)`** — Called by all loader entry points:
1. Sets `configDir` to `<game_dir>/config/minecraftcapes/`
2. Calls `MinecraftCapesConfig.loadConfig()` to load/initialize the JSON config

### `fabric/.../FabricClient.java` — Fabric Client Entry Point
**Path:** `fabric/src/main/java/net/minecraftcapes/fabric/FabricClient.java`

Implements `ClientModInitializer`. Called by Fabric Loader when the game starts:
1. Calls `MinecraftCapes.onEnable(FabricLoaderImpl.INSTANCE.getConfigDir())`
2. Registers the key mapping using Fabric API's `KeyMappingHelper.registerKeyMapping()`
3. Registers an `END_CLIENT_TICK` event handler that checks for key presses and opens `MenuScreen`

### `fabric/.../FabricServer.java` — Fabric Server Entry Point
**Path:** `fabric/src/main/java/net/minecraftcapes/fabric/FabricServer.java`

Implements `DedicatedServerModInitializer`. Logs a warning instructing server admins that the mod is client-side only and should be removed from servers.

---

## 4. `fabric.mod.json` — Fabric Mod Metadata

**Path:** `fabric/src/main/resources/fabric.mod.json`

| Field | Value |
|---|---|
| `id` | `${mod_id}` → `minecraftcapes` |
| `version` | `${version}` → `1.0.1` |
| `name` | `${mod_name}` → `MinecraftCapes` |
| `entrypoints.client` | `net.minecraftcapes.fabric.FabricClient` |
| `entrypoints.server` | `net.minecraftcapes.fabric.FabricServer` |
| `mixins[].config` | `minecraftcapes.mixins.json` (client-only) |
| `depends` | `fabric-key-mapping-api-v1` |
| `custom.modmenu.links` | Discord invite link |

Token variables (`${...}`) are expanded by `multiloader-common.gradle`'s `processResources` during build.

---

## 5. Mixin Registration

### `minecraftcapes.mixins.json`
**Path:** `common/src/main/resources/minecraftcapes.mixins.json`

```json
{
  "required": true,
  "minVersion": "0.8",
  "package": "net.minecraftcapes.mixin",
  "plugin": "net.minecraftcapes.mixin.MinecraftCapesMixinPlugin",
  "compatibilityLevel": "JAVA_17",
  "client": [
    "common.MixinAvatarRenderer",
    "common.MixinAvatarRenderState",
    "common.MixinCapeLayer",
    "common.MixinClientMannequin",
    "common.MixinDeadmau5EarsLayer",
    "common.MixinPlayerInfo",
    "lunar.MixinPlayerEarsModel",
    "vanilla.MixinPlayerEarsModel"
  ]
}
```

All mixins are **client-only**. The `plugin` field points to `MinecraftCapesMixinPlugin` which conditionally enables either `lunar.MixinPlayerEarsModel` or `vanilla.MixinPlayerEarsModel` based on whether Lunar Client is detected at runtime.

### `common/.../mixin/MinecraftCapesMixinPlugin.java` — Conditional Mixin Loader
**Path:** `common/src/main/java/net/minecraftcapes/mixin/MinecraftCapesMixinPlugin.java`

- Attempts to load `com.moonsworth.lunar.genesis.Genesis`
- If found → only mixins with `lunar.` in the class name apply
- If not found → only mixins with `vanilla.` in the class name apply
- All other mixins (`common.*`) always apply

---

## 6. `pack.mcmeta` — Resource Pack Metadata

**Path:** `common/src/main/resources/pack.mcmeta`

```json
{
  "pack": {
    "description": "${mod_name}",
    "min_format": ${pack_format},
    "max_format": ${pack_format}
  }
}
```

Required for Minecraft to recognise the mod's resources as a valid resource pack. `pack_format=88` matches Minecraft 26.2.

---

## 7. Language Files

**Path:** `common/src/main/resources/assets/minecraftcapes/lang/`

| File | Language |
|---|---|
| `en_us.json` | English (US) |
| `zh_tw.json` | Chinese (Traditional) |
| `es_co.json` | Spanish (Colombia) |
| `el_gr.json` | Greek |

### Keys (from `en_us.json`):
```
gui.minecraftcapes.title          → "MinecraftCapes"
key.minecraftcapes.gui            → "Open GUI"
key.category.minecraftcapes.gui   → "MinecraftCapes"
button.minecraftcapes.*            → Various button labels & tooltips
gui.minecraftcapes.tab.*           → Tab labels: General, Options, Links
```

Used throughout the GUI (`MenuScreen`), key mapping registration, and button tooltips.

---

## 8. `log4j-dev.xml` — Development Debug Logging

**Path:** `log4j-dev.xml`

```xml
<Logger name="minecraftcapes" level="debug" additivity="false">
    <AppenderRef ref="SysOut"/>
    <AppenderRef ref="ServerGuiConsole"/>
</Logger>
```

Loaded by Fabric Loom's dev run configuration (`loom.log4jConfigs` in `fabric/build.gradle`). Enables debug-level logging for the `minecraftcapes` logger during development, which the code uses extensively (e.g. "Static cape loaded for {}", "Animated cape loaded for {}").

---

## 9. File Classification by Loader

Files that belong to each loader and would be removed when targeting Fabric only:

| Loader | Files |
|---|---|
| **Fabric** | `fabric/build.gradle`, `fabric/src/main/java/.../FabricClient.java`, `fabric/src/main/java/.../FabricServer.java`, `fabric/src/main/resources/fabric.mod.json`, `fabric/src/main/resources/logo.png` |
| **Forge** | `forge/build.gradle`, `forge/src/main/java/.../ForgeImplementation.java`, `forge/src/main/java/.../events/KeyHandlerEvent.java`, `forge/src/main/java/.../events/RegisterKeyEvent.java`, `forge/src/main/resources/logo.png`, `forge/src/main/resources/META-INF/mods.toml` |
| **NeoForge** | `neoforge/build.gradle`, `neoforge/src/main/java/.../NeoForgeImplementation.java`, `neoforge/src/main/java/.../events/KeyHandlerEvent.java`, `neoforge/src/main/java/.../events/RegisterKeyEvent.java`, `neoforge/src/main/resources/logo.png`, `neoforge/src/main/resources/META-INF/neoforge.mods.toml` |
| **Common** | Everything under `common/` |
| **All** | Root build files, `buildSrc/`, `gradle/`, `gradle.properties`, `settings.gradle`, `gradlew`/`gradlew.bat`, `log4j-dev.xml` |

---

## Complete File Inventory (Fabric-only)

For a Fabric-only build, the necessary files are:

**Root (build system):**
- `build.gradle`
- `settings.gradle`
- `gradle.properties`
- `gradlew` / `gradlew.bat`
- `gradle/wrapper/gradle-wrapper.jar` / `gradle/wrapper/gradle-wrapper.properties`

**BuildSrc:**
- `buildSrc/build.gradle`
- `buildSrc/src/main/groovy/multiloader-common.gradle`
- `buildSrc/src/main/groovy/multiloader-loader.gradle`

**Common:**
- `common/build.gradle`
- `common/src/main/java/net/minecraftcapes/MinecraftCapes.java`
- `common/src/main/java/net/minecraftcapes/config/MinecraftCapesConfig.java`
- `common/src/main/java/net/minecraftcapes/gui/MenuScreen.java`
- `common/src/main/java/net/minecraftcapes/helpers/MinecraftApi.java`
- `common/src/main/java/net/minecraftcapes/mixin/MinecraftCapesMixinPlugin.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinAvatarRenderer.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinAvatarRenderState.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinCapeLayer.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinClientMannequin.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinDeadmau5EarsLayer.java`
- `common/src/main/java/net/minecraftcapes/mixin/common/MixinPlayerInfo.java`
- `common/src/main/java/net/minecraftcapes/mixin/lunar/MixinPlayerEarsModel.java`
- `common/src/main/java/net/minecraftcapes/mixin/vanilla/MixinPlayerEarsModel.java`
- `common/src/main/java/net/minecraftcapes/player/DownloadManager.java`
- `common/src/main/java/net/minecraftcapes/player/ExtendedRenderState.java`
- `common/src/main/java/net/minecraftcapes/player/PlayerHandler.java`
- `common/src/main/resources/minecraftcapes.mixins.json`
- `common/src/main/resources/pack.mcmeta`
- `common/src/main/resources/assets/minecraftcapes/lang/en_us.json`
- `common/src/main/resources/assets/minecraftcapes/lang/zh_tw.json` (optional)
- `common/src/main/resources/assets/minecraftcapes/lang/es_co.json` (optional)
- `common/src/main/resources/assets/minecraftcapes/lang/el_gr.json` (optional)

**Fabric:**
- `fabric/build.gradle`
- `fabric/src/main/java/net/minecraftcapes/fabric/FabricClient.java`
- `fabric/src/main/java/net/minecraftcapes/fabric/FabricServer.java`
- `fabric/src/main/resources/fabric.mod.json`
- `fabric/src/main/resources/logo.png`

**Optional (dev only):**
- `log4j-dev.xml`
