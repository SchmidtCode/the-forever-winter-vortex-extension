const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  GAME_ID,
  MOD_TYPES,
  UE4SS_MODS_PATH,
} = require('../src/constants');
const {
  collectProfileModState,
  normalizeModName,
  ue4ssFolderNamesFromMod,
  ue4ssManifestFilterForState,
} = require('../src/ue4ss-profile');

function normalizedSetValues(values) {
  return Array.from(values).sort();
}

test('ue4ssFolderNamesFromMod reads actual UE4SS folders from relative mod-root files', () => {
  const folders = ue4ssFolderNamesFromMod({
    type: MOD_TYPES.UE4SS_MODS,
    files: [
      path.join('NoRecoil', 'enabled.txt'),
      path.join('NoRecoil', 'Scripts', 'main.lua'),
      path.join('Keybinds', 'Scripts', 'main.lua'),
      path.join('shared', 'json.lua'),
      'mods.txt',
    ],
  });

  assert.deepEqual(normalizedSetValues(folders), ['NoRecoil']);
});

test('ue4ssFolderNamesFromMod reads actual UE4SS folders from game-root destinations', () => {
  const folders = ue4ssFolderNamesFromMod({
    type: MOD_TYPES.GAME_ROOT,
    files: [
      {
        destination: path.join(
          'Windows',
          'ForeverWinter',
          'Binaries',
          'Win64',
          'ue4ss',
          'Mods',
          'TFWWorkbench',
          'Scripts',
          'main.lua',
        ),
      },
      {
        destination: path.join(
          'Windows',
          'ForeverWinter',
          'Content',
          'Paks',
          'Mods',
          'TFWWorkbench_P.pak',
        ),
      },
    ],
  });

  assert.deepEqual(normalizedSetValues(folders), ['TFWWorkbench']);
});

test('collectProfileModState merges partial profile-state sources by priority', () => {
  const state = {
    persistent: {
      profiles: {
        profile1: {
          modState: {
            [GAME_ID]: {
              first: { enabled: true },
            },
          },
        },
      },
      profileModState: {
        profile1: {
          [GAME_ID]: {
            first: { enabled: false },
            second: { enabled: false },
          },
        },
      },
    },
  };

  assert.deepEqual(collectProfileModState(state, 'profile1'), {
    first: { enabled: true },
    second: { enabled: false },
  });
});

test('ue4ssManifestFilterForState prefers actual folder paths over display-name guesses', () => {
  const state = {
    persistent: {
      profiles: {
        profile1: {
          gameId: GAME_ID,
          modState: {
            [GAME_ID]: {
              enabledMod: { enabled: true },
              disabledMod: { enabled: false },
            },
          },
        },
      },
      mods: {
        [GAME_ID]: {
          enabledMod: {
            type: MOD_TYPES.UE4SS_MODS,
            installationPath: 'archive-name-that-does-not-match',
            attributes: {
              name: 'Fancy Recoil Collection Entry',
            },
            files: [
              path.join('NoRecoil', 'enabled.txt'),
            ],
          },
          disabledMod: {
            type: MOD_TYPES.GAME_ROOT,
            installationPath: 'another-mismatch',
            attributes: {
              name: 'Workbench Helper Package',
            },
            deployment: {
              destination: path.join(
                UE4SS_MODS_PATH,
                'TFWWorkbench',
                'Scripts',
                'main.lua',
              ),
            },
          },
        },
      },
    },
  };

  const filter = ue4ssManifestFilterForState(state, 'profile1');

  assert.equal(filter.allowedFolderNames.has(normalizeModName('NoRecoil')), true);
  assert.equal(filter.disabledFolderNames.has(normalizeModName('TFWWorkbench')), true);
  assert.equal(filter.allowedFolderNames.has(normalizeModName('TFWWorkbench')), false);
});

test('ue4ssManifestFilterForState recognizes NoRecoil from long archive names', () => {
  const state = {
    persistent: {
      profiles: {
        profile1: {
          modState: {
            [GAME_ID]: {
              longArchiveMod: { enabled: true },
            },
          },
        },
      },
      mods: {
        [GAME_ID]: {
          longArchiveMod: {
            type: MOD_TYPES.UE4SS_MODS,
            installationPath: 'ForeverWinter-Mod-NoRecoil-0.1.1.zip-47-0-1-1-1761663710',
            attributes: {
              logicalFileName: 'ForeverWinter-Mod-NoRecoil-0.1.1.zip-47-0-1-1-1761663710.zip',
            },
          },
        },
      },
    },
  };

  const filter = ue4ssManifestFilterForState(state, 'profile1');

  assert.equal(filter.allowedFolderNames.has(normalizeModName('NoRecoil')), true);
});
