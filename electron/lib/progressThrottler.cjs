'use strict';

/**
 * Wrap `send` so progress updates go out at most once per `intervalMs`.
 * The final `done` / `error` update always goes out at once; `flush()` sends any update still waiting.
 */
function createProgressThrottler(send, intervalMs = 200) {
  let last = 0;
  let pending = null;
  let timer = null;
  const emit = (payload) => {
    const force = payload?.phase === 'done' || payload?.phase === 'error';
    pending = payload;
    const now = Date.now();
    if (force || now - last >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      pending = null;
      send(payload);
      return;
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (pending) {
          last = Date.now();
          const next = pending;
          pending = null;
          send(next);
        }
      }, intervalMs - (now - last));
    }
  };
  emit.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const next = pending;
      pending = null;
      last = Date.now();
      send(next);
    }
  };
  return emit;
}

module.exports = { createProgressThrottler };
