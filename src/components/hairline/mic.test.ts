import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mic } from './mic'

function setReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

function tabHeight(element: HTMLElement, index: number): number {
  const creases = element.querySelectorAll('svg > g:not(:first-of-type) path.nf')
  return creases[index].getAttribute('d')?.length ?? 0
}

function pointer(element: HTMLElement, type: string, clientX: number) {
  const event = new MouseEvent(type, { clientX })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  element.dispatchEvent(event)
}

describe('mic', () => {
  let element: HTMLElement

  beforeEach(() => {
    element = document.createElement('div')
    document.body.append(element)
    setReducedMotion(false)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now())
      return 0
    })
  })

  afterEach(() => {
    element.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('draws an image with the default label and reads rest once at mount', () => {
    const onRead = vi.fn()
    mic(element, { onRead })

    expect(element.getAttribute('role')).toBe('img')
    expect(element.getAttribute('aria-label')).toBe('A microphone waiting, with a flat waveform')
    expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 400 320')
    expect(element.querySelector('text')).toBeNull()
    expect(onRead.mock.calls).toEqual([['rest']])
  })

  it('rests with every tab flat', () => {
    mic(element)
    for (let index = 0; index < 7; index += 1) expect(tabHeight(element, index)).toBe(0)
  })

  it('resets a key set to undefined and keeps a key left out', () => {
    const figure = mic(element, { label: 'Waiting', theme: 'dark' })

    figure.update({ label: undefined })
    expect(element.getAttribute('aria-label')).toBe('A microphone waiting, with a flat waveform')
    expect(element.getAttribute('data-hairline-theme')).toBe('dark')

    figure.update({ theme: undefined })
    expect(element.hasAttribute('data-hairline-theme')).toBe(false)
  })

  it('still answers the pointer under reduced motion, then settles flat at once', () => {
    setReducedMotion(true)
    const onRead = vi.fn()
    const rect = { left: 0, top: 0, width: 400, height: 320 } as DOMRect
    mic(element, { onRead, play: true })
    vi.spyOn(element.querySelector('svg') as SVGElement, 'getBoundingClientRect').mockReturnValue(
      rect,
    )

    pointer(element, 'pointermove', 200)
    expect(onRead).toHaveBeenLastCalledWith('listening')
    expect(tabHeight(element, 3)).toBeGreaterThan(0)

    pointer(element, 'pointerleave', 200)
    expect(onRead).toHaveBeenLastCalledWith('rest')
    expect(tabHeight(element, 3)).toBe(0)
  })

  it('plays from a fresh mount, loops, and stops when the pointer arrives', () => {
    vi.restoreAllMocks()
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'performance'],
    })
    try {
      const onRead = vi.fn()
      mic(element, { onRead, play: true })
      expect(onRead.mock.calls).toEqual([['rest']])

      vi.advanceTimersByTime(2200)
      expect(onRead).toHaveBeenLastCalledWith('hello')
      expect([0, 1, 2, 3, 4, 5, 6].some((index) => tabHeight(element, index) > 0)).toBe(true)

      vi.advanceTimersByTime(3500)
      expect(onRead).toHaveBeenLastCalledWith('rest')
      expect([0, 1, 2, 3, 4, 5, 6].every((index) => tabHeight(element, index) === 0)).toBe(true)

      vi.advanceTimersByTime(3000)
      expect(onRead).toHaveBeenLastCalledWith('hello')

      pointer(element, 'pointermove', 200)
      vi.advanceTimersByTime(20)
      expect(onRead).toHaveBeenLastCalledWith('listening')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reaches more tabs at higher intensity', () => {
    setReducedMotion(true)
    const risen = (intensity: number) => {
      const host = document.createElement('div')
      document.body.append(host)
      mic(host, { intensity })
      vi.spyOn(host.querySelector('svg') as SVGElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 400,
        height: 320,
      } as DOMRect)
      pointer(host, 'pointermove', 200)
      const count = [0, 1, 2, 3, 4, 5, 6].filter((index) => tabHeight(host, index) > 0).length
      host.remove()
      return count
    }

    expect(risen(1)).toBeGreaterThan(risen(0))
  })

  it('removes its drawing and attributes on destroy', () => {
    const figure = mic(element, { theme: 'light' })
    figure.destroy()

    expect(element.children).toHaveLength(0)
    expect(element.hasAttribute('role')).toBe(false)
    expect(element.hasAttribute('aria-label')).toBe(false)
    expect(element.hasAttribute('data-hairline-theme')).toBe(false)
  })
})
