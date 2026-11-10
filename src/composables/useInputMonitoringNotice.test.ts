import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const toast = vi.fn()
vi.mock('@/components/ui/toast/use-toast', () => ({ useToast: () => ({ toast }) }))

const electron = {
  getDictationAccessibility: vi.fn(),
  openInputMonitoringSettings: vi.fn(async () => ({ ok: true })),
}
vi.mock('@/lib/platform/isElectron', () => ({ getVeennaElectron: () => electron }))

/** A fresh module each test: the once-per-launch flag lives at module level. */
async function harness() {
  vi.resetModules()
  const { useInputMonitoringNotice } = await import('./useInputMonitoringNotice')
  return mount(
    defineComponent({
      setup() {
        useInputMonitoringNotice()
        return () => h('div')
      },
    }),
  )
}

describe('useInputMonitoringNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    toast.mockClear()
    electron.getDictationAccessibility.mockReset()
    electron.openInputMonitoringSettings.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('waits for the monitor, then warns once with a button to Input Monitoring', async () => {
    electron.getDictationAccessibility
      .mockResolvedValueOnce({
        required: true,
        trusted: true,
        monitorReady: false,
        inputMonitoring: false,
      })
      .mockResolvedValue({
        required: true,
        trusted: true,
        monitorReady: true,
        inputMonitoring: false,
      })
    await harness()
    await vi.advanceTimersByTimeAsync(0)
    expect(toast).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)
    expect(toast).toHaveBeenCalledTimes(1)
    const shown = toast.mock.calls[0][0]
    expect(shown.description).toContain('switch veenna off and on again')
    expect(shown.actionLabel).toBe('Open Input Monitoring')
    shown.onAction()
    expect(electron.openInputMonitoringSettings).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('says nothing when the grant is there', async () => {
    electron.getDictationAccessibility.mockResolvedValue({
      required: true,
      trusted: true,
      monitorReady: true,
      inputMonitoring: true,
    })
    await harness()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(toast).not.toHaveBeenCalled()
    expect(electron.getDictationAccessibility).toHaveBeenCalledTimes(1)
  })

  it('says nothing off macOS', async () => {
    electron.getDictationAccessibility.mockResolvedValue({
      required: false,
      trusted: true,
      monitorReady: true,
      inputMonitoring: true,
    })
    await harness()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(toast).not.toHaveBeenCalled()
  })

  it('gives up if the monitor never comes up', async () => {
    electron.getDictationAccessibility.mockResolvedValue({
      required: true,
      trusted: true,
      monitorReady: false,
      inputMonitoring: false,
    })
    await harness()
    await vi.advanceTimersByTimeAsync(70_000)
    const calls = electron.getDictationAccessibility.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(electron.getDictationAccessibility.mock.calls.length).toBe(calls)
    expect(toast).not.toHaveBeenCalled()
  })
})
