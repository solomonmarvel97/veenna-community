/**
 * Colored timing logs for Format-ON dictation (Electron DevTools / terminal).
 */
import chalk from 'chalk'

try {
  // Force ANSI in Electron/Vite so timings stay readable.
  ;(chalk as { level?: number }).level = 3
} catch {
  /* ignore */
}

export type DictationTimer = {
  mark: (event: string, detail?: string) => number
  end: (event?: string, detail?: string) => number
  elapsed: () => number
}

function fmtMs(ms: number): string {
  return chalk.yellow.bold(`${Math.round(ms)}ms`)
}

function preview(text: string, max = 72): string {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return chalk.dim('(empty)')
  return chalk.white(s.length > max ? `${s.slice(0, max)}…` : s)
}

export function startDictationTimer(label = 'format-on'): DictationTimer {
  const t0 = performance.now()
  let last = t0
  console.log('')
  console.log(
    chalk.bgHex('#1B3A4B').white.bold(' VEENNA DICTATION '),
    chalk.cyanBright.bold(label),
    chalk.dim(new Date().toISOString()),
  )

  return {
    mark(event: string, detail?: string) {
      const now = performance.now()
      const step = now - last
      const total = now - t0
      last = now
      console.log(
        chalk.cyan('  ▶'),
        chalk.white.bold(event),
        chalk.dim('step'),
        fmtMs(step),
        chalk.dim('total'),
        fmtMs(total),
        detail ? chalk.dim(detail) : '',
      )
      return step
    },
    end(event = 'done', detail?: string) {
      const now = performance.now()
      const step = now - last
      const total = now - t0
      last = now
      console.log(
        chalk.green('  ✔'),
        chalk.greenBright.bold(event),
        chalk.dim('step'),
        fmtMs(step),
        chalk.dim('total'),
        fmtMs(total),
        detail ? chalk.dim(detail) : '',
      )
      console.log('')
      return total
    },
    elapsed() {
      return performance.now() - t0
    },
  }
}

export function startPasteDictationTimer(): DictationTimer {
  const timer = startDictationTimer('paste')
  console.log('[paste-timing] started')
  return {
    mark(event: string, detail?: string) {
      const step = timer.mark(event, detail)
      console.log('[paste-timing]', event, { stepMs: Math.round(step), detail: detail ?? null })
      return step
    },
    end(event = 'done', detail?: string) {
      const total = timer.end(event, detail)
      console.log('[paste-timing] complete', event, {
        totalMs: Math.round(total),
        detail: detail ?? null,
      })
      return total
    },
    elapsed() {
      return timer.elapsed()
    },
  }
}

export function timingPreview(text: string, max = 72): string {
  return preview(text, max)
}
