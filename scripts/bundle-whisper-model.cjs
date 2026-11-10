'use strict';

/**
 * Stages the bundled on-device speech models (every catalog entry marked
 * `bundled`) in resources/models, which electron-builder ships as
 * Contents/Resources/models. A fresh install can dictate at once, with no
 * download first. Copies from a local model cache when one has the files,
 * else downloads from Hugging Face.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getRequiredFiles } = require('../electron/lib/speechModelFiles.cjs');

const CATALOG = require('../src/lib/voice/whisper-model-catalog.json');

const MODELS_ROOT = path.join(__dirname, '..', 'resources', 'models');

function hasAllFiles(dir, files) {
  return files.every((rel) => {
    const filePath = path.join(dir, rel);
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed ${url} (${res.status})`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const partial = `${dest}.partial`;
  fs.writeFileSync(partial, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(partial, dest);
}

async function stage(entry) {
  const files = getRequiredFiles(entry);
  const outRoot = path.join(MODELS_ROOT, entry.id);
  if (hasAllFiles(outRoot, files)) {
    console.log(`[bundle-whisper-model] ${entry.id} already staged`);
    return;
  }

  const source = ['veenna-dev', 'veenna']
    .map((app) => path.join(os.homedir(), 'Library/Application Support', app, 'models', entry.id))
    .find((dir) => hasAllFiles(dir, files));
  if (source) {
    console.log(`[bundle-whisper-model] copying ${entry.id} from ${source}`);
    for (const rel of files) copyFile(path.join(source, rel), path.join(outRoot, rel));
  } else {
    for (const rel of files) {
      console.log(`[bundle-whisper-model] downloading ${entry.id} ${rel}`);
      await downloadFile(`${entry.huggingFaceUrl}/resolve/main/${rel}`, path.join(outRoot, rel));
    }
  }

  if (!hasAllFiles(outRoot, files)) {
    throw new Error(`bundled model incomplete at ${outRoot}`);
  }
  console.log(`[bundle-whisper-model] ok -> ${outRoot}`);
}

async function main() {
  const bundled = CATALOG.filter((entry) => entry.bundled);
  if (!bundled.length) throw new Error('no bundled model in whisper-model-catalog.json');
  for (const entry of bundled) await stage(entry);
}

main().catch((err) => {
  console.error('[bundle-whisper-model] failed', err?.message || err);
  process.exit(1);
});
