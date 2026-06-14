const path = require('path');

const GAME_ID = 'theforeverwinter';
const GAME_NAME = 'The Forever Winter';
const STEAM_APP_ID = '2828860';

const WIN64_PATH = path.join('Windows', 'ForeverWinter', 'Binaries', 'Win64');
const PAKS_ROOT_PATH = path.join('Windows', 'ForeverWinter', 'Content', 'Paks');
const PAKS_MODS_PATH = path.join(PAKS_ROOT_PATH, 'Mods');
const TFW_WORKBENCH_DATA_PATH = path.join(PAKS_MODS_PATH, 'TFWWorkbench');
const UE4SS_MODS_PATH = path.join(WIN64_PATH, 'ue4ss', 'Mods');
const GAME_EXECUTABLE = path.join(WIN64_PATH, 'ForeverWinter-Win64-Shipping.exe');

const SIGNATURE_BYPASS_URL = 'https://www.nexusmods.com/theforeverwinter/mods/57';
const TFW_WORKBENCH_RELEASES_URL = 'https://github.com/smotti/TFWWorkbench/releases';
const UE4SS_RELEASES_URL = 'https://github.com/UE4SS-RE/RE-UE4SS/releases';

const MOD_TYPES = {
  PAKS_MODS: 'tfw-paks-mods',
  PAKS_ROOT: 'tfw-paks-root',
  WIN64_ROOT: 'tfw-win64-root',
  UE4SS_MODS: 'tfw-ue4ss-mods',
  GAME_ROOT: 'tfw-game-root',
};

module.exports = {
  GAME_EXECUTABLE,
  GAME_ID,
  GAME_NAME,
  MOD_TYPES,
  PAKS_MODS_PATH,
  PAKS_ROOT_PATH,
  SIGNATURE_BYPASS_URL,
  STEAM_APP_ID,
  TFW_WORKBENCH_DATA_PATH,
  TFW_WORKBENCH_RELEASES_URL,
  UE4SS_RELEASES_URL,
  UE4SS_MODS_PATH,
  WIN64_PATH,
};
