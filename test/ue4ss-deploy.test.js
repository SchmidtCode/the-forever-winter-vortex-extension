const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { UE4SS_MODS_PATH } = require('../src/constants');
const {
  listUE4SSModFolders,
  readExistingManifestEntries,
  regenerateUE4SSManifests,
} = require('../src/ue4ss-deploy');

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
      path.join(modsDir, 'NoRecoil'),
      path.join(modsDir, 'CheaperInnardsUpgrades'),
    ],
    files: {
      [path.join(modsDir, 'mods.txt')]: 'LineTraceMod : 0\r\nRemovedMod : 1\r\nKeybinds : 1\r\n',
    },
  });

  const result = await regenerateUE4SSManifests(fsModule, gamePath);
  const modsTxt = await fsModule.readFileAsync(path.join(modsDir, 'mods.txt'));
  const modsJson = await fsModule.readFileAsync(path.join(modsDir, 'mods.json'));

  assert.equal(result.skipped, false);
  assert.equal(modsTxt.includes('CheaperInnardsUpgrades : 1'), true);
  assert.equal(modsTxt.includes('NoRecoil : 1'), true);
  assert.equal(modsTxt.includes('LineTraceMod : 0'), true);
  assert.equal(modsTxt.includes('RemovedMod'), false);
  assert.deepEqual(JSON.parse(modsJson).filter((entry) => [
    'CheaperInnardsUpgrades',
    'NoRecoil',
  ].includes(entry.mod_name)), [
    { mod_name: 'CheaperInnardsUpgrades', mod_enabled: true },
    { mod_name: 'NoRecoil', mod_enabled: true },
  ]);
});

test('regenerateUE4SSManifests skips missing UE4SS Mods folder', async () => {
  const fsModule = mockFs();
  assert.deepEqual(await regenerateUE4SSManifests(fsModule, path.join('C:', 'Game')), {
    skipped: true,
    reason: 'no-ue4ss-mods',
  });
});
