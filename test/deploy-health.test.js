const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { UE4SS_MODS_PATH, WIN64_PATH } = require('../src/constants');
const {
  findMisroutedUE4SSPakFiles,
  ue4ssLoaderStatus,
} = require('../src/deploy-health');

function normalize(filePath) {
  return path.normalize(filePath).toLowerCase();
}

function mockNodeFs({ files = [], dirs = {} } = {}) {
  const fileSet = new Set(files.map(normalize));
  const dirMap = new Map(Object.entries(dirs).map(([dirPath, entries]) => [
    normalize(dirPath),
    entries,
  ]));

  return {
    promises: {
      lstat(filePath) {
        return fileSet.has(normalize(filePath))
          ? Promise.resolve({})
          : Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
      },
      readdir(dirPath) {
        const entries = dirMap.get(normalize(dirPath));
        return entries === undefined
          ? Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }))
          : Promise.resolve(entries);
      },
    },
  };
}

test('ue4ssLoaderStatus reports missing loader files', async () => {
  const gamePath = path.join('C:', 'Game');
  const nodeFs = mockNodeFs({
    files: [
      path.join(gamePath, WIN64_PATH, 'dwmapi.dll'),
    ],
  });

  assert.deepEqual(await ue4ssLoaderStatus(gamePath, nodeFs), {
    present: ['dwmapi.dll'],
    missing: [
      path.join('ue4ss', 'UE4SS.dll'),
      path.join('ue4ss', 'UE4SS-settings.ini'),
    ],
  });
});

test('findMisroutedUE4SSPakFiles reports PAK containers under UE4SS Mods', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const nodeFs = mockNodeFs({
    dirs: {
      [modsDir]: [
        'NoRecoil',
        '132-HeadshotMultiplierEquality_P.pak',
        '132-HeadshotMultiplierEquality_P.ucas',
        '132-HeadshotMultiplierEquality_P.utoc',
        'mods.txt',
      ],
    },
  });

  assert.deepEqual(await findMisroutedUE4SSPakFiles(gamePath, nodeFs), [
    path.join(modsDir, '132-HeadshotMultiplierEquality_P.pak'),
    path.join(modsDir, '132-HeadshotMultiplierEquality_P.ucas'),
    path.join(modsDir, '132-HeadshotMultiplierEquality_P.utoc'),
  ]);
});
