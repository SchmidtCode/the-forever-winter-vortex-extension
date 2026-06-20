const path = require('path');

const {
  GAME_EXECUTABLE,
  GAME_ID,
  GAME_NAME,
  MOD_TYPES,
  PAKS_MODS_PATH,
  PAKS_ROOT_PATH,
  STEAM_APP_ID,
  UE4SS_RELEASES_URL,
  UE4SS_MODS_PATH,
  WIN64_PATH,
} = require('./src/constants');
const {
  buildInstallInstructions,
  isSignatureBypassArchive,
  modTypeTest,
  testSupportedContent,
  testSupportedSignatureBypass,
} = require('./src/installers');
const {
  findMisroutedUE4SSPakFiles,
  ue4ssLoaderStatus,
} = require('./src/deploy-health');
const { materializePakSymlinks, materializeUE4SSRuntimeSymlinks } = require('./src/pak-deploy');
const { prepareForModding } = require('./src/setup');
const { regenerateUE4SSManifests } = require('./src/ue4ss-deploy');
const { ue4ssManifestFilterForProfile } = require('./src/ue4ss-profile');

function loadVortexApi() {
  try {
    return require('@nexusmods/vortex-api');
  } catch (err) {
    return require('vortex-api');
  }
}

const { fs, util } = loadVortexApi();
const nodeFs = require('fs');

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_APP_ID])
    .then((game) => game.gamePath);
}

function getDiscoveredPath(context, game) {
  const state = context.api.getState();
  const discovery = state.settings.gameMode.discovered[game.id];
  return discovery !== undefined ? discovery.path : undefined;
}

function absoluteGamePath(context, relPath) {
  return (game) => {
    const gamePath = getDiscoveredPath(context, game);
    return gamePath !== undefined ? path.join(gamePath, relPath) : undefined;
  };
}

function getDiscoveredGamePath(context) {
  const state = context.api.getState();
  const discovery = state.settings?.gameMode?.discovered?.[GAME_ID];
  return discovery !== undefined ? discovery.path : undefined;
}

function isTheForeverWinterProfile(context, profileId) {
  const state = context.api.getState();
  const profiles = state.persistent?.profiles || {};
  const profile = profiles[profileId];
  return profile === undefined || profile.gameId === undefined || profile.gameId === GAME_ID;
}

function statExists(filePath) {
  return fs.statAsync(filePath)
    .then(() => true)
    .catch(() => false);
}

function hasInstalledUE4SSMod(context) {
  const state = context.api.getState();
  const mods = state.persistent?.mods?.[GAME_ID] || {};
  return Object.entries(mods).some(([modId, mod]) => {
    const searchable = [
      modId,
      mod?.installationPath,
      mod?.attributes?.name,
      mod?.attributes?.logicalFileName,
      mod?.attributes?.modName,
      mod?.attributes?.source,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes('ue4ss');
  });
}

async function hasDeployedUE4SS(context) {
  const gamePath = getDiscoveredGamePath(context);
  if (gamePath === undefined) {
    return false;
  }

  const win64 = path.join(gamePath, WIN64_PATH);
  const hasProxy = await statExists(path.join(win64, 'dwmapi.dll'));
  const hasRootDll = await statExists(path.join(win64, 'UE4SS.dll'));
  const hasFolderDll = await statExists(path.join(win64, 'ue4ss', 'UE4SS.dll'));
  return hasProxy && (hasRootDll || hasFolderDll);
}

async function hasUE4SSAvailable(context) {
  if (hasInstalledUE4SSMod(context)) {
    return true;
  }
  return hasDeployedUE4SS(context);
}

function notifyUE4SSLoaderMissing(api) {
  api.sendNotification({
    id: 'tfw-ue4ss-loader-missing',
    type: 'warning',
    title: 'UE4SS loader may be required',
    message: 'This looks like a UE4SS mod without loader files. Vortex will install it, but it will only run if UE4SS is already installed in the game Win64 folder.',
    actions: [
      {
        title: 'Open UE4SS releases',
        action: () => util.opn(UE4SS_RELEASES_URL).catch(() => undefined),
      },
    ],
  });
}

function notifyUE4SSManifestFailed(api, error) {
  api.sendNotification({
    id: 'tfw-ue4ss-manifest-regeneration-failed',
    type: 'warning',
    title: 'UE4SS manifest update failed',
    message: `Vortex could not regenerate UE4SS mods.txt/mods.json: ${error.message}`,
  });
}

function notifyUE4SSLegacyLayout(api) {
  api.sendNotification({
    id: 'tfw-ue4ss-legacy-root-layout',
    type: 'warning',
    title: 'UE4SS legacy layout detected',
    message: 'UE4SS is installed in the old Win64 root layout, but this extension deploys UE4SS mods to Win64\\ue4ss\\Mods. Install UE4SS experimental-latest, or set ModsFolderPath = ue4ss\\Mods in UE4SS-settings.ini.',
    actions: [
      {
        title: 'Open UE4SS releases',
        action: () => util.opn(UE4SS_RELEASES_URL).catch(() => undefined),
      },
    ],
  });
}

function notifyPakMaterializationFailed(api, result) {
  const firstError = result.errors[0];
  api.sendNotification({
    id: 'tfw-pak-symlink-materialize-failed',
    type: 'warning',
    title: 'PAK deployment needs attention',
    message: `Vortex deployed PAK files, but the extension could not replace every symlink with a physical file. First error: ${firstError.message}`,
  });
}

function notifyUE4SSRuntimeMaterialized(api, result) {
  const count = result.materialized;
  api.sendNotification({
    id: 'tfw-ue4ss-runtime-symlinks-materialized',
    type: 'info',
    title: 'UE4SS runtime files converted',
    message: `The extension replaced ${count} symlinked UE4SS runtime file${count === 1 ? '' : 's'} with real files to better match a manual UE4SS install.`,
  });
}

function notifyUE4SSRuntimeMaterializationFailed(api, result) {
  const firstError = result.errors[0];
  api.sendNotification({
    id: 'tfw-ue4ss-runtime-symlink-materialize-failed',
    type: 'warning',
    title: 'UE4SS deployment needs attention',
    message: `Vortex deployed UE4SS runtime files, but the extension could not replace every symlink with a real file. First error: ${firstError.message}`,
  });
}

function notifyUE4SSLoaderIncomplete(api, status) {
  api.sendNotification({
    id: 'tfw-ue4ss-loader-incomplete',
    type: 'warning',
    title: 'UE4SS loader files are missing',
    message: `UE4SS is enabled in Vortex, but the deployed game folder is missing: ${status.missing.join(', ')}. Remove and reinstall the UE4SS archive with this extension version, then purge and redeploy.`,
    actions: [
      {
        title: 'Open UE4SS releases',
        action: () => util.opn(UE4SS_RELEASES_URL).catch(() => undefined),
      },
    ],
  });
}

function notifyMisroutedPakFiles(api, files) {
  const names = files.slice(0, 3).map((filePath) => path.basename(filePath)).join(', ');
  const suffix = files.length > 3 ? ` and ${files.length - 3} more` : '';
  api.sendNotification({
    id: 'tfw-pak-files-under-ue4ss-mods',
    type: 'warning',
    title: 'PAK mods deployed to the wrong folder',
    message: `Found PAK container files under Win64\\ue4ss\\Mods: ${names}${suffix}. Remove and reinstall those PAK mods with this extension version, then purge and redeploy.`,
  });
}

async function warnForUE4SSLegacyLayout(context, gamePath) {
  if (gamePath === undefined) {
    return;
  }

  const win64 = path.join(gamePath, WIN64_PATH);
  const hasRootDll = await statExists(path.join(win64, 'UE4SS.dll'));
  const hasFolderDll = await statExists(path.join(win64, 'ue4ss', 'UE4SS.dll'));
  const hasModernMods = await statExists(path.join(gamePath, UE4SS_MODS_PATH));

  if (hasRootDll && !hasFolderDll && hasModernMods) {
    notifyUE4SSLegacyLayout(context.api);
  }
}

async function postDeployForContext(context, profileId) {
  if (!isTheForeverWinterProfile(context, profileId)) {
    return;
  }

  const gamePath = getDiscoveredGamePath(context);
  const manifestFilter = ue4ssManifestFilterForProfile(context, profileId);

  const pakResult = await materializePakSymlinks(gamePath, nodeFs);
  if (pakResult.errors.length > 0) {
    notifyPakMaterializationFailed(context.api, pakResult);
  }

  const misroutedPakFiles = await findMisroutedUE4SSPakFiles(gamePath, nodeFs);
  if (misroutedPakFiles.length > 0) {
    notifyMisroutedPakFiles(context.api, misroutedPakFiles);
  }

  const ue4ssRuntimeResult = await materializeUE4SSRuntimeSymlinks(gamePath, nodeFs);
  if (ue4ssRuntimeResult.errors.length > 0) {
    notifyUE4SSRuntimeMaterializationFailed(context.api, ue4ssRuntimeResult);
  } else if (ue4ssRuntimeResult.materialized > 0) {
    notifyUE4SSRuntimeMaterialized(context.api, ue4ssRuntimeResult);
  }

  const loaderStatus = await ue4ssLoaderStatus(gamePath, nodeFs);
  if (hasInstalledUE4SSMod(context) && loaderStatus.missing.length > 0) {
    notifyUE4SSLoaderIncomplete(context.api, loaderStatus);
  }

  try {
    await regenerateUE4SSManifests(fs, gamePath, {
      ...manifestFilter,
      nodeFs,
    });
  } catch (err) {
    notifyUE4SSManifestFailed(context.api, err);
  }

  await warnForUE4SSLegacyLayout(context, gamePath);
}

function registerUE4SSManifestEvents(context) {
  const register = () => {
    if (typeof context.api.onAsync === 'function') {
      context.api.onAsync('did-deploy', (profileId) =>
        postDeployForContext(context, profileId));
    }
  };

  if (typeof context.once === 'function') {
    context.once(register);
  } else {
    register();
  }
}

function installSignatureBypass(context, files) {
  const result = buildInstallInstructions(files);
  return Promise.resolve({ instructions: result.instructions });
}

async function installContent(context, files) {
  const result = buildInstallInstructions(files);
  if (result.warnings.includes('ue4ss-loader-missing')
      && !(await hasUE4SSAvailable(context))) {
    notifyUE4SSLoaderMissing(context.api);
  }
  return { instructions: result.instructions };
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: GAME_NAME,
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => PAKS_MODS_PATH,
    logo: 'gameart.jpg',
    executable: () => GAME_EXECUTABLE,
    requiredFiles: [
      GAME_EXECUTABLE,
      PAKS_ROOT_PATH,
    ],
    setup: (discovery) => prepareForModding(context.api, discovery, fs, util),
    environment: {
      SteamAPPId: STEAM_APP_ID,
    },
    details: {
      steamAppId: Number(STEAM_APP_ID),
      nexusPageId: GAME_ID,
      hashFiles: [GAME_EXECUTABLE],
      ignoreConflicts: ['enabled.txt', 'mods.txt', 'mods.json', 'UE4SS-settings.ini'],
      ignoreDeploy: ['mods.txt', 'mods.json'],
    },
  });

  context.registerInstaller(
    'tfw-signature-bypass-win64',
    15,
    testSupportedSignatureBypass,
    (files) => installSignatureBypass(context, files),
  );

  context.registerInstaller(
    'tfw-archive-router',
    25,
    testSupportedContent,
    (files) => installContent(context, files),
  );

  context.registerModType(
    MOD_TYPES.PAKS_MODS,
    25,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, PAKS_MODS_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.PAKS_MODS)),
    { name: 'TFW PAKs Mods', mergeMods: true, deploymentEssential: true },
  );

  context.registerModType(
    MOD_TYPES.PAKS_ROOT,
    26,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, PAKS_ROOT_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.PAKS_ROOT)),
    { name: 'TFW PAKs Root', mergeMods: true, deploymentEssential: true },
  );

  context.registerModType(
    MOD_TYPES.WIN64_ROOT,
    30,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, WIN64_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.WIN64_ROOT)),
    { name: 'TFW Win64 Root', mergeMods: true, deploymentEssential: true },
  );

  context.registerModType(
    MOD_TYPES.UE4SS_MODS,
    31,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, UE4SS_MODS_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.UE4SS_MODS)),
    { name: 'TFW UE4SS Mods', mergeMods: true, deploymentEssential: true },
  );

  context.registerModType(
    MOD_TYPES.GAME_ROOT,
    35,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, ''),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.GAME_ROOT)),
    { name: 'TFW Game Root', mergeMods: true, deploymentEssential: true },
  );

  registerUE4SSManifestEvents(context);

  return true;
}

module.exports = {
  default: main,
  ue4ssManifestFilterForProfile,
  isSignatureBypassArchive,
};
