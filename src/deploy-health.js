const path = require('path');

const { UE4SS_MODS_PATH, WIN64_PATH } = require('./constants');

const PAK_CONTAINER_EXTENSIONS = new Set(['.pak', '.ucas', '.utoc']);

async function pathExists(nodeFs, filePath) {
  try {
    await nodeFs.promises.lstat(filePath);
    return true;
  } catch (err) {
    return false;
  }
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

async function ue4ssLoaderStatus(gamePath, nodeFs = require('fs')) {
  const requiredFiles = [
    {
      label: 'dwmapi.dll',
      path: path.join(gamePath, WIN64_PATH, 'dwmapi.dll'),
    },
    {
      label: path.join('ue4ss', 'UE4SS.dll'),
      path: path.join(gamePath, WIN64_PATH, 'ue4ss', 'UE4SS.dll'),
    },
    {
      label: path.join('ue4ss', 'UE4SS-settings.ini'),
      path: path.join(gamePath, WIN64_PATH, 'ue4ss', 'UE4SS-settings.ini'),
    },
  ];
  const missing = [];
  const present = [];

  if (gamePath === undefined) {
    return { present, missing: requiredFiles.map((file) => file.label) };
  }

  for (const file of requiredFiles) {
    if (await pathExists(nodeFs, file.path)) {
      present.push(file.label);
    } else {
      missing.push(file.label);
    }
  }

  return { present, missing };
}

async function findMisroutedUE4SSPakFiles(gamePath, nodeFs = require('fs')) {
  if (gamePath === undefined) {
    return [];
  }

  const modsDir = path.join(gamePath, UE4SS_MODS_PATH);
  const entries = await directoryEntries(nodeFs, modsDir);
  return entries
    .filter((entry) => PAK_CONTAINER_EXTENSIONS.has(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(modsDir, entry));
}

module.exports = {
  findMisroutedUE4SSPakFiles,
  ue4ssLoaderStatus,
};
