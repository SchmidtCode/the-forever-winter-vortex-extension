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
| UE4SS loader archive with `dwmapi.dll` and `ue4ss` | `tfw-win64-root` | `Windows\ForeverWinter\Binaries\Win64` |
| UE4SS mod archive under `ue4ss\Mods\<mod>` | `tfw-ue4ss-mods` | `Windows\ForeverWinter\Binaries\Win64\ue4ss\Mods` |
| Archive already containing `Windows\ForeverWinter\...` | `tfw-game-root` | Game root, preserving that structure |

Unknown bare PAK triplets intentionally default to `Windows\ForeverWinter\Content\Paks\Mods`. Root-Paks support should grow through specific filename rules and user reports.

## Signature Bypass Policy

Many PAK mods require Signature Bypass:

https://www.nexusmods.com/theforeverwinter/mods/57

This extension only detects and links to Signature Bypass. It does not bundle it, redistribute it, or deploy downloaded Signature Bypass archives. If Vortex sees a likely Signature Bypass archive, it will skip deployment and tell the user to follow the mod page instructions manually.

The extension checks for `dsound.dll` plus a `bitfix` folder or `bitfix.txt` in:

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
- Sample archives deploy to their expected folders and uninstall cleanly.
