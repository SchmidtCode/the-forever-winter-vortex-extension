const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { MOD_TYPES } = require('../src/constants');
const {
  buildInstallInstructions,
  hasPakTriplet,
  isSignatureBypassArchive,
  isTFWWorkbenchArchive,
  testSupportedContent,
  testSupportedSignatureBypass,
} = require('../src/installers');

function copyDestinations(result) {
  return result.instructions
    .filter((instruction) => instruction.type === 'copy')
    .map((instruction) => instruction.destination)
    .sort();
}

function mkdirDestinations(result) {
  return result.instructions
    .filter((instruction) => instruction.type === 'mkdir')
    .map((instruction) => instruction.destination)
    .sort();
}

test('Signature Bypass archive routes user-provided loader files to Win64 root', async () => {
  const files = [
    'Signature Bypass/dsound.dll',
    'Signature Bypass/bitfix/config.toml',
    'Signature Bypass/bitfix.txt',
  ];

  assert.equal(isSignatureBypassArchive(files), true);
  assert.deepEqual(await testSupportedSignatureBypass(files, 'theforeverwinter'), {
    supported: true,
    requiredFiles: [],
  });
  assert.deepEqual(await testSupportedContent(files, 'theforeverwinter'), {
    supported: false,
    requiredFiles: [],
  });

  const result = buildInstallInstructions(files);
  assert.equal(result.kind, 'signature-bypass');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(copyDestinations(result), [
    path.join('bitfix', 'config.toml'),
    'bitfix.txt',
    'dsound.dll',
  ].sort());
});

test('Signature Bypass archive with game paths still flattens to Win64 root', () => {
  const result = buildInstallInstructions([
    'Signature Bypass/Windows/ForeverWinter/Binaries/Win64/dsound.dll',
    'Signature Bypass/Windows/ForeverWinter/Binaries/Win64/bitfix/config.toml',
    'Signature Bypass/Windows/ForeverWinter/Binaries/Win64/bitfix.txt',
    'Signature Bypass/readme.txt',
  ]);

  assert.equal(result.kind, 'signature-bypass');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(copyDestinations(result), [
    path.join('bitfix', 'config.toml'),
    'bitfix.txt',
    'dsound.dll',
  ].sort());
});

test('Signature Bypass archive can use version dll when dsound is absent', () => {
  const result = buildInstallInstructions([
    'Signature Bypass/version.dll',
    'Signature Bypass/bitfix/config.toml',
  ]);

  assert.equal(isSignatureBypassArchive([
    'Signature Bypass/version.dll',
    'Signature Bypass/bitfix/config.toml',
  ]), true);
  assert.equal(result.kind, 'signature-bypass');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(copyDestinations(result), [
    path.join('bitfix', 'config.toml'),
    'version.dll',
  ].sort());
});

test('Signature Bypass archive prefers dsound when both proxies are present', () => {
  const result = buildInstallInstructions([
    'Signature Bypass/dsound.dll',
    'Signature Bypass/version.dll',
    'Signature Bypass/bitfix/config.toml',
  ]);

  assert.equal(result.kind, 'signature-bypass');
  assert.deepEqual(copyDestinations(result), [
    path.join('bitfix', 'config.toml'),
    'dsound.dll',
  ].sort());
});

test('No Recoil-style archive with bundled UE4SS installs only the mod folder', () => {
  const result = buildInstallInstructions([
    'NoRecoil/dwmapi.dll',
    'NoRecoil/ue4ss/LICENSE',
    'NoRecoil/ue4ss/UE4SS.dll',
    'NoRecoil/ue4ss/UE4SS-settings.ini',
    'NoRecoil/ue4ss/Mods/Keybinds/Scripts/main.lua',
    'NoRecoil/ue4ss/Mods/NoRecoil/enabled.txt',
    'NoRecoil/ue4ss/Mods/NoRecoil/Scripts/main.lua',
    'NoRecoil/ue4ss/Mods/mods.json',
    'NoRecoil/ue4ss/Mods/mods.txt',
    'NoRecoil/ue4ss/Mods/shared/UEHelpers/UEHelpers.lua',
  ]);

  assert.equal(result.kind, 'ue4ss-mod');
  assert.equal(result.modType, MOD_TYPES.UE4SS_MODS);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('NoRecoil', 'Scripts', 'main.lua'),
    path.join('NoRecoil', 'enabled.txt'),
  ].sort());
});

test('official UE4SS basic release archive routes loader package to Win64 root', () => {
  const result = buildInstallInstructions([
    'UE4SS_v3.0.1/dwmapi.dll',
    'UE4SS_v3.0.1/UE4SS.dll',
    'UE4SS_v3.0.1/UE4SS-settings.ini',
    'UE4SS_v3.0.1/Mods/mods.txt',
    'UE4SS_v3.0.1/UE4SS_Signatures/FName.ini',
    'UE4SS_v3.0.1/README.md',
  ]);

  assert.equal(result.kind, 'ue4ss-win64');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(copyDestinations(result), [
    'dwmapi.dll',
    path.join('Mods', 'mods.txt'),
    'UE4SS-settings.ini',
    'UE4SS.dll',
    path.join('UE4SS_Signatures', 'FName.ini'),
  ].sort());
});

test('experimental UE4SS subfolder release archive preserves modern loader layout', () => {
  const result = buildInstallInstructions([
    'UE4SS_experimental/dwmapi.dll',
    'UE4SS_experimental/ue4ss/UE4SS.dll',
    'UE4SS_experimental/ue4ss/UE4SS-settings.ini',
    'UE4SS_experimental/ue4ss/Mods/mods.txt',
    'UE4SS_experimental/ue4ss/Mods/Keybinds/Scripts/main.lua',
    'UE4SS_experimental/ue4ss/UE4SS_Signatures/FName.ini',
    'UE4SS_experimental/README.md',
  ]);

  assert.equal(result.kind, 'ue4ss-win64');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(copyDestinations(result), [
    'dwmapi.dll',
    path.join('ue4ss', 'Mods', 'Keybinds', 'Scripts', 'main.lua'),
    path.join('ue4ss', 'Mods', 'mods.txt'),
    path.join('ue4ss', 'UE4SS-settings.ini'),
    path.join('ue4ss', 'UE4SS.dll'),
    path.join('ue4ss', 'UE4SS_Signatures', 'FName.ini'),
  ].sort());
});

test('Cheaper Innards-style archive installs only content mod files and PAKs', () => {
  const result = buildInstallInstructions([
    'CheaperInnards/dwmapi.dll',
    'CheaperInnards/dsound.dll',
    'CheaperInnards/version.dll',
    'CheaperInnards/bitfix/config.toml',
    'CheaperInnards/bitfix/sig.lua',
    'CheaperInnards/ue4ss/LICENSE',
    'CheaperInnards/ue4ss/UE4SS.dll',
    'CheaperInnards/ue4ss/UE4SS-settings.ini',
    'CheaperInnards/ue4ss/Mods/Keybinds/Scripts/main.lua',
    'CheaperInnards/ue4ss/Mods/shared/UEHelpers/UEHelpers.lua',
    'CheaperInnards/ue4ss/Mods/mods.json',
    'CheaperInnards/ue4ss/Mods/mods.txt',
    'CheaperInnards/Mods/mods.txt',
    'CheaperInnards/Mods/BPModLoaderMod/Scripts/main.lua',
    'CheaperInnards/Mods/CheaperInnardsUpgrades/Scripts/main.lua',
    'CheaperInnards/Mods/CheaperInnardsUpgrades/UpgradeCosts.json',
    'CheaperInnards/Mods/shared/json.lua',
    'CheaperInnards/Paks/CheaperInnardsUpgrades_P.pak',
    'CheaperInnards/Paks/CheaperInnardsUpgrades_P.ucas',
    'CheaperInnards/Paks/CheaperInnardsUpgrades_P.utoc',
  ]);

  assert.equal(result.kind, 'mixed-ue4ss-pak');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'BPModLoaderMod', 'Scripts', 'main.lua'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'CheaperInnardsUpgrades', 'Scripts', 'main.lua'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'CheaperInnardsUpgrades', 'UpgradeCosts.json'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'shared', 'json.lua'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnardsUpgrades_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnardsUpgrades_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnardsUpgrades_P.utoc'),
  ].sort());
});

test('Cheaper Innards 0.5 archive deploys root Mods content while skipping bundled loader', () => {
  const result = buildInstallInstructions([
    'dwmapi.dll',
    'dsound.dll',
    'version.dll',
    'bitfix/sig.lua',
    'ue4ss/LICENSE',
    'ue4ss/UE4SS.dll',
    'ue4ss/UE4SS-settings.ini',
    'ue4ss/Mods/BPML_GenericFunctions/Scripts/main.lua',
    'ue4ss/Mods/BPModLoaderMod/Scripts/main.lua',
    'ue4ss/Mods/CheatManagerEnablerMod/Scripts/main.lua',
    'ue4ss/Mods/ConsoleCommandsMod/Scripts/main.lua',
    'ue4ss/Mods/ConsoleEnablerMod/Scripts/main.lua',
    'ue4ss/Mods/Keybinds/Scripts/main.lua',
    'ue4ss/Mods/shared/UEHelpers/UEHelpers.lua',
    'ue4ss/Mods/mods.txt',
    'ue4ss/Mods/mods.json',
    'Mods/BPModLoaderMod/Scripts/main.lua',
    'Mods/BPModLoaderMod/load_order.txt',
    'Mods/CheaperInnardsUpgrades/Scripts/main.lua',
    'Mods/CheaperInnardsUpgrades/UpgradeCosts.json',
    'Mods/shared/json.lua',
  ]);

  assert.equal(result.kind, 'ue4ss-mod');
  assert.equal(result.modType, MOD_TYPES.UE4SS_MODS);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('BPModLoaderMod', 'Scripts', 'main.lua'),
    path.join('BPModLoaderMod', 'load_order.txt'),
    path.join('CheaperInnardsUpgrades', 'Scripts', 'main.lua'),
    path.join('CheaperInnardsUpgrades', 'UpgradeCosts.json'),
    path.join('shared', 'json.lua'),
  ].sort());
});

test('UE4SS mod folder without loader routes to ue4ss Mods and warns', () => {
  const result = buildInstallInstructions([
    'ue4ss/Mods/mods.txt',
    'ue4ss/Mods/mods.json',
    'ue4ss/Mods/NoRecoil/enabled.txt',
    'ue4ss/Mods/NoRecoil/Scripts/main.lua',
  ]);

  assert.equal(result.kind, 'ue4ss-mod');
  assert.equal(result.modType, MOD_TYPES.UE4SS_MODS);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('NoRecoil', 'Scripts', 'main.lua'),
    path.join('NoRecoil', 'enabled.txt'),
  ].sort());
});

test('root Mods folder without loader routes under ue4ss Mods and warns', () => {
  const result = buildInstallInstructions([
    'Mods/CheaperInnardsUpgrades/Scripts/main.lua',
    'Mods/CheaperInnardsUpgrades/UpgradeCosts.json',
    'Mods/mods.txt',
    'Mods/mods.json',
  ]);

  assert.equal(result.kind, 'ue4ss-mod');
  assert.equal(result.modType, MOD_TYPES.UE4SS_MODS);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('CheaperInnardsUpgrades', 'Scripts', 'main.lua'),
    path.join('CheaperInnardsUpgrades', 'UpgradeCosts.json'),
  ].sort());
});

test('root Mods folder containing only PAK triplet routes to Paks Mods', () => {
  const result = buildInstallInstructions([
    'Mods/132-HeadshotMultiplierEquality_P.pak',
    'Mods/132-HeadshotMultiplierEquality_P.ucas',
    'Mods/132-HeadshotMultiplierEquality_P.utoc',
    'README.txt',
  ]);

  assert.equal(result.kind, 'pak');
  assert.equal(result.modType, MOD_TYPES.PAKS_MODS);
  assert.deepEqual(copyDestinations(result), [
    '132-HeadshotMultiplierEquality_P.pak',
    '132-HeadshotMultiplierEquality_P.ucas',
    '132-HeadshotMultiplierEquality_P.utoc',
  ].sort());
});

test('TFWWorkbench release archive installs mod folder, skips examples, and creates data folder', () => {
  const files = [
    'Examples/Item/001_TestItem.json',
    'TFWWorkbench/dlls/main.dll',
    'TFWWorkbench/Scripts/json.lua',
    'TFWWorkbench/Scripts/main.lua',
  ];
  const result = buildInstallInstructions(files);

  assert.equal(isTFWWorkbenchArchive(files), true);
  assert.equal(result.kind, 'tfw-workbench');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(mkdirDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'TFWWorkbench'),
  ]);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'TFWWorkbench', 'Scripts', 'json.lua'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'TFWWorkbench', 'Scripts', 'main.lua'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'TFWWorkbench', 'dlls', 'main.dll'),
  ].sort());
});

test('mixed UE4SS mod and PAK archive routes each part from game root', () => {
  const result = buildInstallInstructions([
    'CheaperInnards/ue4ss/Mods/CheaperInnards/enabled.txt',
    'CheaperInnards/ue4ss/Mods/CheaperInnards/Scripts/main.lua',
    'CheaperInnards/Paks/CheaperInnards_P.pak',
    'CheaperInnards/Paks/CheaperInnards_P.ucas',
    'CheaperInnards/Paks/CheaperInnards_P.utoc',
  ]);

  assert.equal(result.kind, 'mixed-ue4ss-pak');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'CheaperInnards', 'Scripts', 'main.lua'),
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'CheaperInnards', 'enabled.txt'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnards_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnards_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'CheaperInnards_P.utoc'),
  ].sort());
});

test('mixed UE4SS loader package and root PAK archive routes from game root', () => {
  const result = buildInstallInstructions([
    'Combo/dwmapi.dll',
    'Combo/ue4ss/UE4SS.dll',
    'Combo/ue4ss/Mods/Threshold/enabled.txt',
    'Combo/Increased Hunter Killers Spawn Threshold_P.pak',
    'Combo/Increased Hunter Killers Spawn Threshold_P.ucas',
    'Combo/Increased Hunter Killers Spawn Threshold_P.utoc',
  ]);

  assert.equal(result.kind, 'mixed-ue4ss-pak');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(result.warnings, ['ue4ss-loader-missing']);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'Threshold', 'enabled.txt'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Increased Hunter Killers Spawn Threshold_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Increased Hunter Killers Spawn Threshold_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Increased Hunter Killers Spawn Threshold_P.utoc'),
  ].sort());
});

test('game-root content archive skips bundled UE4SS and Signature Bypass dependencies', () => {
  const result = buildInstallInstructions([
    'Archive/Windows/ForeverWinter/Binaries/Win64/dsound.dll',
    'Archive/Windows/ForeverWinter/Binaries/Win64/bitfix/sig.lua',
    'Archive/Windows/ForeverWinter/Binaries/Win64/dwmapi.dll',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/UE4SS.dll',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/UE4SS-settings.ini',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/mods.txt',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/shared/UEHelpers/UEHelpers.lua',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/NoRecoil/Scripts/main.lua',
    'Archive/Windows/ForeverWinter/Content/Paks/Mods/NoRecoil_P.pak',
    'Archive/Windows/ForeverWinter/Content/Paks/Mods/NoRecoil_P.ucas',
    'Archive/Windows/ForeverWinter/Content/Paks/Mods/NoRecoil_P.utoc',
  ]);

  assert.equal(result.kind, 'game-root');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64', 'ue4ss', 'Mods', 'NoRecoil', 'Scripts', 'main.lua'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'NoRecoil_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'NoRecoil_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'NoRecoil_P.utoc'),
  ].sort());
});

test('game-root archive with PAK triplet under Win64 ue4ss Mods reroutes to Paks Mods', () => {
  const result = buildInstallInstructions([
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/132-HeadshotMultiplierEquality_P.pak',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/132-HeadshotMultiplierEquality_P.ucas',
    'Archive/Windows/ForeverWinter/Binaries/Win64/ue4ss/Mods/132-HeadshotMultiplierEquality_P.utoc',
  ]);

  assert.equal(result.kind, 'game-root');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', '132-HeadshotMultiplierEquality_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', '132-HeadshotMultiplierEquality_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', '132-HeadshotMultiplierEquality_P.utoc'),
  ].sort());
});

test('RemoveStun triplet routes to Paks Mods', () => {
  const files = [
    'RemoveStun/RemoveStun_P.pak',
    'RemoveStun/RemoveStun_P.ucas',
    'RemoveStun/RemoveStun_P.utoc',
  ];
  const result = buildInstallInstructions(files);

  assert.equal(hasPakTriplet(files), true);
  assert.equal(result.kind, 'pak');
  assert.equal(result.modType, MOD_TYPES.PAKS_MODS);
  assert.deepEqual(copyDestinations(result), [
    'RemoveStun_P.pak',
    'RemoveStun_P.ucas',
    'RemoveStun_P.utoc',
  ]);
});

test('Increased Hunter Killers triplet routes to root Paks', () => {
  const result = buildInstallInstructions([
    'Increased Hunter Killers Spawn Threshold/Increased Hunter Killers Spawn Threshold_P.pak',
    'Increased Hunter Killers Spawn Threshold/Increased Hunter Killers Spawn Threshold_P.ucas',
    'Increased Hunter Killers Spawn Threshold/Increased Hunter Killers Spawn Threshold_P.utoc',
  ]);

  assert.equal(result.kind, 'pak');
  assert.equal(result.modType, MOD_TYPES.PAKS_ROOT);
  assert.deepEqual(copyDestinations(result), [
    'Increased Hunter Killers Spawn Threshold_P.pak',
    'Increased Hunter Killers Spawn Threshold_P.ucas',
    'Increased Hunter Killers Spawn Threshold_P.utoc',
  ]);
});

test('unknown bare triplet defaults to Paks Mods', () => {
  const result = buildInstallInstructions([
    'MyBalance_P.pak',
    'MyBalance_P.ucas',
    'MyBalance_P.utoc',
  ]);

  assert.equal(result.kind, 'pak');
  assert.equal(result.modType, MOD_TYPES.PAKS_MODS);
  assert.deepEqual(copyDestinations(result), [
    'MyBalance_P.pak',
    'MyBalance_P.ucas',
    'MyBalance_P.utoc',
  ]);
});

test('all-in-one Windows ForeverWinter archive preserves game-relative paths', () => {
  const result = buildInstallInstructions([
    'AllInOne/Windows/ForeverWinter/Content/Paks/Mods/MyBalance_P.pak',
    'AllInOne/Windows/ForeverWinter/Content/Paks/Mods/MyBalance_P.ucas',
    'AllInOne/Windows/ForeverWinter/Content/Paks/Mods/MyBalance_P.utoc',
    'AllInOne/readme.txt',
  ]);

  assert.equal(result.kind, 'game-root');
  assert.equal(result.modType, MOD_TYPES.GAME_ROOT);
  assert.deepEqual(copyDestinations(result), [
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'MyBalance_P.pak'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'MyBalance_P.ucas'),
    path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods', 'MyBalance_P.utoc'),
  ]);
});

test('unsupported content is not claimed', async () => {
  assert.deepEqual(await testSupportedContent(['readme.txt'], 'theforeverwinter'), {
    supported: false,
    requiredFiles: [],
  });
  assert.deepEqual(await testSupportedContent(['MyBalance_P.pak'], 'othergame'), {
    supported: false,
    requiredFiles: [],
  });
});
