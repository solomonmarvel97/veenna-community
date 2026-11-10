import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DictationDetailModal, { type DictationDetailActions } from './DictationDetailModal.vue'

const NO_ACTIONS: DictationDetailActions = {
  canPlay: false,
  playing: false,
  playLoading: false,
  audioPendingLabel: null,
  canRetry: false,
}

const CAPTURE = {
  id: 'cap-1',
  text: 'so um this is the spoken version',
  createdAt: '2026-11-03T09:51:00.000Z',
  wordCount: 6,
  durationMs: 71_000,
  source: 'dictation',
  originChannel: 'desktop',
}

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(DictationDetailModal, {
    attachTo: document.body,
    props: {
      open: true,
      capture: CAPTURE as never,
      title: '9:51 am',
      copied: false,
      busy: false,
      actions: NO_ACTIONS,
      ...overrides,
    },
  })
}

const body = () => document.body.textContent ?? ''
const button = (label: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)

const menuItem = (label: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (el) => el.textContent?.trim() === label,
  )

async function openMoreActions() {
  const trigger = document.body.querySelector<HTMLElement>('[aria-label="More actions"]')!
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await flushPromises()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DictationDetailModal', () => {
  it('puts the text first and the facts under it in one line', () => {
    mountModal()
    expect(body()).toContain('so um this is the spoken version')
    expect(body()).toContain('Duration')
    expect(body()).toContain('1m 11s')
    expect(body()).toContain('Recorded on')
  })

  it('copies the text on show', () => {
    const w = mountModal()
    button('Copy')!.click()
    expect(w.emitted('copy')?.[0]).toEqual(['so um this is the spoken version'])
  })

  it('keeps only Copy in the header and puts the other actions in the menu', async () => {
    const w = mountModal({ actions: { ...NO_ACTIONS, canPlay: true } })
    expect(button('Copy')).toBeDefined()
    expect(button('Play')).toBeUndefined()
    await openMoreActions()
    expect(menuItem('Play')).toBeDefined()
    menuItem('Play')!.click()
    await flushPromises()
    expect(w.emitted('play')).toHaveLength(1)
  })

  it('sits the Copy button in the header, before the close button', () => {
    mountModal()
    const header = document.body.querySelector('header')!
    const labels = Array.from(header.querySelectorAll('button')).map(
      (b) => b.getAttribute('aria-label') || b.textContent?.trim(),
    )
    expect(labels.at(-1)).toBe('Close')
    expect(labels.indexOf('Copy')).toBeGreaterThanOrEqual(0)
    expect(labels.indexOf('Copy')).toBeLessThan(labels.indexOf('Close'))
  })

  it('says Copied after a copy', () => {
    mountModal({ copied: true })
    expect(button('Copied')).toBeDefined()
  })
})
