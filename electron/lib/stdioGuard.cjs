'use strict';

// The main process's stdout/stderr are pipes to whoever launched Electron
// (concurrently in electron:dev, a terminal, launchd). Once that reader goes
// away, the next console.* call fails with EPIPE, delivered as an 'error' event
// on the stream. With no listener, Electron surfaces it as a fatal "JavaScript
// error occurred in the main process" dialog. Logging is best-effort: losing
// the reader must never take the app down, and there is nowhere left to report
// a failed log write, so every stdio stream error is swallowed.

const guarded = new WeakSet();

function ignoreStreamError() {}

function guardStream(stream) {
  if (!stream || typeof stream.on !== 'function' || guarded.has(stream)) return;
  guarded.add(stream);
  stream.on('error', ignoreStreamError);
}

function guardStdio(proc = process) {
  guardStream(proc.stdout);
  guardStream(proc.stderr);
}

module.exports = { guardStdio, guardStream };
