const path = require('path');

const { UE4SS_MODS_PATH } = require('./constants');
const {
  buildAggregateManifestEntries,
  parseManifest,
  renderModsJson,
  renderModsTxt,
} = require('./ue4ss-manifest');

const MANIFEST_FILE_NAMES = new Set(['mods.txt', 'mods.json']);

function isManifestFileName(fileName) {
  return MANIFEST_FILE_NAMES.has(String(fileName || '').toLowerCase());
}

function statExists(fsModule, filePath) {
  return fsModule.statAsync(filePath)
    .then((stat) => stat)
    .catch(() => undefined);
}

async function readTextIfExists(fsModule, filePath) {
  try {
    return await fsModule.readFileAsync(filePath, 'utf8');
  } catch (err) {
    return undefined;
  }
}

async function listUE4SSModFolders(fsModule, modsDir) {
  const stat = await statExists(fsModule, modsDir);
  if (stat === undefined || !stat.isDirectory()) {
    return [];
  }

  const entries = await fsModule.readdirAsync(modsDir);
  const folders = [];

  for (const entry of entries) {
    if (isManifestFileName(entry)) {
      continue;
    }

    const entryStat = await statExists(fsModule, path.join(modsDir, entry));
    if (entryStat !== undefined && entryStat.isDirectory()) {
      folders.push(entry);
    }
  }

  return folders.sort((left, right) => left.localeCompare(right));
}

async function readExistingManifestEntries(fsModule, modsDir) {
  const entries = [];
  for (const fileName of ['mods.txt', 'mods.json']) {
    const filePath = path.join(modsDir, fileName);
    const text = await readTextIfExists(fsModule, filePath);
    if (text !== undefined) {
      entries.push(...parseManifest(fileName, text));
    }
  }
  return entries;
}

async function ensureDirectory(fsModule, dirPath) {
  if (typeof fsModule.ensureDirWritableAsync === 'function') {
    await fsModule.ensureDirWritableAsync(dirPath);
  } else if (typeof fsModule.ensureDirAsync === 'function') {
    await fsModule.ensureDirAsync(dirPath);
  }
}

async function regenerateUE4SSManifests(fsModule, gamePath) {
  if (gamePath === undefined) {
    return { skipped: true, reason: 'missing-game-path' };
  }

  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const folders = await listUE4SSModFolders(fsModule, modsDir);
  const existingEntries = await readExistingManifestEntries(fsModule, modsDir);

  if (folders.length === 0 && existingEntries.length === 0) {
    return { skipped: true, reason: 'no-ue4ss-mods' };
  }

  await ensureDirectory(fsModule, modsDir);
  const entries = buildAggregateManifestEntries(existingEntries, folders);
  await fsModule.writeFileAsync(path.join(modsDir, 'mods.txt'), renderModsTxt(entries), 'utf8');
  await fsModule.writeFileAsync(path.join(modsDir, 'mods.json'), renderModsJson(entries), 'utf8');

  return {
    skipped: false,
    modsDir,
    folders,
    entries,
  };
}

module.exports = {
  isManifestFileName,
  listUE4SSModFolders,
  readExistingManifestEntries,
  regenerateUE4SSManifests,
};
