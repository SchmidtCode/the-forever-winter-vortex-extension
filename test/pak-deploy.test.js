const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { PAKS_MODS_PATH } = require('../src/constants');
const { isPakContainerFile, materializePakSymlinks } = require('../src/pak-deploy');

test('isPakContainerFile detects Unreal container files', () => {
  assert.equal(isPakContainerFile('Example_P.pak'), true);
  assert.equal(isPakContainerFile('Example_P.ucas'), true);
  assert.equal(isPakContainerFile('Example_P.utoc'), true);
  assert.equal(isPakContainerFile('mods.txt'), false);
  assert.equal(isPakContainerFile('UE4SS.dll'), false);
});

test('materializePakSymlinks replaces symlinked PAK containers with physical files', async (t) => {
  const gamePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tfw-pak-deploy-'));
  t.after(() => fs.promises.rm(gamePath, { recursive: true, force: true }));

  const stagedDir = path.join(gamePath, 'staging');
  const paksModsDir = path.join(gamePath, PAKS_MODS_PATH);
  await fs.promises.mkdir(stagedDir, { recursive: true });
  await fs.promises.mkdir(paksModsDir, { recursive: true });

  const stagedPak = path.join(stagedDir, 'RemoveStun_P.pak');
  const deployedPak = path.join(paksModsDir, 'RemoveStun_P.pak');
  await fs.promises.writeFile(stagedPak, 'physical pak bytes');

  try {
    await fs.promises.symlink(stagedPak, deployedPak);
  } catch (err) {
    t.skip(`symlink creation is not available in this environment: ${err.message}`);
    return;
  }

  const result = await materializePakSymlinks(gamePath, fs);

  assert.equal(result.errors.length, 0);
  assert.equal(result.materialized, 1);
  assert.equal(await fs.promises.readFile(deployedPak, 'utf8'), 'physical pak bytes');
  assert.equal((await fs.promises.lstat(deployedPak)).isSymbolicLink(), false);
});
