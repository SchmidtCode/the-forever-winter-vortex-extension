const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeManifestEntries,
  parseManifest,
  parseModsJson,
  parseModsTxt,
  renderModsJson,
  renderModsTxt,
  repairLikelyMissingJsonCommas,
} = require('../src/ue4ss-manifest');

test('parseModsTxt reads UE4SS mods text entries and ignores comments', () => {
  const entries = parseModsTxt(`CheatManagerEnablerMod : 1
ActorDumperMod : 0

; Built-in keybinds, do not move up!
Keybinds : 1
`);

  assert.deepEqual(entries, [
    { mod_name: 'CheatManagerEnablerMod', mod_enabled: true },
    { mod_name: 'ActorDumperMod', mod_enabled: false },
    { mod_name: 'Keybinds', mod_enabled: true },
  ]);
});

test('parseModsJson repairs missing comma between objects', () => {
  const malformed = `[
    {
        "mod_name": "NoRecoil",
        "mod_enabled": true
    }
    {
        "mod_name": "Keybinds",
        "mod_enabled": true
    }
]`;

  assert.equal(repairLikelyMissingJsonCommas(malformed).includes('},{'), true);
  assert.deepEqual(parseModsJson(malformed), [
    { mod_name: 'NoRecoil', mod_enabled: true },
    { mod_name: 'Keybinds', mod_enabled: true },
  ]);
});

test('parseManifest falls back to mods.txt parser when mods.json is unusable text', () => {
  assert.deepEqual(parseManifest('mods.json', 'NoRecoil : 1'), [
    { mod_name: 'NoRecoil', mod_enabled: true },
  ]);
});

test('mergeManifestEntries lets later mod manifest values win', () => {
  const ue4ss = parseModsTxt(`ConsoleCommandsMod : 1
LineTraceMod : 0
BPModLoaderMod : 1
Keybinds : 1
`);
  const cheaper = parseModsTxt(`LineTraceMod : 1
CheaperInnardsUpgrades : 1
Keybinds : 1
`);
  const noRecoil = parseModsJson(`[
    { "mod_name": "NoRecoil", "mod_enabled": true }
]`);

  assert.deepEqual(mergeManifestEntries(ue4ss, cheaper, noRecoil), [
    { mod_name: 'ConsoleCommandsMod', mod_enabled: true },
    { mod_name: 'LineTraceMod', mod_enabled: true },
    { mod_name: 'BPModLoaderMod', mod_enabled: true },
    { mod_name: 'Keybinds', mod_enabled: true },
    { mod_name: 'CheaperInnardsUpgrades', mod_enabled: true },
    { mod_name: 'NoRecoil', mod_enabled: true },
  ]);
});

test('renderModsTxt writes a stable UE4SS mods.txt with keybinds footer', () => {
  const rendered = renderModsTxt([
    { mod_name: 'Keybinds', mod_enabled: true },
    { mod_name: 'NoRecoil', mod_enabled: true },
    { mod_name: 'LineTraceMod', mod_enabled: false },
  ]);

  assert.equal(rendered, [
    'LineTraceMod : 0',
    'NoRecoil : 1',
    '',
    '',
    '',
    '; Built-in keybinds, do not move up!',
    'Keybinds : 1',
    '',
  ].join('\r\n'));
});

test('renderModsJson writes valid normalized JSON', () => {
  const rendered = renderModsJson([
    { mod_name: 'NoRecoil', mod_enabled: true },
    { mod_name: 'Keybinds', mod_enabled: true },
  ]);

  assert.deepEqual(JSON.parse(rendered), [
    { mod_name: 'NoRecoil', mod_enabled: true },
    { mod_name: 'Keybinds', mod_enabled: true },
  ]);
});
