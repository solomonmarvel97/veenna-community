import { describe, expect, it } from 'vitest'
import {
  applyWallpaperBlurVariable,
  clampWallpaperBlur,
  defaultAppearance,
  WALLPAPER_ZOOM_MAX,
  WALLPAPER_ZOOM_MIN,
  clampWallpaperFocus,
  clampWallpaperZoom,
  wallpaperFramingOf,
  wallpaperImageStyle,
} from '@/lib/veennaAppearance'

describe('veennaAppearance wallpaper blur', () => {
  it('clamps blur values to 0–40px', () => {
    expect(clampWallpaperBlur(-5)).toBe(0)
    expect(clampWallpaperBlur(12.6)).toBe(13)
    expect(clampWallpaperBlur(999)).toBe(40)
    expect(clampWallpaperBlur('bad')).toBe(0)
  })

  it('defaults wallpaper blur to 0', () => {
    expect(defaultAppearance().wallpaperBlur).toBe(0)
  })

  it('writes CSS variables for wallpaper blur', () => {
    applyWallpaperBlurVariable(16)
    expect(document.documentElement.style.getPropertyValue('--veenna-wallpaper-blur')).toBe('16px')
    expect(document.documentElement.style.getPropertyValue('--veenna-wallpaper-blur-scale')).toBe(
      '1.16',
    )
  })
})

describe('wallpaper framing', () => {
  it('starts centred and not zoomed, and keeps saved values in range', () => {
    expect(wallpaperFramingOf(defaultAppearance())).toEqual({ x: 50, y: 50, zoom: 1 })
    expect(
      wallpaperFramingOf({ wallpaperFocusX: -20, wallpaperFocusY: 140, wallpaperZoom: 9 }),
    ).toEqual({
      x: 0,
      y: 100,
      zoom: WALLPAPER_ZOOM_MAX,
    })
    expect(clampWallpaperFocus('nope')).toBe(50)
    expect(clampWallpaperZoom(0.2)).toBe(WALLPAPER_ZOOM_MIN)
  })

  it('keeps the focus point in view and zooms around it', () => {
    expect(wallpaperImageStyle({ x: 20, y: 70, zoom: 1.5 })).toEqual({
      objectPosition: '20% 70%',
      transformOrigin: '20% 70%',
      transform: 'scale(1.5)',
    })
    expect(wallpaperImageStyle({ x: 50, y: 50, zoom: 1 }).transform).toBe('none')
  })
})
