const path = require('path');

const { GAME_ID, MOD_TYPES } = require('./constants');

const PAK_EXTENSIONS = new Set(['.pak', '.ucas', '.utoc']);

const ROOT_PAK_BASENAME_PATTERNS = [
  /^increased hunter killers spawn threshold_p\.(pak|ucas|utoc)$/i,
  /^increased hunter killers spawn threshold.*\.(pak|ucas|utoc)$/i,
];

const MODS_PAK_BASENAME_PATTERNS = [
  /^removestun_p\.(pak|ucas|utoc)$/i,
];

function normalizeArchivePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '');
}

function toDestination(filePath) {
  const normalized = normalizeArchivePath(filePath);
  const segments = normalized.split('/').filter(Boolean);
  return path.join(...segments);
}

function isDirectoryEntry(filePath) {
  return /[\\/]$/.test(String(filePath || ''));
}

function fileEntries(files) {
  return files
    .map(normalizeArchivePath)
    .filter((file) => file.length > 0 && !isDirectoryEntry(file));
}

function basename(filePath) {
  return path.posix.basename(normalizeArchivePath(filePath));
}

function dirname(filePath) {
  const dir = path.posix.dirname(normalizeArchivePath(filePath));
  return dir === '.' ? '' : dir;
}

function extension(filePath) {
  return path.posix.extname(normalizeArchivePath(filePath)).toLowerCase();
}

function pathSegments(filePath) {
  return normalizeArchivePath(filePath).split('/').filter(Boolean);
}

function indexOfSegmentPair(segments, first, second) {
  const lower = segments.map((segment) => segment.toLowerCase());
  for (let idx = 0; idx < lower.length - 1; idx += 1) {
    if (lower[idx] === first && lower[idx + 1] === second) {
      return idx;
    }
  }
  return -1;
}

function indexOfSegment(segments, segment) {
  return segments.findIndex((item) => item.toLowerCase() === segment);
}

function hasGameRootPath(files) {
  return fileEntries(files).some((file) => {
    const segments = pathSegments(file);
    return indexOfSegmentPair(segments, 'windows', 'foreverwinter') !== -1;
  });
}

function extractFromGameRoot(filePath) {
  const segments = pathSegments(filePath);
  const idx = indexOfSegmentPair(segments, 'windows', 'foreverwinter');
  if (idx === -1) {
    return undefined;
  }
  return segments.slice(idx).join('/');
}

function hasPakFile(files) {
  return fileEntries(files).some((file) => PAK_EXTENSIONS.has(extension(file)));
}

function pakFiles(files) {
  return fileEntries(files).filter((file) => PAK_EXTENSIONS.has(extension(file)));
}

function hasPakTriplet(files) {
  const groups = new Map();
  for (const file of pakFiles(files)) {
    const ext = extension(file);
    const stem = normalizeArchivePath(file).slice(0, -ext.length).toLowerCase();
    if (!groups.has(stem)) {
      groups.set(stem, new Set());
    }
    groups.get(stem).add(ext);
  }
  return Array.from(groups.values()).some((exts) =>
    ['.pak', '.ucas', '.utoc'].every((ext) => exts.has(ext)));
}

function matchesAnyPattern(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function pakModType(files) {
  const bases = pakFiles(files).map((file) => basename(file).toLowerCase());
  if (bases.some((base) => matchesAnyPattern(base, ROOT_PAK_BASENAME_PATTERNS))) {
    return MOD_TYPES.PAKS_ROOT;
  }
  if (bases.some((base) => matchesAnyPattern(base, MODS_PAK_BASENAME_PATTERNS))) {
    return MOD_TYPES.PAKS_MODS;
  }
  return MOD_TYPES.PAKS_MODS;
}

function isSignatureBypassArchive(files) {
  const entries = fileEntries(files);
  const bases = entries.map((file) => basename(file).toLowerCase());
  const segments = entries.flatMap(pathSegments).map((segment) => segment.toLowerCase());
  const hasDsound = bases.includes('dsound.dll');
  const hasBitfix = segments.includes('bitfix') || bases.some((base) => base.startsWith('bitfix'));
  return hasDsound && hasBitfix;
}

function hasDwmapi(files) {
  return fileEntries(files).some((file) => basename(file).toLowerCase() === 'dwmapi.dll');
}

function hasUE4SSSegment(files) {
  return fileEntries(files).some((file) => pathSegments(file).some((segment) => segment.toLowerCase() === 'ue4ss'));
}

function hasUE4SSModMarkers(files) {
  return fileEntries(files).some((file) => {
    const normalized = normalizeArchivePath(file).toLowerCase();
    return normalized.endsWith('/enabled.txt')
      || normalized.endsWith('/scripts/main.lua')
      || normalized.includes('/ue4ss/mods/');
  });
}

function hasUE4SS(files) {
  return hasDwmapi(files) || hasUE4SSSegment(files) || hasUE4SSModMarkers(files);
}

function commonPathPrefix(files) {
  if (files.length === 0) {
    return [];
  }
  const split = files.map(pathSegments);
  const prefix = [];
  for (let idx = 0; idx < split[0].length; idx += 1) {
    const candidate = split[0][idx].toLowerCase();
    if (split.every((segments) => segments[idx] !== undefined && segments[idx].toLowerCase() === candidate)) {
      prefix.push(split[0][idx]);
    } else {
      break;
    }
  }
  return prefix;
}

function stripPrefix(filePath, prefixSegments) {
  const segments = pathSegments(filePath);
  return segments.slice(prefixSegments.length).join('/');
}

function copyInstruction(source, destination) {
  return {
    type: 'copy',
    source,
    destination: toDestination(destination),
  };
}

function setModTypeInstruction(modType) {
  return {
    type: 'setmodtype',
    value: modType,
  };
}

function installGameRoot(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.GAME_ROOT)];
  for (const file of fileEntries(files)) {
    const destination = extractFromGameRoot(file);
    if (destination !== undefined) {
      instructions.push(copyInstruction(file, destination));
    }
  }
  return {
    kind: 'game-root',
    instructions,
    modType: MOD_TYPES.GAME_ROOT,
    warnings: [],
  };
}

function installPak(files) {
  const paks = pakFiles(files);
  const modType = pakModType(paks);
  const pakDirs = Array.from(new Set(paks.map(dirname)));
  const targetDir = pakDirs[0] || '';
  const copyFiles = fileEntries(files)
    .filter((file) => PAK_EXTENSIONS.has(extension(file)))
    .filter((file) => dirname(file) === targetDir);
  const instructions = [setModTypeInstruction(modType)];

  for (const file of copyFiles) {
    instructions.push(copyInstruction(file, basename(file)));
  }

  return {
    kind: 'pak',
    instructions,
    modType,
    warnings: [],
  };
}

function extractUE4SSModsDestination(file) {
  const segments = pathSegments(file);
  const ue4ssIdx = indexOfSegment(segments, 'ue4ss');
  if (ue4ssIdx !== -1 && segments[ue4ssIdx + 1]?.toLowerCase() === 'mods') {
    return segments.slice(ue4ssIdx + 2).join('/');
  }
  return undefined;
}

function inferBareUE4SSModRoot(files) {
  const markers = fileEntries(files).filter((file) => {
    const normalized = normalizeArchivePath(file).toLowerCase();
    return normalized.endsWith('/enabled.txt') || normalized.endsWith('/scripts/main.lua');
  });
  if (markers.length === 0) {
    return [];
  }
  const prefix = commonPathPrefix(markers);
  if (prefix.length > 0 && prefix[prefix.length - 1].toLowerCase() === 'scripts') {
    prefix.pop();
  }
  return prefix;
}

function installUE4SSModOnly(files) {
  const entries = fileEntries(files);
  const hasExplicitUE4SSMods = entries.some((file) => extractUE4SSModsDestination(file) !== undefined);
  const bareRoot = hasExplicitUE4SSMods ? [] : inferBareUE4SSModRoot(entries);
  const instructions = [setModTypeInstruction(MOD_TYPES.UE4SS_MODS)];

  for (const file of entries) {
    let destination = extractUE4SSModsDestination(file);
    if (destination === undefined && bareRoot.length > 0) {
      destination = stripPrefix(file, bareRoot.slice(0, -1));
    }
    if (destination !== undefined && destination.length > 0) {
      instructions.push(copyInstruction(file, destination));
    }
  }

  return {
    kind: 'ue4ss-mod',
    instructions,
    modType: MOD_TYPES.UE4SS_MODS,
    warnings: ['ue4ss-loader-missing'],
  };
}

function installUE4SSWin64(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.WIN64_ROOT)];

  for (const file of fileEntries(files)) {
    const segments = pathSegments(file);
    const ue4ssIdx = indexOfSegment(segments, 'ue4ss');
    const base = basename(file).toLowerCase();
    if (ue4ssIdx !== -1) {
      instructions.push(copyInstruction(file, segments.slice(ue4ssIdx).join('/')));
    } else if (base === 'dwmapi.dll') {
      instructions.push(copyInstruction(file, 'dwmapi.dll'));
    }
  }

  return {
    kind: 'ue4ss-win64',
    instructions,
    modType: MOD_TYPES.WIN64_ROOT,
    warnings: [],
  };
}

function buildInstallInstructions(files) {
  if (isSignatureBypassArchive(files)) {
    return {
      kind: 'signature-bypass',
      instructions: [],
      modType: undefined,
      warnings: ['signature-bypass-manual-install'],
    };
  }

  if (hasGameRootPath(files)) {
    return installGameRoot(files);
  }

  if (hasUE4SS(files)) {
    return hasDwmapi(files) ? installUE4SSWin64(files) : installUE4SSModOnly(files);
  }

  if (hasPakFile(files)) {
    return installPak(files);
  }

  return {
    kind: 'unsupported',
    instructions: [],
    modType: undefined,
    warnings: [],
  };
}

function testSupportedSignatureBypass(files, gameId) {
  return Promise.resolve({
    supported: gameId === GAME_ID && isSignatureBypassArchive(files),
    requiredFiles: [],
  });
}

function testSupportedContent(files, gameId) {
  const result = buildInstallInstructions(files);
  return Promise.resolve({
    supported: gameId === GAME_ID
      && result.kind !== 'unsupported'
      && result.kind !== 'signature-bypass',
    requiredFiles: [],
  });
}

function modTypeTest(instructions, modType) {
  return instructions.some((instruction) =>
    instruction.type === 'setmodtype' && instruction.value === modType);
}

module.exports = {
  buildInstallInstructions,
  hasGameRootPath,
  hasPakTriplet,
  isSignatureBypassArchive,
  modTypeTest,
  normalizeArchivePath,
  testSupportedContent,
  testSupportedSignatureBypass,
};
