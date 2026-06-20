const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { UE4SS_MODS_PATH } = require('../src/constants');
const {
  listUE4SSModFolders,
  readExistingManifestEntries,
  regenerateUE4SSManifests,
} = require('../src/ue4ss-deploy');
const {
  ue4ssManifestFilterForState,
} = require('../src/ue4ss-profile');

function normalize(filePath) {
  return path.normalize(filePath).toLowerCase();
}

function mockStats(directory) {
  return {
    isDirectory: () => directory,
  };
}

function mockFs({ directories = [], files = {} } = {}) {
  const directoryMap = new Map(directories.map((dirPath) => [
    normalize(dirPath),
    path.normalize(dirPath),
  ]));
  const fileMap = new Map(Object.entries(files).map(([filePath, contents]) => [
    normalize(filePath),
    { original: path.normalize(filePath), contents },
  ]));
  const writes = new Map();

  return {
    writes,
    ensureDirWritableAsync(dirPath) {
      directoryMap.set(normalize(dirPath), path.normalize(dirPath));
      return Promise.resolve();
    },
    readFileAsync(filePath) {
      const normalized = normalize(filePath);
      if (fileMap.has(normalized)) {
        return Promise.resolve(fileMap.get(normalized).contents);
      }
      if (writes.has(normalized)) {
        return Promise.resolve(writes.get(normalized).contents);
      }
      return Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    },
    readdirAsync(dirPath) {
      const normalizedDir = normalize(dirPath);
      if (!directoryMap.has(normalizedDir)) {
        return Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
      }

      const children = new Set();
      const allPaths = [
        ...directoryMap.values(),
        ...Array.from(fileMap.values()).map((item) => item.original),
        ...Array.from(writes.values()).map((item) => item.original),
      ];
      for (const item of allPaths) {
        const parent = normalize(path.dirname(item));
        if (parent === normalizedDir) {
          children.add(path.basename(item));
        }
      }
      return Promise.resolve(Array.from(children));
    },
    statAsync(filePath) {
      const normalized = normalize(filePath);
      if (directoryMap.has(normalized)) {
        return Promise.resolve(mockStats(true));
      }
      if (fileMap.has(normalized) || writes.has(normalized)) {
        return Promise.resolve(mockStats(false));
      }
      return Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    },
    writeFileAsync(filePath, contents) {
      writes.set(normalize(filePath), {
        original: path.normalize(filePath),
        contents,
      });
      fileMap.set(normalize(filePath), {
        original: path.normalize(filePath),
        contents,
      });
      return Promise.resolve();
    },
  };
}

test('listUE4SSModFolders returns child directories and skips manifest files', async () => {
  const modsDir = path.join('C:', 'Game', UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'TFWWorkbench'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'NoRecoil : 1',
      [path.join(modsDir, 'readme.txt')]: 'hello',
    },
  });

  assert.deepEqual(await listUE4SSModFolders(fsModule, modsDir), [
    'NoRecoil',
    'TFWWorkbench',
  ]);
});

test('readExistingManifestEntries parses mods txt and tolerant json manifests', async () => {
  const modsDir = path.join('C:', 'Game', UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [modsDir],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'LineTraceMod : 0',
      [path.join(modsDir, 'mods.json')]: '[{"mod_name":"NoRecoil","mod_enabled":true}{"mod_name":"Keybinds","mod_enabled":true}]',
    },
  });

  assert.deepEqual(await readExistingManifestEntries(fsModule, modsDir), [
    { mod_name: 'LineTraceMod', mod_enabled: false },
    { mod_name: 'NoRecoil', mod_enabled: true },
    { mod_name: 'Keybinds', mod_enabled: true },
  ]);
});

test('regenerateUE4SSManifests writes merged mods txt and json from deployed folders', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'BPModLoaderMod'),
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'CheaperInnardsUpgrades'),
      path.join(modsDir, 'shared'),
      path.join(modsDir, 'SplitScreenMod'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'LineTraceMod : 1\r\nSplitScreenMod : 0\r\nRemovedMod : 1\r\nKeybinds : 1\r\n',
    },
  });

  const result = await regenerateUE4SSManifests(fsModule, gamePath);
  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));
  const modsJson = await fsModule.readFileAsync(path.join(modsDir, 'mods.json'));

  assert.equal(result.skipped, false);
  assert.equal(modsTxt.includes('CheaperInnardsUpgrades : 1'), true);
  assert.equal(modsTxt.includes('NoRecoil : 1'), true);
  assert.equal(modsTxt.includes('LineTraceMod : 1'), true);
  assert.equal(modsTxt.includes('SplitScreenMod : 0'), true);
  assert.equal(modsTxt.includes('shared : 1'), false);
  assert.equal(modsTxt.includes('RemovedMod'), false);
  assert.deepEqual(JSON.parse(modsJson).filter((entry) => [
    'CheaperInnardsUpgrades',
    'NoRecoil',
  ].includes(entry.mod_name)), [
    { mod_name: 'CheaperInnardsUpgrades', mod_enabled: true },
    { mod_name: 'NoRecoil', mod_enabled: true },
  ]);
});

test('regenerateUE4SSManifests omits folders disabled by active profile state', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'TFWWorkbench'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'NoRecoil : 1\r\nTFWWorkbench : 1\r\nKeybinds : 1\r\n',
      [path.join(modsDir, 'mods.json')]: JSON.stringify([
        { mod_name: 'NoRecoil', mod_enabled: true },
        { mod_name: 'TFWWorkbench', mod_enabled: true },
        { mod_name: 'Keybinds', mod_enabled: true },
      ]),
    },
  });

  await regenerateUE4SSManifests(fsModule, gamePath, {
    disabledFolderNames: ['NoRecoil'],
  });

  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));
  const modsJson = await fsModule.readFileAsync(path.join(modsDir, 'mods.json'));

  assert.equal(modsTxt.includes('NoRecoil'), false);
  assert.equal(modsTxt.includes('TFWWorkbench : 1'), true);
  assert.equal(JSON.parse(modsJson).some((entry) => entry.mod_name === 'NoRecoil'), false);
  assert.equal(JSON.parse(modsJson).some((entry) =>
    entry.mod_name === 'TFWWorkbench' && entry.mod_enabled === true), true);
});

test('regenerateUE4SSManifests uses exact profile folder metadata when names differ', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'TFWWorkbench'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'NoRecoil : 1\r\nTFWWorkbench : 1\r\nKeybinds : 1\r\n',
    },
  });
  const state = {
    persistent: {
      profiles: {
        profile1: {
          modState: {
            theforeverwinter: {
              enabledMod: { enabled: true },
              disabledMod: { enabled: false },
            },
          },
        },
      },
      mods: {
        theforeverwinter: {
          enabledMod: {
            type: 'tfw-ue4ss-mods',
            attributes: { name: 'Display Name That Does Not Match' },
            files: [
              path.join('NoRecoil', 'enabled.txt'),
            ],
          },
          disabledMod: {
            type: 'tfw-game-root',
            attributes: { name: 'Another Display Mismatch' },
            files: [
              path.join(
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
            ],
          },
        },
      },
    },
  };

  await regenerateUE4SSManifests(
    fsModule,
    gamePath,
    ue4ssManifestFilterForState(state, 'profile1'),
  );

  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));
  const modsJson = await fsModule.readFileAsync(path.join(modsDir, 'mods.json'));
  const parsedJson = JSON.parse(modsJson);

  assert.equal(modsTxt.includes('NoRecoil : 1'), true);
  assert.equal(modsTxt.includes('TFWWorkbench'), false);
  assert.equal(parsedJson.some((entry) => entry.mod_name === 'NoRecoil'), true);
  assert.equal(parsedJson.some((entry) => entry.mod_name === 'TFWWorkbench'), false);
});

test('regenerateUE4SSManifests materializes symlinked manifests before writing', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'NoRecoil'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'Keybinds : 1\r\n',
      [path.join(modsDir, 'mods.json')]: JSON.stringify([
        { mod_name: 'Keybinds', mod_enabled: true },
      ]),
    },
  });
  const ops = [];
  const nodeFs = {
    promises: {
      lstat(filePath) {
        ops.push(['lstat', path.basename(filePath)]);
        return Promise.resolve({ isSymbolicLink: () => true });
      },
      readlink(filePath) {
        ops.push(['readlink', path.basename(filePath)]);
        return Promise.resolve(`${filePath}.source`);
      },
      copyFile(source, destination) {
        ops.push(['copyFile', path.basename(source), path.basename(destination).startsWith(path.basename(source))]);
        return Promise.resolve();
      },
      unlink(filePath) {
        ops.push(['unlink', path.basename(filePath)]);
        return Promise.resolve();
      },
      rename(source, destination) {
        ops.push(['rename', path.basename(destination)]);
        return Promise.resolve();
      },
      rm() {
        return Promise.resolve();
      },
    },
  };

  const result = await regenerateUE4SSManifests(fsModule, gamePath, { nodeFs });
  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));

  assert.equal(result.manifestMaterialization.materialized, 2);
  assert.deepEqual(ops.filter((op) => op[0] === 'unlink').map((op) => op[1]), [
    'mods.txt',
    'mods.json',
  ]);
  assert.equal(modsTxt.includes('NoRecoil : 1'), true);
});

test('regenerateUE4SSManifests omits all custom folders when active profile has no enabled UE4SS mods', async () => {
  const gamePath = path.join('C:', 'Game');
  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const fsModule = mockFs({
    directories: [
      modsDir,
      path.join(modsDir, 'FWMM_Discovery'),
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'TFWWorkbench'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: [
        'FWMM_Discovery : 1',
        'NoRecoil : 1',
        'TFWWorkbench : 1',
        'Keybinds : 1',
        '',
      ].join('\r\n'),
      [path.join(modsDir, 'mods.json')]: JSON.stringify([
        { mod_name: 'FWMM_Discovery', mod_enabled: true },
        { mod_name: 'NoRecoil', mod_enabled: true },
        { mod_name: 'TFWWorkbench', mod_enabled: true },
        { mod_name: 'Keybinds', mod_enabled: true },
      ]),
    },
  });

  await regenerateUE4SSManifests(fsModule, gamePath, {
    allowedFolderNames: [],
    disabledFolderNames: ['FWMM_Discovery', 'NoRecoil', 'TFWWorkbench'],
  });

  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));
  const modsJson = await fsModule.readFileAsync(path.join(modsDir, 'mods.json'));
  const parsedJson = JSON.parse(modsJson);

  assert.equal(modsTxt.includes('FWMM_Discovery'), false);
  assert.equal(modsTxt.includes('NoRecoil'), false);
  assert.equal(modsTxt.includes('TFWWorkbench'), false);
  assert.equal(parsedJson.some((entry) => entry.mod_name === 'FWMM_Discovery'), false);
  assert.equal(parsedJson.some((entry) => entry.mod_name === 'NoRecoil'), false);
  assert.equal(parsedJson.some((entry) => entry.mod_name === 'TFWWorkbench'), false);
});

test('regenerateUE4SSManifests skips missing UE4SS Mods folder', async () => {
  const fsModule = mockFs();
  assert.deepEqual(await regenerateUE4SSManifests(fsModule, path.join('C:', 'Game')), {
    skipped: true,
    reason: 'no-ue4ss-mods',
  });
});
