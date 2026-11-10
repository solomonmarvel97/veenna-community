'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { findWhisperCppBinary } = require('./whisperCppStt.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'veenna-whisper-test-'));
}

function touch(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '');
}

test('finds the helper shipped inside the app before the development copy', () => {
  const resourcesPath = tempDir();
  const devBundleRoot = tempDir();
  touch(path.join(resourcesPath, 'whisper', 'bin', 'veenna-whisper'));
  touch(path.join(devBundleRoot, 'mac-arm64', 'bin', 'veenna-whisper'));

  assert.equal(
    findWhisperCppBinary({ platform: 'darwin', arch: 'arm64', resourcesPath, devBundleRoot }),
    path.join(resourcesPath, 'whisper', 'bin', 'veenna-whisper'),
  );
});

test('falls back to the development copy for this os and arch', () => {
  const devBundleRoot = tempDir();
  touch(path.join(devBundleRoot, 'win-x64', 'bin', 'veenna-whisper.exe'));

  assert.equal(
    findWhisperCppBinary({ platform: 'win32', arch: 'x64', resourcesPath: tempDir(), devBundleRoot }),
    path.join(devBundleRoot, 'win-x64', 'bin', 'veenna-whisper.exe'),
  );
  assert.equal(
    findWhisperCppBinary({ platform: 'win32', arch: 'arm64', resourcesPath: tempDir(), devBundleRoot }),
    null,
  );
});
