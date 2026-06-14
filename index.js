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
const { prepareForModding } = require('./src/setup');

function loadVortexApi() {
  try {
    return require('@nexusmods/vortex-api');
  } catch (err) {
    return require('vortex-api');
  }
}

const { fs, util } = loadVortexApi();

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
    { name: 'TFW PAKs Mods', mergeMods: true },
  );

  context.registerModType(
    MOD_TYPES.PAKS_ROOT,
    26,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, PAKS_ROOT_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.PAKS_ROOT)),
    { name: 'TFW PAKs Root', mergeMods: true },
  );

  context.registerModType(
    MOD_TYPES.WIN64_ROOT,
    30,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, WIN64_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.WIN64_ROOT)),
    { name: 'TFW Win64 Root', mergeMods: true },
  );

  context.registerModType(
    MOD_TYPES.UE4SS_MODS,
    31,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, UE4SS_MODS_PATH),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.UE4SS_MODS)),
    { name: 'TFW UE4SS Mods', mergeMods: true },
  );

  context.registerModType(
    MOD_TYPES.GAME_ROOT,
    35,
    (gameId) => gameId === GAME_ID,
    absoluteGamePath(context, ''),
    (instructions) => Promise.resolve(modTypeTest(instructions, MOD_TYPES.GAME_ROOT)),
    { name: 'TFW Game Root', mergeMods: true },
  );

  return true;
}

module.exports = {
  default: main,
  isSignatureBypassArchive,
};
