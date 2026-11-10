import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { usePermissionRecheck } from './usePermissionRecheck'

function harness(refresh: () => void, settled: () => boolean) {
  let api: ReturnType<typeof usePermissionRecheck> | null = null
  const wrapper = mount(
    defineComponent({
      setup() {
        api = usePermissionRecheck(refresh, settled)
        return () => h('div')
      },
    }),
  )
  return { wrapper, api: api! }
}

describe('usePermissionRecheck', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps reading until the grant shows up, then stops', async () => {
    let granted = false
    const refresh = vi.fn()
    const { api } = harness(refresh, () => granted)

    api.watch()
    await vi.advanceTimersByTimeAsync(1500)
    await vi.advanceTimersByTimeAsync(1500)
    expect(refresh).toHaveBeenCalledTimes(2)

    granted = true
    await vi.advanceTimersByTimeAsync(1500)
    await vi.advanceTimersByTimeAsync(6000)
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('reads again when the window comes back to the front', () => {
    const refresh = vi.fn()
    harness(refresh, () => false)
    window.dispatchEvent(new Event('focus'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops polling when the page goes away', async () => {
    const refresh = vi.fn()
    const { wrapper, api } = harness(refresh, () => false)
    api.watch()
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(6000)
    expect(refresh).not.toHaveBeenCalled()
  })
})
