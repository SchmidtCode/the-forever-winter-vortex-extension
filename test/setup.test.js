const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { SIGNATURE_BYPASS_URL, WIN64_PATH } = require('../src/constants');
const {
  hasSignatureBypassInstalled,
  missingSignatureBypassNotification,
  prepareForModding,
} = require('../src/setup');

function mockFs(existingPaths) {
  const normalized = new Set(existingPaths.map((item) => path.normalize(item).toLowerCase()));
  return {
    ensured: [],
    ensureDirWritableAsync(dirPath) {
      this.ensured.push(path.normalize(dirPath));
      return Promise.resolve();
    },
    statAsync(filePath) {
      return normalized.has(path.normalize(filePath).toLowerCase())
        ? Promise.resolve({})
        : Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    },
  };
}

test('Signature Bypass detector requires dsound and bitfix marker', async () => {
  const gamePath = path.join('C:', 'Steam', 'steamapps', 'common', 'The Forever Winter');
  const win64 = path.join(gamePath, WIN64_PATH);
  const fsModule = mockFs([
    path.join(win64, 'dsound.dll'),
    path.join(win64, 'bitfix'),
  ]);

  assert.equal(await hasSignatureBypassInstalled(gamePath, fsModule), true);
});

test('missing Signature Bypass produces warning notification metadata', () => {
  const util = { opn: () => Promise.resolve() };
  const notification = missingSignatureBypassNotification(util);

  assert.equal(notification.id, 'tfw-signature-bypass-missing');
  assert.equal(notification.type, 'warning');
  assert.equal(notification.actions[0].title, 'Open Signature Bypass page');
  assert.equal(notification.actions[0].action().then instanceof Function, true);
  assert.equal(SIGNATURE_BYPASS_URL.includes('/mods/57'), true);
});

test('prepareForModding creates Paks Mods and warns when bypass is absent', async () => {
  const notifications = [];
  const api = { sendNotification: (notification) => notifications.push(notification) };
  const util = { opn: () => Promise.resolve() };
  const fsModule = mockFs([]);
  const discovery = {
    path: path.join('C:', 'Steam', 'steamapps', 'common', 'The Forever Winter'),
  };

  await prepareForModding(api, discovery, fsModule, util);

  assert.equal(fsModule.ensured.length, 1);
  assert.equal(fsModule.ensured[0].endsWith(path.join('Windows', 'ForeverWinter', 'Content', 'Paks', 'Mods')), true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].id, 'tfw-signature-bypass-missing');
});

test('prepareForModding does not warn when bypass is present', async () => {
  const notifications = [];
  const gamePath = path.join('C:', 'Steam', 'steamapps', 'common', 'The Forever Winter');
  const win64 = path.join(gamePath, WIN64_PATH);
  const fsModule = mockFs([
    path.join(win64, 'dsound.dll'),
    path.join(win64, 'bitfix.txt'),
  ]);
  const api = { sendNotification: (notification) => notifications.push(notification) };
  const util = { opn: () => Promise.resolve() };

  await prepareForModding(api, { path: gamePath }, fsModule, util);

  assert.equal(notifications.length, 0);
});
