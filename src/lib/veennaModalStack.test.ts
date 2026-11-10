import { afterEach, describe, expect, it } from 'vitest'
import {
  acquireVeennaModalOpen,
  isAnyVeennaModalOpen,
  isTopVeennaModal,
  nextVeennaModalId,
  setVeennaModalZIndex,
  subscribeVeennaModalOpen,
} from '@/lib/veennaModalStack'

const releases: Array<() => void> = []

afterEach(() => {
  while (releases.length) releases.pop()?.()
  document.body.classList.remove('veenna-modal-open')
})

describe('veennaModalStack', () => {
  it('keeps the body class until the last nested modal closes', () => {
    const a = nextVeennaModalId()
    const b = nextVeennaModalId()
    releases.push(acquireVeennaModalOpen(a, 110))
    expect(document.body.classList.contains('veenna-modal-open')).toBe(true)

    releases.push(acquireVeennaModalOpen(b, 140))
    releases.shift()?.()
    expect(document.body.classList.contains('veenna-modal-open')).toBe(true)

    releases.shift()?.()
    expect(document.body.classList.contains('veenna-modal-open')).toBe(false)
  })

  it('treats the highest z-index modal as top', () => {
    const profile = nextVeennaModalId()
    const crop = nextVeennaModalId()
    releases.push(acquireVeennaModalOpen(profile, 110))
    releases.push(acquireVeennaModalOpen(crop, 140))

    expect(isTopVeennaModal(crop)).toBe(true)
    expect(isTopVeennaModal(profile)).toBe(false)

    releases.pop()?.()
    expect(isTopVeennaModal(profile)).toBe(true)
  })

  it('breaks z-index ties with later registration', () => {
    const first = nextVeennaModalId()
    const second = nextVeennaModalId()
    releases.push(acquireVeennaModalOpen(first, 110))
    releases.push(acquireVeennaModalOpen(second, 110))

    expect(isTopVeennaModal(second)).toBe(true)
    expect(isTopVeennaModal(first)).toBe(false)
  })

  it('updates z-index while open', () => {
    const id = nextVeennaModalId()
    const other = nextVeennaModalId()
    releases.push(acquireVeennaModalOpen(id, 110))
    releases.push(acquireVeennaModalOpen(other, 120))
    expect(isTopVeennaModal(other)).toBe(true)

    setVeennaModalZIndex(id, 200)
    expect(isTopVeennaModal(id)).toBe(true)
  })

  it('notifies subscribers when the first modal opens and the last closes', () => {
    const seen: boolean[] = []
    const stop = subscribeVeennaModalOpen((open) => seen.push(open))
    expect(seen).toEqual([false])
    expect(isAnyVeennaModalOpen()).toBe(false)

    const id = nextVeennaModalId()
    releases.push(acquireVeennaModalOpen(id, 110))
    expect(isAnyVeennaModalOpen()).toBe(true)
    expect(seen).toEqual([false, true])

    releases.pop()?.()
    expect(isAnyVeennaModalOpen()).toBe(false)
    expect(seen).toEqual([false, true, false])
    stop()
  })
})
