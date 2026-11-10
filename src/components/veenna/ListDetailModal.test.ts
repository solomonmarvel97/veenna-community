import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import ListDetailModal from '@/components/veenna/ListDetailModal.vue'
import type { ListDetailField } from '@/components/veenna/ListDetailModal.vue'

// The panel teleports to body, so assertions read the document, not the wrapper.
function mountModal(fields: ListDetailField[]) {
  return mount(ListDetailModal, {
    props: { open: true, title: '10:48 am', fields },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ListDetailModal value links', () => {
  it('renders a plain value when the field has no action', () => {
    const wrapper = mountModal([{ label: 'Source', value: 'Meeting' }])
    const dd = document.body.querySelector('dd')
    expect(dd?.textContent?.trim()).toBe('Meeting')
    expect(document.body.querySelector('dd button')).toBeNull()
    wrapper.unmount()
  })

  it('renders a clickable link and runs the action', async () => {
    const onValueClick = vi.fn()
    const wrapper = mountModal([
      { label: 'Source', value: 'Meeting' },
      { label: 'Linked note', value: 'Open note', onValueClick },
    ])

    const link = document.body.querySelector('dd button') as HTMLButtonElement | null
    expect(link?.textContent?.trim()).toBe('Open note')

    link?.click()
    expect(onValueClick).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
