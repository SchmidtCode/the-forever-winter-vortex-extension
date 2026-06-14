const path = require('path');

const { PAKS_MODS_PATH, SIGNATURE_BYPASS_URL, WIN64_PATH } = require('./constants');

function missingSignatureBypassNotification(util) {
  return {
    id: 'tfw-signature-bypass-missing',
    type: 'warning',
    title: 'Signature Bypass may be required',
    message: 'Many The Forever Winter PAK mods require Signature Bypass. Install it manually if your PAK mods do not load.',
    actions: [
      {
        title: 'Open Signature Bypass page',
        action: () => util.opn(SIGNATURE_BYPASS_URL).catch(() => undefined),
      },
    ],
  };
}

function statExists(fsModule, filePath) {
  return fsModule.statAsync(filePath)
    .then(() => true)
    .catch(() => false);
}

async function hasSignatureBypassInstalled(gamePath, fsModule) {
  const win64 = path.join(gamePath, WIN64_PATH);
  const dsound = await statExists(fsModule, path.join(win64, 'dsound.dll'));
  const bitfixFolder = await statExists(fsModule, path.join(win64, 'bitfix'));
  const bitfixText = await statExists(fsModule, path.join(win64, 'bitfix.txt'));
  return dsound && (bitfixFolder || bitfixText);
}

async function prepareForModding(api, discovery, fsModule, util) {
  const paksModsPath = path.join(discovery.path, PAKS_MODS_PATH);
  await fsModule.ensureDirWritableAsync(paksModsPath);

  const hasSignatureBypass = await hasSignatureBypassInstalled(discovery.path, fsModule);
  if (!hasSignatureBypass) {
    api.sendNotification(missingSignatureBypassNotification(util));
  }
}

module.exports = {
  hasSignatureBypassInstalled,
  missingSignatureBypassNotification,
  prepareForModding,
};
