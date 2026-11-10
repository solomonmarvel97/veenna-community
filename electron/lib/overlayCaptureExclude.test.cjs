'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const { applyOverlayCaptureExclusion } = require('./overlayCaptureExclude.cjs');

test('applyOverlayCaptureExclusion never calls execFileSync', () => {
  const originalSync = childProcess.execFileSync;
  let syncCalls = 0;
  childProcess.execFileSync = () => {
    syncCalls += 1;
    return Buffer.from('');
  };

  applyOverlayCaptureExclusion(
    {
      isDestroyed: () => false,
      setContentProtection() {},
      getBounds: () => ({ x: 0, y: 0, width: 40, height: 40 }),
      webContents: { getMediaSourceId: () => '' },
    },
    true,
  );

  assert.equal(syncCalls, 0);
  childProcess.execFileSync = originalSync;
});
