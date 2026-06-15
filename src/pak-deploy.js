const path = require('path');

const { PAKS_MODS_PATH, PAKS_ROOT_PATH } = require('./constants');

const PAK_CONTAINER_EXTENSIONS = new Set(['.pak', '.ucas', '.utoc']);

function isPakContainerFile(fileName) {
  return PAK_CONTAINER_EXTENSIONS.has(path.extname(String(fileName || '')).toLowerCase());
}

function uniquePaths(paths) {
  return Array.from(new Set(paths));
}

async function directoryEntries(nodeFs, dirPath) {
  try {
    return await nodeFs.promises.readdir(dirPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function materializeSymlinkFile(nodeFs, filePath) {
  const stat = await nodeFs.promises.lstat(filePath).catch(() => undefined);
  if (stat === undefined || !stat.isSymbolicLink()) {
    return false;
  }

  const rawTarget = await nodeFs.promises.readlink(filePath);
  const target = path.isAbsolute(rawTarget)
    ? rawTarget
    : path.resolve(path.dirname(filePath), rawTarget);
  const tempPath = `${filePath}.tfw-materialize-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await nodeFs.promises.copyFile(target, tempPath);
    await nodeFs.promises.unlink(filePath);
    await nodeFs.promises.rename(tempPath, filePath);
    return true;
  } catch (err) {
    await nodeFs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    throw err;
  }
}

async function materializePakSymlinks(gamePath, nodeFs = require('fs')) {
  const result = {
    checked: 0,
    materialized: 0,
    errors: [],
  };

  if (gamePath === undefined) {
    return result;
  }

  const pakDirs = uniquePaths([
    path.join(gamePath, PAKS_ROOT_PATH),
    path.join(gamePath, PAKS_MODS_PATH),
  ]);

  for (const dirPath of pakDirs) {
    const entries = await directoryEntries(nodeFs, dirPath);
    for (const entry of entries) {
      if (!isPakContainerFile(entry)) {
        continue;
      }

      const filePath = path.join(dirPath, entry);
      result.checked += 1;

      try {
        if (await materializeSymlinkFile(nodeFs, filePath)) {
          result.materialized += 1;
        }
      } catch (err) {
        result.errors.push({
          filePath,
          message: err.message,
        });
      }
    }
  }

  return result;
}

module.exports = {
  isPakContainerFile,
  materializePakSymlinks,
};
