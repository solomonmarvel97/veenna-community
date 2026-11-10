'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { downloadFileToPath } = require('./downloadFile.cjs');
const { getRequiredFilesForModel, catalogEntry } = require('./speechModelFiles.cjs');
const { findWhisperCppBinary } = require('./whisperCppStt.cjs');

const CATALOG = require('../../src/lib/voice/whisper-model-catalog.json');

const ALLOWED_IDS = new Set(CATALOG.map((entry) => entry.id));

/** @type {Map<string, { abort: AbortController }>} */
const activeDownloads = new Map();

function getBundledModelsRoot() {
  const packaged = path.join(process.resourcesPath, 'models');
  const dev = path.join(__dirname, '../../resources/models');
  if (app.isPackaged && fs.existsSync(packaged)) return packaged;
  if (fs.existsSync(dev)) return dev;
  return null;
}

function getUserModelsRoot() {
  return path.join(app.getPath('userData'), 'models');
}

function modelDir(root, modelId) {
  return path.join(root, ...modelId.split('/'));
}

function isPathInsideRoot(root, filePath) {
  const normalizedRoot = path.resolve(root);
  const normalizedFile = path.resolve(filePath);
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(normalizedRoot + path.sep);
}

function hasAllFiles(dir, requiredFiles) {
  return requiredFiles.every((rel) => {
    const filePath = path.join(dir, rel);
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  });
}

function isAllowedModelId(modelId) {
  return typeof modelId === 'string' && ALLOWED_IDS.has(modelId);
}

function resolveInstalledModelRoot(modelId) {
  if (!isAllowedModelId(modelId)) return null;
  const requiredFiles = getRequiredFilesForModel(CATALOG, modelId);
  const userDir = modelDir(getUserModelsRoot(), modelId);
  if (hasAllFiles(userDir, requiredFiles)) return { root: userDir, source: 'user' };
  const bundledRoot = getBundledModelsRoot();
  if (bundledRoot) {
    const bundledDir = modelDir(bundledRoot, modelId);
    if (hasAllFiles(bundledDir, requiredFiles)) return { root: bundledDir, source: 'bundled' };
  }
  return null;
}

function dirSizeBytes(dir, requiredFiles) {
  let total = 0;
  for (const rel of requiredFiles) {
    const filePath = path.join(dir, rel);
    if (fs.existsSync(filePath)) total += fs.statSync(filePath).size;
  }
  return total;
}

/** A whisper-cpp model only runs where veenna-whisper was built for this system. */
function canRunHere(entry) {
  return entry.runtime !== 'whisper-cpp' || Boolean(findWhisperCppBinary());
}

function listWhisperModelStatus() {
  return CATALOG.map((entry) => {
    const runnable = entry.localAvailable !== false && canRunHere(entry);
    const installed = runnable ? resolveInstalledModelRoot(entry.id) : null;
    const requiredFiles = getRequiredFilesForModel(CATALOG, entry.id);
    return {
      id: entry.id,
      label: entry.label,
      provider: entry.provider,
      family: entry.family,
      tier: entry.tier,
      sizeLabel: entry.sizeLabel,
      description: entry.description,
      bundled: Boolean(entry.bundled),
      huggingFaceUrl: entry.huggingFaceUrl,
      localAvailable: runnable,
      tags: entry.tags || [],
      installed: Boolean(installed),
      source: installed?.source ?? null,
      bytesOnDisk: installed ? dirSizeBytes(installed.root, requiredFiles) : 0,
      downloading: activeDownloads.has(entry.id),
    };
  });
}

function isCompleteModelFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function downloadWhisperModel(modelId, { onProgress } = {}) {
  if (!isAllowedModelId(modelId)) {
    throw new Error('unknown_model');
  }
  if (activeDownloads.has(modelId)) {
    throw new Error('download_in_progress');
  }

  const entry = catalogEntry(CATALOG, modelId);
  if (entry?.localAvailable === false || (entry && !canRunHere(entry))) {
    throw new Error('model_not_available');
  }
  if (entry?.bundled && resolveInstalledModelRoot(modelId)) {
    return { ok: true, alreadyInstalled: true };
  }

  const requiredFiles = getRequiredFilesForModel(CATALOG, modelId);
  const abort = new AbortController();
  activeDownloads.set(modelId, { abort });

  const outRoot = modelDir(getUserModelsRoot(), modelId);
  const base = `${entry?.huggingFaceUrl || `https://huggingface.co/${modelId}`}/resolve/main`;
  const fileCount = requiredFiles.length;

  try {
    for (let i = 0; i < requiredFiles.length; i += 1) {
      const rel = requiredFiles[i];
      const dest = path.join(outRoot, rel);
      onProgress?.({
        modelId,
        phase: 'downloading',
        file: rel,
        fileIndex: i + 1,
        fileCount,
        percent: Math.round((i / fileCount) * 100),
      });
      if (isCompleteModelFile(dest)) {
        onProgress?.({
          modelId,
          phase: 'downloading',
          file: rel,
          fileIndex: i + 1,
          fileCount,
          percent: Math.min(99, Math.round(((i + 1) / fileCount) * 100)),
        });
        continue;
      }
      const url = `${base}/${rel}?download=true`;
      await downloadFileToPath(url, dest, {
        signal: abort.signal,
        progressIntervalMs: 250,
        onProgress: ({ received, total }) => {
          const filePercent = total > 0 ? received / total : 0;
          const overall = Math.round(((i + filePercent) / fileCount) * 100);
          onProgress?.({
            modelId,
            phase: 'downloading',
            file: rel,
            fileIndex: i + 1,
            fileCount,
            bytesReceived: received,
            bytesTotal: total,
            percent: Math.min(99, overall),
          });
        },
      });
    }

    if (!hasAllFiles(outRoot, requiredFiles)) {
      throw new Error('download_incomplete');
    }

    onProgress?.({
      modelId,
      phase: 'done',
      file: null,
      fileIndex: fileCount,
      fileCount,
      percent: 100,
    });
    return { ok: true };
  } catch (err) {
    if (abort.signal.aborted) {
      throw new Error('download_cancelled');
    }
    throw err;
  } finally {
    activeDownloads.delete(modelId);
  }
}

function cancelWhisperModelDownload(modelId) {
  const active = activeDownloads.get(modelId);
  if (!active) return { ok: false, reason: 'not_downloading' };
  active.abort.abort();
  return { ok: true };
}

function deleteWhisperModel(modelId) {
  if (!isAllowedModelId(modelId)) return { ok: false, reason: 'unknown_model' };
  if (activeDownloads.has(modelId)) {
    cancelWhisperModelDownload(modelId);
  }
  const userDir = modelDir(getUserModelsRoot(), modelId);
  if (!isPathInsideRoot(getUserModelsRoot(), userDir)) {
    return { ok: false, reason: 'invalid_path' };
  }
  if (!fs.existsSync(userDir)) return { ok: true, removed: false };
  fs.rmSync(userDir, { recursive: true, force: true });
  return { ok: true, removed: true };
}

function resolveModelFile(relativePath) {
  const decoded = decodeURIComponent(relativePath);
  if (decoded.includes('..')) return null;
  const parts = decoded.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const modelId = `${parts[0]}/${parts[1]}`;
  if (!isAllowedModelId(modelId)) return null;
  const rest = parts.slice(2).join('/');
  if (!rest) return null;

  const installed = resolveInstalledModelRoot(modelId);
  if (!installed) return null;
  const filePath = path.normalize(path.join(installed.root, rest));
  if (!isPathInsideRoot(installed.root, filePath)) return null;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return filePath;
}

module.exports = {
  CATALOG,
  getBundledModelsRoot,
  getUserModelsRoot,
  isAllowedModelId,
  resolveInstalledModelRoot,
  listWhisperModelStatus,
  downloadWhisperModel,
  cancelWhisperModelDownload,
  deleteWhisperModel,
  resolveModelFile,
};
