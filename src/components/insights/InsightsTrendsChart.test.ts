import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InsightsTrendsChart from '@/components/insights/InsightsTrendsChart.vue'

const WEEK = [
  { date: '2026-08-31', words: 0, captures: 0 },
  { date: '2026-09-01', words: 0, captures: 0 },
  { date: '2026-09-02', words: 0, captures: 0 },
  { date: '2026-09-03', words: 0, captures: 0 },
  { date: '2026-09-04', words: 0, captures: 0 },
  { date: '2026-09-05', words: 400, captures: 2 },
  { date: '2026-09-06', words: 326, captures: 1 },
]

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('InsightsTrendsChart', () => {
  it('renders axis labels and a bar for each day when there is data', () => {
    const w = mount(InsightsTrendsChart, { props: { series: WEEK } })
    expect(w.text()).toContain('Words over time')
    expect(w.text()).toContain('Last 7 days')
    expect(w.text()).toContain('Aug 31')
    expect(w.findAll('[data-testid="words-bar"]')).toHaveLength(7)
    expect(w.find('svg[role="img"] path').exists()).toBe(false)
    expect(w.findAll('svg[role="img"] line').length).toBeGreaterThan(1)
  })

  it('shows an empty prompt when every day is zero', () => {
    const w = mount(InsightsTrendsChart, {
      props: { series: WEEK.map((row) => ({ ...row, words: 0, captures: 0 })) },
    })
    expect(w.text()).toContain('Dictate for a few days to see your trend.')
    expect(w.find('svg[role="img"]').exists()).toBe(false)
  })

  it('opens a tooltip for the hovered day', async () => {
    const w = mount(InsightsTrendsChart, { props: { series: WEEK }, attachTo: document.body })
    const columns = w.findAll('button[aria-label]')
    await columns[5].trigger('mouseenter')
    expect(w.find('[role="tooltip"]').text()).toContain('Words')
    expect(w.find('[role="tooltip"]').text()).toContain('400')
  })
})
