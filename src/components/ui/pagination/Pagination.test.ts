import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Pagination from './Pagination.vue'

function render(props: Record<string, unknown>) {
  return mount(Pagination, {
    props: { currentPage: 1, totalItems: 149, itemsPerPage: 24, ...props },
  })
}

describe('Pagination', () => {
  it('shows the visible range on the left', () => {
    expect(render({}).text()).toContain('Showing 1-24 of 149')
    expect(render({ currentPage: 7 }).text()).toContain('Showing 145-149 of 149')
  })

  it('leaves the range out when asked', () => {
    expect(render({ showResultsText: false }).text()).not.toContain('Showing')
  })

  it('shows three page numbers, then the last page', () => {
    const wrapper = render({})
    const pages = wrapper.findAll('button[aria-label^="Page "]').map((button) => button.text())
    expect(pages).toEqual(['1', '2', '3', '7'])
    expect(wrapper.text()).toContain('…')
  })

  it('has icon-only first, previous, next and last buttons', () => {
    const wrapper = render({ currentPage: 4 })
    for (const label of ['First page', 'Previous page', 'Next page', 'Last page']) {
      expect(wrapper.find(`button[aria-label="${label}"]`).text()).toBe('')
    }
    const pages = wrapper.findAll('button[aria-label^="Page "]').map((b) => b.text())
    expect(pages).toEqual(['1', '3', '4', '5', '7'])
  })

  it('asks for a new page size, and frees the select when that load ends without it', async () => {
    const wrapper = render({ itemsPerPage: 10, totalItems: 200, loading: false })
    const vm = wrapper.vm as unknown as { onItemsPerPageChange: (value: string) => void }
    vm.onItemsPerPageChange('50')
    expect(wrapper.emitted('update:itemsPerPage')).toEqual([[50]])
    await wrapper.setProps({ loading: true })
    expect(wrapper.find('[aria-label="Loading page size"]').exists()).toBe(true)
    await wrapper.setProps({ loading: false })
    expect(wrapper.find('[aria-label="Loading page size"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Rows per page"]').attributes('disabled')).toBeUndefined()
  })

  it('keeps page 1 and disabled arrows on a single page', () => {
    const wrapper = render({ totalItems: 6, itemsPerPage: 10, alwaysShow: true })
    expect(wrapper.text()).toContain('Showing 1-6 of 6')
    expect(wrapper.find('button[aria-current="page"]').text()).toBe('1')
    expect(wrapper.find('button[aria-label="First page"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[aria-label="Last page"]').attributes('disabled')).toBeDefined()
  })
})
