# Changelog

## 0.0.1-beta

- Register The Forever Winter as a Vortex game extension for Steam app `2828860`.
- Add PAK triplet routing for `Content\Paks\Mods` and known root `Content\Paks` examples.
- Add UE4SS archive routing for Win64 loader packages and `ue4ss\Mods` mod folders.
- Add official/basic UE4SS release routing for `UE4SS.dll`, `UE4SS-settings.ini`, `Mods`, and signature folders.
- Add Cheaper Innards-style UE4SS archive normalization for root `Mods` folders packaged next to `ue4ss`.
- Add mixed UE4SS plus PAK archive routing through the game-root mod type.
- Skip global `mods.txt` and `mods.json` from UE4SS mod-only archives to avoid conflicts with the UE4SS base install.
- Suppress UE4SS dependency warnings when UE4SS is already installed in Vortex or deployed to Win64.
- Add UE4SS manifest parsing and a `lint:ue4ss-manifest` helper for normalizing `mods.txt` and tolerant `mods.json` files.
- Add game-root preservation for archives already containing `Windows\ForeverWinter\...`.
- Add Signature Bypass detection and user-archive routing to the game Win64 folder without bundling or redistributing bypass files.
- Support `version.dll` as the alternate Signature Bypass proxy when `dsound.dll` is absent.
- Add unit tests and a release packaging script.
