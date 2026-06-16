const path = require('path');

const {
  GAME_ID,
  MOD_TYPES,
  PAKS_MODS_PATH,
  PAKS_ROOT_PATH,
  TFW_WORKBENCH_DATA_PATH,
  UE4SS_MODS_PATH,
  WIN64_PATH,
} = require('./constants');

const PAK_EXTENSIONS = new Set(['.pak', '.ucas', '.utoc']);

const UE4SS_RUNTIME_MOD_FOLDERS = new Set([
  'actordumpermod',
  'bpml_genericfunctions',
  'bpmodloadermod',
  'cheatmanagerenablermod',
  'consolecommandsmod',
  'consoleenablermod',
  'jsbluaprofilermod',
  'keybinds',
  'linetracemod',
  'shared',
  'splitscreenmod',
]);

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

function pakTargetPath(modType) {
  return modType === MOD_TYPES.PAKS_ROOT ? PAKS_ROOT_PATH : PAKS_MODS_PATH;
}

function pakCopyFiles(files) {
  const paks = pakFiles(files);
  const pakDirs = Array.from(new Set(paks.map(dirname)));
  const targetDir = pakDirs[0] || '';
  return fileEntries(files)
    .filter((file) => PAK_EXTENSIONS.has(extension(file)))
    .filter((file) => dirname(file) === targetDir);
}

function isSignatureBypassArchive(files) {
  const entries = fileEntries(files);
  const bases = entries.map((file) => basename(file).toLowerCase());
  const segments = entries.flatMap(pathSegments).map((segment) => segment.toLowerCase());
  const hasProxy = bases.includes('dsound.dll') || bases.includes('version.dll');
  const hasBitfix = segments.includes('bitfix') || bases.some((base) => base.startsWith('bitfix'));
  return hasProxy && hasBitfix;
}

function hasDwmapi(files) {
  return fileEntries(files).some((file) => basename(file).toLowerCase() === 'dwmapi.dll');
}

function hasUE4SSLoaderFile(files) {
  return fileEntries(files).some((file) => {
    const base = basename(file).toLowerCase();
    return base === 'ue4ss.dll' || base === 'ue4ss-settings.ini';
  });
}

function hasUE4SSLoader(files) {
  return hasDwmapi(files) || hasUE4SSLoaderFile(files);
}

function hasUE4SSSegment(files) {
  return fileEntries(files).some((file) => pathSegments(file).some((segment) => segment.toLowerCase() === 'ue4ss'));
}

function hasUE4SSModMarkers(files) {
  return fileEntries(files).some((file) => {
    const normalized = normalizeArchivePath(file).toLowerCase();
    return normalized.endsWith('/enabled.txt')
      || normalized.endsWith('/scripts/main.lua')
      || normalized.includes('/ue4ss/mods/')
      || normalized.includes('/mods/')
      || normalized.startsWith('mods/');
  });
}

function hasUE4SS(files) {
  return hasDwmapi(files) || hasUE4SSLoaderFile(files) || hasUE4SSSegment(files) || hasUE4SSModMarkers(files);
}

function isTFWWorkbenchArchive(files) {
  return fileEntries(files).some((file) => {
    const segments = pathSegments(file).map((segment) => segment.toLowerCase());
    const workbenchIdx = indexOfSegment(segments, 'tfwworkbench');
    return workbenchIdx !== -1
      && segments[workbenchIdx + 1] === 'scripts'
      && segments[workbenchIdx + 2] === 'main.lua';
  });
}

function tfwWorkbenchDestination(file) {
  const segments = pathSegments(file);
  const workbenchIdx = indexOfSegment(segments, 'tfwworkbench');
  if (workbenchIdx === -1) {
    return undefined;
  }
  return path.join(UE4SS_MODS_PATH, segments.slice(workbenchIdx).join('/'));
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

function isModsDestination(destination) {
  const normalized = normalizeArchivePath(destination).toLowerCase();
  return normalized === 'mods' || normalized.startsWith('mods/');
}

function isGlobalUE4SSManifest(destination) {
  const normalized = normalizeArchivePath(destination).toLowerCase();
  return normalized === 'mods.txt' || normalized === 'mods.json';
}

function isUE4SSRuntimeModDestination(destination) {
  const segments = pathSegments(destination).map((segment) => segment.toLowerCase());
  return segments.length > 0 && UE4SS_RUNTIME_MOD_FOLDERS.has(segments[0]);
}

function isDeployableUE4SSModDestination(destination) {
  return destination !== undefined
    && destination.length > 0
    && !isGlobalUE4SSManifest(destination)
    && !isUE4SSRuntimeModDestination(destination);
}

function deployableUE4SSModDestinations(files) {
  return ue4ssModOnlyDestinations(files)
    .filter(({ destination }) => isDeployableUE4SSModDestination(destination));
}

function hasDeployableUE4SSMod(files) {
  return deployableUE4SSModDestinations(files).length > 0;
}

function isBundledDependencyGameRootDestination(destination) {
  const normalized = normalizeArchivePath(destination).toLowerCase();
  const win64 = normalizeArchivePath(WIN64_PATH).toLowerCase();
  if (!normalized.startsWith(`${win64}/`)) {
    return false;
  }

  const relativeWin64 = normalized.slice(win64.length + 1);
  const segments = pathSegments(relativeWin64).map((segment) => segment.toLowerCase());
  const base = path.posix.basename(relativeWin64);

  if (['dsound.dll', 'version.dll', 'dwmapi.dll'].includes(base)) {
    return true;
  }

  if (segments.includes('bitfix') || base.startsWith('bitfix')) {
    return true;
  }

  if (segments[0] !== 'ue4ss') {
    return false;
  }

  if (['ue4ss.dll', 'ue4ss-settings.ini', 'license'].includes(base)) {
    return true;
  }

  if (segments[1] === 'ue4ss_signatures') {
    return true;
  }

  if (segments[1] === 'mods') {
    const modsDestination = segments.slice(2).join('/');
    return !isDeployableUE4SSModDestination(modsDestination);
  }

  return false;
}

function isMisplacedUE4SSPakDestination(destination) {
  const normalized = normalizeArchivePath(destination).toLowerCase();
  const win64 = normalizeArchivePath(WIN64_PATH).toLowerCase();
  return PAK_EXTENSIONS.has(extension(destination))
    && (
      normalized.startsWith(`${win64}/ue4ss/mods/`)
      || normalized.startsWith(`${win64}/mods/`)
    );
}

function normalizeGameRootDestination(file, destination) {
  if (isMisplacedUE4SSPakDestination(destination)) {
    return path.join(pakTargetPath(pakModType([file])), basename(destination));
  }

  return destination;
}

function installGameRoot(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.GAME_ROOT)];
  const skipBundledDependencies = hasDeployableUE4SSMod(files) || (hasUE4SS(files) && hasPakFile(files));

  for (const file of fileEntries(files)) {
    const destination = extractFromGameRoot(file);
    if (destination !== undefined) {
      if (skipBundledDependencies && isBundledDependencyGameRootDestination(destination)) {
        continue;
      }
      instructions.push(copyInstruction(file, normalizeGameRootDestination(file, destination)));
    }
  }
  return {
    kind: 'game-root',
    instructions,
    modType: MOD_TYPES.GAME_ROOT,
    warnings: [],
  };
}

function signatureBypassDestination(file, installVersionProxy) {
  const segments = pathSegments(file);
  const bitfixIdx = indexOfSegment(segments, 'bitfix');
  const base = basename(file).toLowerCase();

  if (base === 'dsound.dll') {
    return 'dsound.dll';
  }

  if (base === 'version.dll' && installVersionProxy) {
    return 'version.dll';
  }

  if (bitfixIdx !== -1) {
    return segments.slice(bitfixIdx).join('/');
  }

  if (base.startsWith('bitfix')) {
    return basename(file);
  }

  return undefined;
}

function signatureBypassDestinations(files) {
  const entries = fileEntries(files);
  const hasDsound = entries.some((file) => basename(file).toLowerCase() === 'dsound.dll');
  const installVersionProxy = !hasDsound;
  const destinations = [];

  for (const file of entries) {
    const destination = signatureBypassDestination(file, installVersionProxy);
    if (destination !== undefined) {
      destinations.push({ file, destination });
    }
  }

  return destinations;
}

function installSignatureBypass(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.WIN64_ROOT)];

  for (const { file, destination } of signatureBypassDestinations(files)) {
    instructions.push(copyInstruction(file, destination));
  }

  return {
    kind: 'signature-bypass',
    instructions,
    modType: MOD_TYPES.WIN64_ROOT,
    warnings: [],
  };
}

function installPak(files) {
  const modType = pakModType(files);
  const copyFiles = pakCopyFiles(files);
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
  const modsIdx = indexOfSegment(segments, 'mods');
  if (ue4ssIdx !== -1 && segments[ue4ssIdx + 1]?.toLowerCase() === 'mods') {
    return segments.slice(ue4ssIdx + 2).join('/');
  }
  if (modsIdx !== -1) {
    return segments.slice(modsIdx + 1).join('/');
  }
  return undefined;
}

function ue4ssModOnlyDestinations(files) {
  const entries = fileEntries(files);
  const hasExplicitUE4SSMods = entries.some((file) => extractUE4SSModsDestination(file) !== undefined);
  const bareRoot = hasExplicitUE4SSMods ? [] : inferBareUE4SSModRoot(entries);
  const destinations = [];

  for (const file of entries) {
    let destination = extractUE4SSModsDestination(file);
    if (destination === undefined && bareRoot.length > 0) {
      destination = stripPrefix(file, bareRoot.slice(0, -1));
    }
    if (destination !== undefined && destination.length > 0) {
      destinations.push({ file, destination });
    }
  }

  return destinations;
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
  const instructions = [setModTypeInstruction(MOD_TYPES.UE4SS_MODS)];

  for (const { file, destination } of deployableUE4SSModDestinations(files)) {
    instructions.push(copyInstruction(file, destination));
  }

  return {
    kind: 'ue4ss-mod',
    instructions,
    modType: MOD_TYPES.UE4SS_MODS,
    warnings: ['ue4ss-loader-missing'],
  };
}

function ue4ssWin64Destination(file) {
  const segments = pathSegments(file);
  const ue4ssIdx = indexOfSegment(segments, 'ue4ss');
  const modsIdx = indexOfSegment(segments, 'mods');
  const signaturesIdx = indexOfSegment(segments, 'ue4ss_signatures');
  const base = basename(file).toLowerCase();
  if (ue4ssIdx !== -1) {
    return segments.slice(ue4ssIdx).join('/');
  }
  if (base === 'dwmapi.dll') {
    return 'dwmapi.dll';
  }
  if (base === 'ue4ss.dll' || base === 'ue4ss-settings.ini') {
    return basename(file);
  }
  if (modsIdx !== -1) {
    return segments.slice(modsIdx).join('/');
  }
  if (signaturesIdx !== -1) {
    return segments.slice(signaturesIdx).join('/');
  }
  return undefined;
}

function installUE4SSWin64(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.WIN64_ROOT)];
  const rootModsUnderUE4SS = hasUE4SSSegment(files);

  for (const file of fileEntries(files)) {
    const destination = ue4ssWin64Destination(file);
    if (destination !== undefined) {
      const normalizedDestination = rootModsUnderUE4SS && isModsDestination(destination)
        ? path.join('ue4ss', destination)
        : destination;
      instructions.push(copyInstruction(file, normalizedDestination));
    }
  }

  return {
    kind: 'ue4ss-win64',
    instructions,
    modType: MOD_TYPES.WIN64_ROOT,
    warnings: [],
  };
}

function installMixedUE4SSPak(files) {
  const instructions = [setModTypeInstruction(MOD_TYPES.GAME_ROOT)];
  const pakType = pakModType(files);
  const pakPath = pakTargetPath(pakType);
  const rootModsUnderUE4SS = hasUE4SSSegment(files);
  const ue4ssModDestinations = deployableUE4SSModDestinations(files);

  for (const file of pakCopyFiles(files)) {
    instructions.push(copyInstruction(file, path.join(pakPath, basename(file))));
  }

  if (ue4ssModDestinations.length > 0) {
    for (const { file, destination } of ue4ssModDestinations) {
      instructions.push(copyInstruction(file, path.join(UE4SS_MODS_PATH, destination)));
    }
  } else if (hasUE4SSLoader(files)) {
    for (const file of fileEntries(files)) {
      const destination = ue4ssWin64Destination(file);
      if (destination !== undefined) {
        const normalizedDestination = rootModsUnderUE4SS && isModsDestination(destination)
          ? path.join('ue4ss', destination)
          : destination;
        instructions.push(copyInstruction(file, path.join(WIN64_PATH, normalizedDestination)));
      }
    }
  } else {
    for (const { file, destination } of ue4ssModDestinations) {
      instructions.push(copyInstruction(file, path.join(UE4SS_MODS_PATH, destination)));
    }
  }

  return {
    kind: 'mixed-ue4ss-pak',
    instructions,
    modType: MOD_TYPES.GAME_ROOT,
    warnings: ue4ssModDestinations.length > 0 || !hasUE4SSLoader(files)
      ? ['ue4ss-loader-missing']
      : [],
  };
}

function installTFWWorkbench(files) {
  const instructions = [
    setModTypeInstruction(MOD_TYPES.GAME_ROOT),
    {
      type: 'mkdir',
      destination: TFW_WORKBENCH_DATA_PATH,
    },
  ];

  for (const file of fileEntries(files)) {
    const destination = tfwWorkbenchDestination(file);
    if (destination !== undefined) {
      instructions.push(copyInstruction(file, destination));
    }
  }

  return {
    kind: 'tfw-workbench',
    instructions,
    modType: MOD_TYPES.GAME_ROOT,
    warnings: ['ue4ss-loader-missing'],
  };
}

function buildInstallInstructions(files) {
  if (isSignatureBypassArchive(files) && !hasUE4SS(files) && !hasPakFile(files)) {
    return installSignatureBypass(files);
  }

  if (hasGameRootPath(files)) {
    return installGameRoot(files);
  }

  if (isTFWWorkbenchArchive(files)) {
    return installTFWWorkbench(files);
  }

  if (hasUE4SS(files) && hasPakFile(files)) {
    return installMixedUE4SSPak(files);
  }

  if (hasUE4SS(files)) {
    return hasUE4SSLoader(files) && !hasDeployableUE4SSMod(files)
      ? installUE4SSWin64(files)
      : installUE4SSModOnly(files);
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
  isTFWWorkbenchArchive,
  modTypeTest,
  normalizeArchivePath,
  testSupportedContent,
  testSupportedSignatureBypass,
};
