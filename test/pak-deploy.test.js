const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { WIN64_PATH, PAKS_MODS_PATH } = require('../src/constants');
const {
  isPakContainerFile,
  materializePakSymlinks,
  materializeUE4SSRuntimeSymlinks,
} = require('../src/pak-deploy');

test('isPakContainerFile detects Unreal container files', () => {
  assert.equal(isPakContainerFile('Example_P.pak'), true);
  assert.equal(isPakContainerFile('Example_P.ucas'), true);
  assert.equal(isPakContainerFile('Example_P.utoc'), true);
  assert.equal(isPakContainerFile('mods.txt'), false);
  assert.equal(isPakContainerFile('UE4SS.dll'), false);
});

test('materializePakSymlinks replaces symlinked PAK containers with timestamp-preserved real files', async (t) => {
  const gamePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tfw-pak-deploy-'));
  t.after(() => fs.promises.rm(gamePath, { recursive: true, force: true }));

  const stagedDir = path.join(gamePath, 'staging');
  const paksModsDir = path.join(gamePath, PAKS_MODS_PATH);
  await fs.promises.mkdir(stagedDir, { recursive: true });
  await fs.promises.mkdir(paksModsDir, { recursive: true });

  const stagedPak = path.join(stagedDir, 'RemoveStun_P.pak');
  const deployedPak = path.join(paksModsDir, 'RemoveStun_P.pak');
  await fs.promises.writeFile(stagedPak, 'physical pak bytes');
  const stagedTime = new Date('2026-01-02T03:04:05.000Z');
  await fs.promises.utimes(stagedPak, stagedTime, stagedTime);

  try {
    await fs.promises.symlink(stagedPak, deployedPak);
  } catch (err) {
    t.skip(`symlink creation is not available in this environment: ${err.message}`);
    return;
  }

  const result = await materializePakSymlinks(gamePath, fs);

  assert.equal(result.errors.length, 0);
  assert.equal(result.materialized, 1);
  assert.deepEqual(result.files, [deployedPak]);
  assert.equal(await fs.promises.readFile(deployedPak, 'utf8'), 'physical pak bytes');
  const deployedStat = await fs.promises.lstat(deployedPak);
  assert.equal(deployedStat.isSymbolicLink(), false);
  assert.equal(Math.trunc(deployedStat.mtimeMs / 1000), Math.trunc(stagedTime.getTime() / 1000));
});

test('materializeUE4SSRuntimeSymlinks replaces symlinked UE4SS runtime files', async (t) => {
  const gamePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tfw-ue4ss-deploy-'));
  t.after(() => fs.promises.rm(gamePath, { recursive: true, force: true }));

  const stagedDir = path.join(gamePath, 'staging');
  const win64Dir = path.join(gamePath, WIN64_PATH);
  const ue4ssDir = path.join(win64Dir, 'ue4ss');
  await fs.promises.mkdir(stagedDir, { recursive: true });
  await fs.promises.mkdir(ue4ssDir, { recursive: true });

  const stagedDwmapi = path.join(stagedDir, 'dwmapi.dll');
  const stagedDll = path.join(stagedDir, 'UE4SS.dll');
  const stagedSettings = path.join(stagedDir, 'UE4SS-settings.ini');
  const deployedDwmapi = path.join(win64Dir, 'dwmapi.dll');
  const deployedDll = path.join(ue4ssDir, 'UE4SS.dll');
  const deployedSettings = path.join(ue4ssDir, 'UE4SS-settings.ini');

  await fs.promises.writeFile(stagedDwmapi, 'proxy');
  await fs.promises.writeFile(stagedDll, 'runtime');
  await fs.promises.writeFile(stagedSettings, 'settings');

  try {
    await fs.promises.symlink(stagedDwmapi, deployedDwmapi);
    await fs.promises.symlink(stagedDll, deployedDll);
    await fs.promises.symlink(stagedSettings, deployedSettings);
  } catch (err) {
    t.skip(`symlink creation is not available in this environment: ${err.message}`);
    return;
  }

  const result = await materializeUE4SSRuntimeSymlinks(gamePath, fs);

  assert.equal(result.errors.length, 0);
  assert.equal(result.materialized, 3);
  assert.deepEqual(result.files.sort(), [
    deployedDll,
    deployedDwmapi,
    deployedSettings,
  ].sort());
  assert.equal(await fs.promises.readFile(deployedDwmapi, 'utf8'), 'proxy');
  assert.equal(await fs.promises.readFile(deployedDll, 'utf8'), 'runtime');
  assert.equal(await fs.promises.readFile(deployedSettings, 'utf8'), 'settings');
  assert.equal((await fs.promises.lstat(deployedDwmapi)).isSymbolicLink(), false);
  assert.equal((await fs.promises.lstat(deployedDll)).isSymbolicLink(), false);
  assert.equal((await fs.promises.lstat(deployedSettings)).isSymbolicLink(), false);
});
