const BUILTIN_FOOTER = [
  '',
  '',
  '',
  '; Built-in keybinds, do not move up!',
  'Keybinds : 1',
];

const DEFAULT_BUILTIN_ENTRIES = [
  { mod_name: 'CheatManagerEnablerMod', mod_enabled: true },
  { mod_name: 'ActorDumperMod', mod_enabled: false },
  { mod_name: 'ConsoleCommandsMod', mod_enabled: true },
  { mod_name: 'ConsoleEnablerMod', mod_enabled: true },
  { mod_name: 'SplitScreenMod', mod_enabled: false },
  { mod_name: 'LineTraceMod', mod_enabled: false },
  { mod_name: 'BPModLoaderMod', mod_enabled: true },
  { mod_name: 'BPML_GenericFunctions', mod_enabled: true },
  { mod_name: 'jsbLuaProfilerMod', mod_enabled: false },
  { mod_name: 'Keybinds', mod_enabled: true },
];

const BUILTIN_ENTRY_NAMES = new Set(DEFAULT_BUILTIN_ENTRIES.map((entry) => entry.mod_name));

function cleanModName(value) {
  return String(value || '').trim();
}

function boolToEnabled(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'enabled';
}

function normalizeEntries(entries) {
  const byName = new Map();

  for (const entry of entries) {
    const modName = cleanModName(entry.mod_name || entry.name);
    if (modName.length === 0) {
      continue;
    }
    byName.set(modName, {
      mod_name: modName,
      mod_enabled: boolToEnabled(entry.mod_enabled ?? entry.enabled),
    });
  }

  return Array.from(byName.values());
}

function parseModsTxt(text) {
  const entries = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^(.+?)\s*:\s*([01]|true|false|yes|no|enabled|disabled)\s*$/i);
    if (match === null) {
      continue;
    }

    entries.push({
      mod_name: cleanModName(match[1]),
      mod_enabled: boolToEnabled(match[2]),
    });
  }

  return normalizeEntries(entries);
}

function repairLikelyMissingJsonCommas(text) {
  return String(text || '')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[');
}

function parseModsJson(text) {
  const repaired = repairLikelyMissingJsonCommas(text);
  try {
    const parsed = JSON.parse(repaired);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeEntries(parsed);
  } catch (err) {
    return [];
  }
}

function parseManifest(fileName, text) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('mods.json')) {
    const jsonEntries = parseModsJson(text);
    if (jsonEntries.length > 0) {
      return jsonEntries;
    }
  }
  return parseModsTxt(text);
}

function mergeManifestEntries(...entryGroups) {
  const merged = new Map();
  for (const entries of entryGroups) {
    for (const entry of normalizeEntries(entries)) {
      merged.set(entry.mod_name, entry);
    }
  }
  return Array.from(merged.values());
}

function manifestEntriesFromFolderNames(folderNames) {
  return Array.from(new Set(folderNames.map(cleanModName).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((modName) => ({
      mod_name: modName,
      mod_enabled: true,
    }));
}

function isBuiltInEntryName(modName) {
  return BUILTIN_ENTRY_NAMES.has(cleanModName(modName));
}

function buildAggregateManifestEntries(existingEntries, folderNames) {
  const folderEntries = manifestEntriesFromFolderNames(folderNames);
  const folderNamesSet = new Set(folderEntries.map((entry) => entry.mod_name));
  const retainedExisting = normalizeEntries(existingEntries)
    .filter((entry) => isBuiltInEntryName(entry.mod_name) || folderNamesSet.has(entry.mod_name));

  return mergeManifestEntries(DEFAULT_BUILTIN_ENTRIES, retainedExisting, folderEntries);
}

function sortManifestEntries(entries) {
  const normalized = normalizeEntries(entries);
  return normalized.sort((left, right) => {
    if (left.mod_name === 'Keybinds') {
      return 1;
    }
    if (right.mod_name === 'Keybinds') {
      return -1;
    }
    return left.mod_name.localeCompare(right.mod_name);
  });
}

function renderModsTxt(entries) {
  const sorted = sortManifestEntries(entries).filter((entry) => entry.mod_name !== 'Keybinds');
  const lines = sorted.map((entry) => `${entry.mod_name} : ${entry.mod_enabled ? 1 : 0}`);
  return lines.concat(BUILTIN_FOOTER).join('\r\n') + '\r\n';
}

function renderModsJson(entries) {
  return JSON.stringify(sortManifestEntries(entries), null, 4) + '\n';
}

module.exports = {
  buildAggregateManifestEntries,
  DEFAULT_BUILTIN_ENTRIES,
  isBuiltInEntryName,
  mergeManifestEntries,
  manifestEntriesFromFolderNames,
  parseManifest,
  parseModsJson,
  parseModsTxt,
  renderModsJson,
  renderModsTxt,
  repairLikelyMissingJsonCommas,
};
