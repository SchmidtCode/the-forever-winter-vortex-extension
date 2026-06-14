const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { MOD_TYPES } = require('../src/constants');
const {
  buildInstallInstructions,
  hasPakTriplet,
  isSignatureBypassArchive,
  testSupportedContent,
  testSupportedSignatureBypass,
} = require('../src/installers');

function copyDestinations(result) {
  return result.instructions
    .filter((instruction) => instruction.type === 'copy')
    .map((instruction) => instruction.destination)
    .sort();
}

test('missing Signature Bypass archive is handled by signature installer only', async () => {
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
  assert.deepEqual(result.instructions, []);
  assert.deepEqual(result.warnings, ['signature-bypass-manual-install']);
});

test('No Recoil-style UE4SS archive routes loader package to Win64 root', () => {
  const result = buildInstallInstructions([
    'NoRecoil/dwmapi.dll',
    'NoRecoil/ue4ss/UE4SS.dll',
    'NoRecoil/ue4ss/Mods/NoRecoil/enabled.txt',
    'NoRecoil/ue4ss/Mods/NoRecoil/Scripts/main.lua',
  ]);

  assert.equal(result.kind, 'ue4ss-win64');
  assert.equal(result.modType, MOD_TYPES.WIN64_ROOT);
  assert.deepEqual(copyDestinations(result), [
    'dwmapi.dll',
    path.join('ue4ss', 'Mods', 'NoRecoil', 'Scripts', 'main.lua'),
    path.join('ue4ss', 'Mods', 'NoRecoil', 'enabled.txt'),
    path.join('ue4ss', 'UE4SS.dll'),
  ].sort());
});

test('UE4SS mod folder without loader routes to ue4ss Mods and warns', () => {
  const result = buildInstallInstructions([
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
