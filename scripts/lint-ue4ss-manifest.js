#!/usr/bin/env node

const nodeFs = require('node:fs');
const path = require('node:path');

const {
  parseManifest,
  renderModsJson,
  renderModsTxt,
} = require('../src/ue4ss-manifest');

function usage() {
  console.error('Usage: node scripts/lint-ue4ss-manifest.js <mods.txt|mods.json> [--write]');
}

function main(argv) {
  const filePath = argv.find((arg) => !arg.startsWith('--'));
  const write = argv.includes('--write');

  if (filePath === undefined) {
    usage();
    return 1;
  }

  const text = nodeFs.readFileSync(filePath, 'utf8');
  const entries = parseManifest(filePath, text);
  if (entries.length === 0) {
    console.error(`No UE4SS manifest entries found in ${filePath}`);
    return 2;
  }

  const ext = path.extname(filePath).toLowerCase();
  const rendered = ext === '.json' ? renderModsJson(entries) : renderModsTxt(entries);

  if (write) {
    nodeFs.writeFileSync(filePath, rendered);
    console.log(`Normalized ${filePath}`);
  } else {
    process.stdout.write(rendered);
  }

  return 0;
}

process.exitCode = main(process.argv.slice(2));
