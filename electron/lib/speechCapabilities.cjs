'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { app } = require('electron');
const { findWhisperCppBinary } = require('./whisperCppStt.cjs');

/** @typedef {'onnx-transformers-js' | 'whisper-cpp' | 'nemo' | 'pytorch-hf' | 'mlx-gguf'} SpeechRuntimeId */

/**
 * @typedef {Object} RuntimeCapability
 * @property {boolean} supportedOnPlatform
 * @property {boolean} ready
 * @property {string | null} blockReason
 * @property {string[]} setupSteps
 */

function safeExecFile(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

function hasCommand(command) {
  if (process.platform === 'win32') {
    return Boolean(safeExecFile('where', [command]));
  }
  return Boolean(safeExecFile('which', [command]));
}

function getFreeDiskMbForPath(targetPath) {
  try {
    if (process.platform === 'win32') {
      const drive = path.parse(targetPath).root || 'C:\\';
      const output = safeExecFile('wmic', [
        'logicaldisk',
        'where',
        `DeviceID='${drive.replace(/\\$/, '')}'`,
        'get',
        'FreeSpace',
        '/value',
      ]);
      const match = output?.match(/FreeSpace=(\d+)/);
      if (match) return Math.round(Number(match[1]) / 1024 / 1024);
      return null;
    }

    const output = safeExecFile('df', ['-k', targetPath]);
    if (!output) return null;
    const lines = output.split('\n').filter(Boolean);
    if (lines.length < 2) return null;
    const parts = lines[lines.length - 1].split(/\s+/);
    const freeKb = Number(parts[3]);
    if (!Number.isFinite(freeKb)) return null;
    return Math.round(freeKb / 1024);
  } catch {
    return null;
  }
}

function getOsVersionLabel() {
  const release = os.release();
  if (process.platform === 'darwin') {
    return `macOS ${release}`;
  }
  if (process.platform === 'win32') {
    return `Windows ${release}`;
  }
  if (process.platform === 'linux') {
    const pretty = safeExecFile('sh', ['-lc', '. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"']);
    return pretty || `Linux ${release}`;
  }
  return `${process.platform} ${release}`;
}

function getPythonVersion() {
  for (const cmd of ['python3', 'python']) {
    const version = safeExecFile(cmd, ['--version']);
    if (version) return version.replace(/^Python\s+/i, '');
  }
  return null;
}

/**
 * @param {Object} ctx
 * @returns {Record<SpeechRuntimeId, RuntimeCapability>}
 */
function buildRuntimeCapabilities(ctx) {
  const { platform, arch, totalMemMb, pythonVersion } = ctx;
  const isAppleSilicon = platform === 'darwin' && arch === 'arm64';
  const is64Bit = arch === 'arm64' || arch === 'x64';

  /** @type {Record<SpeechRuntimeId, RuntimeCapability>} */
  const runtimes = {
    'onnx-transformers-js': {
      supportedOnPlatform: is64Bit,
      ready: is64Bit,
      blockReason: is64Bit ? null : 'unsupported_architecture',
      setupSteps: is64Bit
        ? ['Bundled with veenna - no extra install needed.']
        : ['Requires a 64-bit Mac, Windows, or Linux system.'],
    },
    'whisper-cpp': (() => {
      const bundled = Boolean(findWhisperCppBinary());
      return {
        supportedOnPlatform: is64Bit,
        ready: bundled,
        blockReason: bundled ? null : 'runtime_not_bundled',
        setupSteps: bundled
          ? ['Bundled with veenna - runs on the GPU, no extra install needed.']
          : ['The whisper.cpp helper was not built for this system; use an ONNX model.'],
      };
    })(),
    nemo: {
      supportedOnPlatform: platform === 'darwin' || platform === 'linux',
      ready: false,
      blockReason: 'runtime_not_bundled',
      setupSteps: [
        'Install Python 3.10+ and NVIDIA NeMo ASR.',
        'Requires ~8 GB+ RAM and a supported GPU for practical speeds.',
        'NeMo local inference in veenna is not bundled yet.',
      ],
    },
    'pytorch-hf': {
      supportedOnPlatform: is64Bit,
      ready: false,
      blockReason: 'runtime_not_bundled',
      setupSteps: [
        'Requires PyTorch + Hugging Face Transformers.',
        pythonVersion
          ? `Python detected (${pythonVersion}) - PyTorch stack not bundled in veenna yet.`
          : 'Install Python 3.10+, then PyTorch and transformers.',
        'On-device PyTorch ASR in veenna is planned; use ONNX models today.',
      ],
    },
    'mlx-gguf': {
      supportedOnPlatform: isAppleSilicon,
      ready: false,
      blockReason: isAppleSilicon ? 'runtime_not_bundled' : 'unsupported_platform',
      setupSteps: isAppleSilicon
        ? [
            'Requires Apple Silicon (M-series) with macOS.',
            'Install MLX and model weights (GGUF/MLX format).',
            'MLX streaming ASR in veenna is not bundled yet.',
          ]
        : ['MLX models require an Apple Silicon Mac (M1/M2/M3/M4).'],
    },
  };

  if (platform === 'win32') {
    runtimes.nemo.supportedOnPlatform = false;
    runtimes.nemo.blockReason = 'unsupported_platform';
    runtimes.nemo.setupSteps = [
      'NVIDIA NeMo local ASR is not supported on Windows in veenna yet.',
      'Use an ONNX · transformers.js model or cloud STT instead.',
    ];
  }

  if (totalMemMb < 8192) {
    runtimes.nemo.setupSteps.push('This machine has under 8 GB RAM - NeMo is not recommended.');
  }

  return runtimes;
}

function getSpeechCapabilities() {
  const platform = process.platform;
  const arch = process.arch;
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model?.trim() || 'Unknown CPU';
  const osVersion = getOsVersionLabel();
  const pythonVersion = getPythonVersion();
  const modelsRoot = path.join(app.getPath('userData'), 'models');
  const freeDiskMb = getFreeDiskMbForPath(modelsRoot);

  const machine = {
    platform,
    arch,
    osVersion,
    cpuModel,
    cpuCores,
    totalMemMb,
    freeMemMb,
    freeDiskMb,
    pythonVersion,
    isElectron: true,
    isPackaged: app.isPackaged,
  };

  const runtimes = buildRuntimeCapabilities({
    platform,
    arch,
    totalMemMb,
    pythonVersion,
  });

  return {
    machine,
    runtimes,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  getSpeechCapabilities,
  buildRuntimeCapabilities,
};
