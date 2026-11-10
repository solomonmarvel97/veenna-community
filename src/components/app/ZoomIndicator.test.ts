import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const bridge = vi.hoisted(() => ({ handler: null as ((factor: number) => void) | null }))
vi.mock('@/lib/platform/isElectron', () => ({
  getVeennaElectron: () => ({
    onZoomChanged: (handler: (factor: number) => void) => {
      bridge.handler = handler
      return () => {
        bridge.handler = null
      }
    },
  }),
}))

import ZoomIndicator from './ZoomIndicator.vue'

afterEach(() => {
  vi.useRealTimers()
})

describe('ZoomIndicator', () => {
  it('shows the zoom as a percentage, then fades away', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ZoomIndicator, { global: { stubs: { transition: false } } })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)

    bridge.handler!(1.1)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('110%')

    vi.advanceTimersByTime(1600)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)

    wrapper.unmount()
    expect(bridge.handler).toBeNull()
  })
})
