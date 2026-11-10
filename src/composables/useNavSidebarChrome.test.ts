import { beforeEach, describe, expect, it } from 'vitest'
import {
  NAV_SIDEBAR_COLLAPSED_WIDTH,
  NAV_SIDEBAR_DEFAULT_WIDTH,
  NAV_SIDEBAR_MAX_WIDTH,
  NAV_SIDEBAR_MIN_WIDTH,
  resetNavSidebarChromeForTests,
  useNavSidebarChrome,
} from '@/composables/useNavSidebarChrome'

beforeEach(() => {
  localStorage.clear()
  resetNavSidebarChromeForTests()
})

describe('useNavSidebarChrome', () => {
  it('opens expanded at the default width', () => {
    const nav = useNavSidebarChrome()
    expect(nav.collapsed.value).toBe(false)
    expect(nav.width.value).toBe(NAV_SIDEBAR_DEFAULT_WIDTH)
  })

  it('clamps a stored width to the min and max', () => {
    localStorage.setItem('veenna.nav.width', '80')
    expect(useNavSidebarChrome().width.value).toBe(NAV_SIDEBAR_MIN_WIDTH)

    resetNavSidebarChromeForTests()
    localStorage.setItem('veenna.nav.width', '980')
    expect(useNavSidebarChrome().width.value).toBe(NAV_SIDEBAR_MAX_WIDTH)
  })

  it('stays docked at the current width on a desktop viewport', () => {
    const nav = useNavSidebarChrome()
    expect(nav.docked.value).toBe(true)
    expect(nav.overlayInset.value).toBe(NAV_SIDEBAR_DEFAULT_WIDTH)
  })

  it('opens expanded again after being collapsed', () => {
    useNavSidebarChrome().setCollapsed(true)

    resetNavSidebarChromeForTests()
    expect(useNavSidebarChrome().collapsed.value).toBe(false)
  })

  it('reports an overlay inset that matches the visible nav, not a 16rem guess', () => {
    const nav = useNavSidebarChrome()
    nav.setCollapsed(false)
    expect(nav.overlayInset.value).toBe(NAV_SIDEBAR_DEFAULT_WIDTH)
    nav.width.value = NAV_SIDEBAR_MIN_WIDTH
    expect(nav.overlayInset.value).toBe(NAV_SIDEBAR_MIN_WIDTH)
    nav.setCollapsed(true)
    expect(nav.overlayInset.value).toBe(NAV_SIDEBAR_COLLAPSED_WIDTH)
  })

  it('uses the icon-rail width while collapsed without forgetting the last width', () => {
    const nav = useNavSidebarChrome()
    nav.width.value = 320
    nav.setCollapsed(true)
    expect(nav.widthStyle.value).toEqual({ width: `${NAV_SIDEBAR_COLLAPSED_WIDTH}px` })
    expect(nav.width.value).toBe(320)
  })

  it('keeps the last width when collapsing so expand can restore it', () => {
    const nav = useNavSidebarChrome()
    nav.width.value = 320
    nav.setCollapsed(false)
    nav.toggleCollapsed()
    expect(nav.collapsed.value).toBe(true)
    expect(nav.width.value).toBe(320)
    nav.toggleCollapsed()
    expect(nav.collapsed.value).toBe(false)
    expect(nav.width.value).toBe(320)
  })
})
