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

function installContent(context, files) {
  const result = buildInstallInstructions(files);
  if (result.warnings.includes('ue4ss-loader-missing')) {
    notifyUE4SSLoaderMissing(context.api);
  }
  return Promise.resolve({ instructions: result.instructions });
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
