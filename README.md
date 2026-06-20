# The Forever Winter Vortex Extension

Beta Vortex support for **The Forever Winter**.

This extension registers the Steam release, creates the common PAK `Mods` folder, routes common archive layouts, and warns when Signature Bypass appears to be missing. It does not include or redistribute any third-party mods, bypass files, or game assets.

## Local Installation

1. Copy this folder to:

   ```text
   %APPDATA%\Vortex\plugins\the-forever-winter
   ```

2. Restart Vortex.
3. Open the Extensions page in advanced mode and confirm `Game: The Forever Winter` is enabled.
4. Manage The Forever Winter in Vortex.

## Supported Paths

| Mod pattern | Vortex mod type | Game destination |
| --- | --- | --- |
| Default `.pak` / `.ucas` / `.utoc` triplets | `tfw-paks-mods` | `Windows\ForeverWinter\Content\Paks\Mods` |
| Known root PAK example: Increased Hunter Killers Spawn Threshold | `tfw-paks-root` | `Windows\ForeverWinter\Content\Paks` |
| Known Mods PAK example: RemoveStun | `tfw-paks-mods` | `Windows\ForeverWinter\Content\Paks\Mods` |
| User-downloaded Signature Bypass archive with `dsound.dll` and `bitfix` | `tfw-win64-root` | `Windows\ForeverWinter\Binaries\Win64` |
| UE4SS loader archive with `dwmapi.dll` and `ue4ss` | `tfw-win64-root` | `Windows\ForeverWinter\Binaries\Win64` |
| UE4SS mod archive under `ue4ss\Mods\<mod>` or `Mods\<mod>` | `tfw-ue4ss-mods` | `Windows\ForeverWinter\Binaries\Win64\ue4ss\Mods` |
| TFWWorkbench release archive | `tfw-game-root` | `TFWWorkbench` to UE4SS Mods, data folder under `Content\Paks\Mods\TFWWorkbench` |
| Mixed UE4SS plus PAK archive | `tfw-game-root` | UE4SS mod folders to `Win64\ue4ss\Mods`, PAK files to `Content\Paks` or `Content\Paks\Mods` |
| Archive already containing `Windows\ForeverWinter\...` | `tfw-game-root` | Game root, preserving that structure |

Unknown bare PAK triplets intentionally default to `Windows\ForeverWinter\Content\Paks\Mods`. Root-Paks support should grow through specific filename rules and user reports.

## Deployment Method Notes

The game and Signature Bypass appear most reliable when Unreal container files are real files in the game folder. If Vortex deploys `.pak`, `.ucas`, or `.utoc` files as symbolic links, some setups may crash on startup even though the same files work when copied manually.

After each Vortex deploy, this extension checks the The Forever Winter PAK folders and replaces symlinked `.pak`, `.ucas`, and `.utoc` files with physical copies from the Vortex staging target. This only touches deployed Unreal container files in:

```text
Windows\ForeverWinter\Content\Paks
Windows\ForeverWinter\Content\Paks\Mods
```

If you still see deployment or permission errors, switch Vortex to **Hardlink Deployment** or **Copy Deployment** if available, then purge and redeploy. For Steam installs under `C:\Program Files (x86)`, Windows permissions may block some deployment methods unless Vortex runs as administrator. A Steam library outside Program Files, such as `C:\Games\SteamLibrary` or another drive, is usually easier for Vortex to manage.

## UE4SS Notes

UE4SS is a general Unreal Engine mod loader, not a The Forever Winter-specific Nexus file. The official releases are here:

https://github.com/UE4SS-RE/RE-UE4SS/releases

For The Forever Winter, prefer UE4SS `experimental-latest` unless a mod author tells you to use a specific build. Current experimental builds include newer UE 5.4 scan support and use the cleaner subfolder layout this extension targets: `dwmapi.dll` in `Win64`, with `UE4SS.dll`, `UE4SS-settings.ini`, signatures, and mods under `Win64\ue4ss`. Download the UE4SS zip yourself, then add it to Vortex with drag-and-drop or **Install From File**.

UE4SS v3.0.1 used the older root layout where `UE4SS.dll`, `UE4SS-settings.ini`, and `Mods` sit directly in `Win64`. The extension can route that archive, but separately installed UE4SS mods are deployed to `Win64\ue4ss\Mods`; with the old root layout, UE4SS will ignore those mods unless `ModsFolderPath = ue4ss\Mods` is set in `UE4SS-settings.ini`. After deployment, the extension warns if it detects that old root layout alongside deployed `ue4ss\Mods` content.

The extension supports these common UE4SS loader layouts:

- Official/basic layout with `dwmapi.dll`, `UE4SS.dll`, `UE4SS-settings.ini`, `Mods\...`, and `UE4SS_Signatures\...`
- Game-specific layout with `dwmapi.dll` next to a `ue4ss\...` folder
- Mod-package layout with a root `Mods\...` folder next to an included `ue4ss` folder; the extension moves that `Mods` folder under `Win64\ue4ss`

UE4SS loader packages that contain `dwmapi.dll` and a `ue4ss` folder are installed to:

```text
Windows\ForeverWinter\Binaries\Win64
```

UE4SS mod-only archives under `ue4ss\Mods\<mod>` are installed to:

```text
Windows\ForeverWinter\Binaries\Win64\ue4ss\Mods
```

If a UE4SS archive also contains PAK files, the extension installs it as a game-root mod so the UE4SS part and PAK part can land in separate game folders. The PAK part still follows the normal routing rules: known root-Paks go to `Content\Paks`, and unknown bare triplets default to `Content\Paks\Mods`.

Some The Forever Winter mod archives bundle their own copy of UE4SS, Signature Bypass, or shared UE4SS helper files alongside the actual mod. Those bundled dependency files are intentionally skipped when the archive also contains a real UE4SS mod folder. Install UE4SS and Signature Bypass as their own Vortex mods, then install content mods like NoRecoil or Cheaper Innards Upgrades on top. This avoids Vortex conflicts over shared files such as `dwmapi.dll`, `UE4SS.dll`, `UE4SS-settings.ini`, `mods.txt`, `mods.json`, `Keybinds`, `shared`, `dsound.dll`, and `bitfix`.

After Vortex deploys mods, the extension regenerates shared UE4SS manifests from the deployed folders in `Windows\ForeverWinter\Binaries\Win64\ue4ss\Mods`. It writes both:

```text
mods.txt
mods.json
```

Existing UE4SS built-in entries are preserved when present, stale custom entries are removed when their folder is no longer deployed, and current UE4SS mod folders are written as enabled. When Vortex provides active profile state during deploy, the generated manifests are limited to folders matching enabled Vortex mods; this helps profile and collection switches stop loading mods that Vortex has disabled even if stale folders remain in `Win64\ue4ss\Mods`. Global `mods.txt` and `mods.json` files from UE4SS content archives are skipped during install so individual mods do not fight over the shared manifest files.

When a mod offers both a UE4SS version and an older pure asset/PAK version, prefer the UE4SS version if the mod author says that is the maintained path. The extension does not convert pure asset mods into UE4SS mods; it only routes the files in the archive you install.

### TFWWorkbench

TFWWorkbench is a GitHub-hosted UE4SS mod for runtime data-table changes:

https://github.com/smotti/TFWWorkbench/releases

The extension recognizes the official release archive layout and installs the `TFWWorkbench` folder to:

```text
Windows\ForeverWinter\Binaries\Win64\ue4ss\Mods
```

It also creates the expected data folder when Vortex supports the directory instruction:

```text
Windows\ForeverWinter\Content\Paks\Mods\TFWWorkbench
```

The release archive's `Examples` folder is intentionally skipped. Copy examples manually only when you want to inspect or adapt them; they are not deployed as active mods by default. After deployment, the extension enables the deployed `TFWWorkbench` folder in the shared UE4SS manifests.

### UE4SS Manifest Linting

This repo includes a small manifest linter/normalizer for inspecting UE4SS `mods.txt` and `mods.json` files outside Vortex:

```powershell
npm run lint:ue4ss-manifest -- path\to\mods.json
```

Add `--write` to rewrite the file in normalized form:

```powershell
npm run lint:ue4ss-manifest -- path\to\mods.json --write
```

The linter can recover from simple missing-comma `mods.json` files and also understands `mods.txt` entries like `NoRecoil : 1`. Vortex uses the same parser internally when regenerating shared UE4SS manifests after deployment.

## Signature Bypass Policy

Many PAK mods require Signature Bypass:

https://www.nexusmods.com/theforeverwinter/mods/57

This extension does not bundle or redistribute Signature Bypass. Download it from Nexus yourself, then add that downloaded archive to Vortex with drag-and-drop or **Install From File**. The extension routes only the user-provided bypass files into the game Win64 folder:

- `dsound.dll`
- `version.dll` if the archive does not provide `dsound.dll`
- `bitfix\...`
- `bitfix*` marker/text files

`dsound.dll` is preferred for the Nov 2025 bypass. `version.dll` is supported for users who need that alternate proxy path, but some mod authors note it may be less reliable for PAK loading.

The recommended page is the newer November 2025 bypass:

https://www.nexusmods.com/theforeverwinter/mods/57

The original 2024 bypass is useful as a fallback/reference only:

https://www.nexusmods.com/theforeverwinter/mods/3

The extension checks for `dsound.dll` or `version.dll` plus a `bitfix` folder or `bitfix.txt` in:

```text
Windows\ForeverWinter\Binaries\Win64
```

If those files are missing, Vortex shows a warning with a link to the mod page.

## Early Access Notes

The Forever Winter is still in Early Access. Game updates can break Signature Bypass or direct data-edit mods, and some mod authors already call out fragility across updates. Treat this as beta support and verify after game patches.

SteamOS/Linux support is documentation-only for this release.

## Development

Run the test suite:

```powershell
npm test
```

Build a release zip containing only runtime extension files:

```powershell
npm run package
```

The package is written to `dist/the-forever-winter-vortex-extension-0.0.7.zip`.

## Manual Smoke Test

- Extension loads without errors in Vortex.
- Steam discovery finds app ID `2828860`, or manual path selection validates with `Windows\ForeverWinter\Binaries\Win64\ForeverWinter-Win64-Shipping.exe`.
- Managing the game creates `Windows\ForeverWinter\Content\Paks\Mods`.
- Missing Signature Bypass shows the warning notification.
- A user-downloaded Signature Bypass archive installs `dsound.dll`, `bitfix\...`, and `bitfix*` files to `Windows\ForeverWinter\Binaries\Win64`.
- UE4SS `experimental-latest` installs `dwmapi.dll` to `Windows\ForeverWinter\Binaries\Win64` and UE4SS runtime files to `Windows\ForeverWinter\Binaries\Win64\ue4ss`.
- A legacy root-layout UE4SS install plus deployed `ue4ss\Mods` content shows the UE4SS legacy layout warning.
- A mixed UE4SS plus PAK archive deploys the actual UE4SS mod folder and PAK triplet while skipping bundled dependency/runtime files.
- Sample archives deploy to their expected folders and uninstall cleanly.
