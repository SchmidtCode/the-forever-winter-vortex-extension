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
| Mixed UE4SS plus PAK archive | `tfw-game-root` | UE4SS files to Win64, PAK files to `Content\Paks` or `Content\Paks\Mods` |
| Archive already containing `Windows\ForeverWinter\...` | `tfw-game-root` | Game root, preserving that structure |

Unknown bare PAK triplets intentionally default to `Windows\ForeverWinter\Content\Paks\Mods`. Root-Paks support should grow through specific filename rules and user reports.

## UE4SS Notes

UE4SS is a general Unreal Engine mod loader, not a The Forever Winter-specific Nexus file. The official releases are here:

https://github.com/UE4SS-RE/RE-UE4SS/releases

For normal mod use, prefer the latest non-dev `UE4SS_v...` release unless a mod author tells you to use a specific build. Download the UE4SS zip yourself, then add it to Vortex with drag-and-drop or **Install From File**. The extension supports both common UE4SS loader layouts:

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

Some UE4SS mods may still require enabling in `mods.txt` depending on their UE4SS version and archive layout. This beta copies `mods.txt` when the mod archive provides one, but it does not merge or edit an existing `mods.txt`, because overwriting that file could disable other UE4SS mods.

When a mod offers both a UE4SS version and an older pure asset/PAK version, prefer the UE4SS version if the mod author says that is the maintained path. The extension does not convert pure asset mods into UE4SS mods; it only routes the files in the archive you install.

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

The package is written to `dist/the-forever-winter-vortex-extension-0.0.1.zip`.

## Manual Smoke Test

- Extension loads without errors in Vortex.
- Steam discovery finds app ID `2828860`, or manual path selection validates with `Windows\ForeverWinter\Binaries\Win64\ForeverWinter-Win64-Shipping.exe`.
- Managing the game creates `Windows\ForeverWinter\Content\Paks\Mods`.
- Missing Signature Bypass shows the warning notification.
- A user-downloaded Signature Bypass archive installs `dsound.dll`, `bitfix\...`, and `bitfix*` files to `Windows\ForeverWinter\Binaries\Win64`.
- A mixed UE4SS plus PAK archive deploys the UE4SS files to Win64 and the PAK triplet to the expected PAK folder.
- Sample archives deploy to their expected folders and uninstall cleanly.
