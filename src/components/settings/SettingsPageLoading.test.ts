import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsPageLoading from './SettingsPageLoading.vue'

describe('SettingsPageLoading', () => {
  it('draws the settings skeleton as a busy page, not an overlay', () => {
    const wrapper = mount(SettingsPageLoading)
    const root = wrapper.find('[aria-label="Loading settings"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-busy')).toBe('true')
    expect(root.attributes('aria-modal')).toBeUndefined()
    wrapper.unmount()
  })
})
