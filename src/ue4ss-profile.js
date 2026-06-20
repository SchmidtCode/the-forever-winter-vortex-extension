const path = require('path');

const {
  GAME_ID,
  MOD_TYPES,
  UE4SS_MODS_PATH,
} = require('./constants');
const { isBuiltInEntryName } = require('./ue4ss-manifest');

const IGNORED_UE4SS_FOLDER_NAMES = new Set(['shared']);
const MANIFEST_FILE_NAMES = new Set(['mods.txt', 'mods.json']);

function normalizeModName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function cleanFolderName(value) {
  return String(value || '').trim();
}

function isIgnoredUE4SSFolderName(folderName) {
  const cleaned = cleanFolderName(folderName);
  return cleaned.length === 0
    || MANIFEST_FILE_NAMES.has(cleaned.toLowerCase())
    || IGNORED_UE4SS_FOLDER_NAMES.has(cleaned.toLowerCase())
    || isBuiltInEntryName(cleaned);
}

function pathSegments(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .split('/')
    .filter(Boolean);
}

function lowerSegments(segments) {
  return segments.map((segment) => segment.toLowerCase());
}

function hasUE4SSModMarker(segments) {
  const lower = lowerSegments(segments);
  return lower.includes('enabled.txt')
    || lower.join('/').includes('/scripts/main.lua')
    || lower.includes('load_order.txt')
    || lower.includes('dlls');
}

function isPaksModsPath(lower) {
  const paksIdx = lower.findIndex((segment) => segment === 'paks');
  const modsIdx = lower.findIndex((segment) => segment === 'mods');
  return paksIdx !== -1 && modsIdx !== -1 && paksIdx < modsIdx;
}

function addUE4SSFolderName(target, folderName) {
  const cleaned = cleanFolderName(folderName);
  if (!isIgnoredUE4SSFolderName(cleaned)) {
    target.add(cleaned);
  }
}

function addUE4SSFolderFromPath(target, value, options = {}) {
  const segments = pathSegments(value);
  if (segments.length === 0) {
    return;
  }

  const lower = lowerSegments(segments);
  for (let idx = 0; idx < lower.length - 1; idx += 1) {
    if (lower[idx] !== 'mods') {
      continue;
    }

    const previous = lower[idx - 1];
    const candidate = segments[idx + 1];
    if (previous === 'ue4ss') {
      addUE4SSFolderName(target, candidate);
      continue;
    }

    const tail = segments.slice(idx + 1);
    if (!isPaksModsPath(lower) && hasUE4SSModMarker(tail)) {
      addUE4SSFolderName(target, candidate);
    }
  }

  if (options.relativeToUE4SSModsRoot
      && segments.length > 1
      && hasUE4SSModMarker(segments)) {
    addUE4SSFolderName(target, segments[0]);
  }
}

function collectStringLikeValues(value, target, seen = new WeakSet(), depth = 0) {
  if (value === undefined || value === null || depth > 8) {
    return;
  }

  if (typeof value === 'string') {
    target.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringLikeValues(item, target, seen, depth + 1);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  for (const [key, item] of Object.entries(value)) {
    if (typeof key === 'string' && (key.includes('/') || key.includes('\\'))) {
      target.push(key);
    }
    collectStringLikeValues(item, target, seen, depth + 1);
  }
}

function modTypeValue(mod) {
  return mod?.type
    || mod?.modType
    || mod?.attributes?.type
    || mod?.attributes?.modType
    || mod?.attributes?.modtype;
}

function isUE4SSModsType(mod) {
  return modTypeValue(mod) === MOD_TYPES.UE4SS_MODS;
}

function ue4ssFolderNamesFromMod(mod) {
  const values = [];
  const folders = new Set();
  collectStringLikeValues(mod, values);

  for (const value of values) {
    addUE4SSFolderFromPath(folders, value, {
      relativeToUE4SSModsRoot: isUE4SSModsType(mod),
    });
  }

  return folders;
}

function candidateModNames(modId, mod) {
  const attributes = mod?.attributes || {};
  return [
    modId,
    mod?.installationPath,
    attributes.name,
    attributes.logicalFileName,
    attributes.modName,
    attributes.customFileName,
  ]
    .filter(Boolean)
    .map((value) => path.basename(String(value), path.extname(String(value))))
    .map(normalizeModName)
    .filter(Boolean);
}

function profileModState(profile) {
  const modState = profile?.modState || {};
  return modState[GAME_ID] || modState;
}

function activeProfileIdFromState(state, profileId) {
  return profileId
    || state.settings?.profiles?.activeProfileId
    || state.settings?.profiles?.activeProfile
    || state.persistent?.profiles?.activeProfileId
    || state.persistent?.profiles?.activeProfile
    || state.persistent?.activeProfileId
    || state.persistent?.activeProfile;
}

function collectProfileModState(state, profileId) {
  const profile = state.persistent?.profiles?.[profileId];
  const sources = [
    profileModState(profile),
    state.persistent?.profileModState?.[profileId]?.[GAME_ID],
    state.persistent?.profileModState?.[profileId],
    state.persistent?.modState?.[profileId]?.[GAME_ID],
    state.persistent?.modState?.[profileId],
    state.settings?.profiles?.modState?.[profileId]?.[GAME_ID],
    state.settings?.profiles?.modState?.[profileId],
  ];
  const merged = {};

  for (const source of sources) {
    if (source === undefined || source === null || typeof source !== 'object') {
      continue;
    }
    for (const [modId, modState] of Object.entries(source)) {
      if (modId === GAME_ID && modState !== null && typeof modState === 'object') {
        continue;
      }
      if (merged[modId] === undefined) {
        merged[modId] = modState;
      }
    }
  }

  return merged;
}

function boolFromProfileValue(value) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'disabled'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function isModEnabledInProfile(modState, modId) {
  const state = modState?.[modId];
  if (state === undefined) {
    return undefined;
  }

  if (typeof state === 'object' && state !== null) {
    if (state.enabled !== undefined) {
      return boolFromProfileValue(state.enabled);
    }
    if (state.disabled !== undefined) {
      const disabled = boolFromProfileValue(state.disabled);
      return disabled === undefined ? undefined : !disabled;
    }
  }

  return boolFromProfileValue(state);
}

function namesForProfileFilter(modId, mod) {
  return new Set([
    ...Array.from(ue4ssFolderNamesFromMod(mod)).map(normalizeModName),
    ...candidateModNames(modId, mod),
  ].filter(Boolean));
}

function ue4ssManifestFilterForState(state, profileId) {
  const activeProfileId = activeProfileIdFromState(state, profileId);
  const modState = collectProfileModState(state, activeProfileId);
  const mods = state.persistent?.mods?.[GAME_ID] || {};
  const allowedNames = new Set();
  const disabledNames = new Set();
  let hasKnownProfileState = false;

  for (const [modId, mod] of Object.entries(mods)) {
    const enabled = isModEnabledInProfile(modState, modId);
    if (enabled === undefined) {
      continue;
    }
    hasKnownProfileState = true;
    for (const name of namesForProfileFilter(modId, mod)) {
      if (enabled) {
        allowedNames.add(name);
      } else {
        disabledNames.add(name);
      }
    }
  }

  return {
    allowedFolderNames: hasKnownProfileState ? allowedNames : undefined,
    disabledFolderNames: disabledNames,
  };
}

function ue4ssManifestFilterForProfile(context, profileId) {
  return ue4ssManifestFilterForState(context.api.getState(), profileId);
}

module.exports = {
  candidateModNames,
  collectProfileModState,
  isModEnabledInProfile,
  normalizeModName,
  ue4ssFolderNamesFromMod,
  ue4ssManifestFilterForProfile,
  ue4ssManifestFilterForState,
};
