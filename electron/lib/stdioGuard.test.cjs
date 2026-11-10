'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { guardStdio, guardStream } = require('./stdioGuard.cjs');

function epipe() {
  const err = new Error('write EPIPE');
  err.code = 'EPIPE';
  return err;
}

test('a guarded stream absorbs EPIPE instead of throwing', () => {
  const stream = new EventEmitter();
  assert.throws(() => stream.emit('error', epipe()));
  guardStream(stream);
  assert.doesNotThrow(() => stream.emit('error', epipe()));
});

test('guarding is idempotent', () => {
  const stream = new EventEmitter();
  guardStream(stream);
  guardStream(stream);
  assert.equal(stream.listenerCount('error'), 1);
});

test('guardStdio covers stdout and stderr and tolerates missing streams', () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  guardStdio({ stdout, stderr });
  assert.equal(stdout.listenerCount('error'), 1);
  assert.equal(stderr.listenerCount('error'), 1);
  assert.doesNotThrow(() => guardStdio({}));
});

function runLoggerWithClosedStdout({ guard }) {
  const guardPath = path.join(__dirname, 'stdioGuard.cjs');
  const script = `
    ${guard ? `require(${JSON.stringify(guardPath)}).guardStdio();` : ''}
    let n = 0;
    const timer = setInterval(() => {
      console.log('x'.repeat(4096));
      console.warn('y'.repeat(4096));
      if (++n === 40) { clearInterval(timer); process.exit(0); }
    }, 5);
  `;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    // Drop the reader side, the way a dead `concurrently` or closed terminal does.
    child.stdout.destroy();
    child.stderr.destroy();
    child.on('exit', (code) => resolve(code));
  });
}

test('logging to a closed pipe crashes without the guard', async () => {
  assert.notEqual(await runLoggerWithClosedStdout({ guard: false }), 0);
});

test('logging to a closed pipe is harmless with the guard', async () => {
  assert.equal(await runLoggerWithClosedStdout({ guard: true }), 0);
});
