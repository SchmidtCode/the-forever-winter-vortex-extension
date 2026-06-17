# Changelog

## 0.0.7-beta

- Materialize symlinked UE4SS runtime files after deployment (`dwmapi.dll`, `ue4ss\UE4SS.dll`, and `ue4ss\UE4SS-settings.ini`) so Vortex installs more closely match manual UE4SS installs.

## 0.0.6-beta

- Deploy root `Mods\...` content from Cheaper Innards-style archives, including mod-provided `BPModLoaderMod` and `shared` files, while still skipping bundled UE4SS loader/runtime files.

## 0.0.5-beta

- Restore post-deploy materialization of symlinked `.pak`, `.ucas`, and `.utoc` files because The Forever Winter can crash when those files remain symlinks.
- Preserve staged file timestamps and mode when materializing PAK containers to reduce Vortex External Changes prompts.
- Document choosing **Use newer file** if Vortex still reports materialized PAK containers as external changes.

## 0.0.4-beta

- Stop rewriting deployed `.pak`, `.ucas`, and `.utoc` symlinks after deployment to avoid Vortex External Changes prompts.
- Warn when PAK container files are deployed as symlinks so users can switch to Hardlink or Copy Deployment and redeploy.
- Reroute game-root archives that incorrectly place PAK triplets under `Win64\ue4ss\Mods` or `Win64\Mods` back to normal PAK folders.

## 0.0.3-beta

- Prefer and document the UE4SS `experimental-latest` subfolder layout for The Forever Winter.
- Preserve modern UE4SS archives with `dwmapi.dll` in Win64 and runtime files under `Win64\ue4ss`.
- Warn when a legacy root-layout UE4SS install is present alongside deployed `Win64\ue4ss\Mods` content.

## 0.0.2-beta

- Mark The Forever Winter mod types as deployment-essential.
- Include the new PAK deployment runtime helper in the release package.
- Document Vortex deployment method guidance for PAK container files.

## 0.0.1-beta

- Register The Forever Winter as a Vortex game extension for Steam app `2828860`.
- Add PAK triplet routing for `Content\Paks\Mods` and known root `Content\Paks` examples.
- Add UE4SS archive routing for Win64 loader packages and `ue4ss\Mods` mod folders.
- Add official/basic UE4SS release routing for `UE4SS.dll`, `UE4SS-settings.ini`, `Mods`, and signature folders.
- Add Cheaper Innards-style UE4SS archive normalization for root `Mods` folders packaged next to `ue4ss`.
- Add dedicated TFWWorkbench release routing, skipping examples and preparing the expected data folder.
- Add mixed UE4SS plus PAK archive routing through the game-root mod type.
- Skip global `mods.txt` and `mods.json` from UE4SS mod-only archives to avoid conflicts with the UE4SS base install.
- Suppress UE4SS dependency warnings when UE4SS is already installed in Vortex or deployed to Win64.
- Add UE4SS manifest parsing and a `lint:ue4ss-manifest` helper for normalizing `mods.txt` and tolerant `mods.json` files.
- Regenerate shared UE4SS `mods.txt` and `mods.json` after deployment from the deployed UE4SS mod folders.
- Treat NoRecoil/Cheaper-style archives with bundled UE4SS or Signature Bypass files as content mods, skipping shared runtime/dependency files that should be installed separately.
- Skip UE4SS built-in/shared folders and generated manifest files from bundled content mod archives to reduce Vortex file conflicts.
- Do not auto-enable UE4SS built-in folders or the `shared` helper folder just because they exist under `ue4ss\Mods`.
- Add game-root preservation for archives already containing `Windows\ForeverWinter\...`.
- Add Signature Bypass detection and user-archive routing to the game Win64 folder without bundling or redistributing bypass files.
- Support `version.dll` as the alternate Signature Bypass proxy when `dsound.dll` is absent.
- Add unit tests and a release packaging script.
