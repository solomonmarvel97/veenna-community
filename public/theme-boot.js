(function () {
  var key = 'veenna-theme'
  var legacy = 'veenna-app-theme'
  if (!localStorage.getItem(key) && localStorage.getItem(legacy)) {
    localStorage.setItem(key, localStorage.getItem(legacy))
  }
  var mode = localStorage.getItem(key)
  var dark =
    mode === 'dark' ||
    (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  var resolved = dark ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', resolved)
  if (dark) document.documentElement.classList.add('dark')

  var appearanceKey = 'veenna-appearance'
  var legacyAppearance = 'veenna-app-appearance'
  if (!localStorage.getItem(appearanceKey) && localStorage.getItem(legacyAppearance)) {
    localStorage.setItem(appearanceKey, localStorage.getItem(legacyAppearance))
  }
  try {
    var rawAppearance = localStorage.getItem(appearanceKey)
    if (rawAppearance) {
      var appearance = JSON.parse(rawAppearance)
      var blurRaw = appearance && appearance.wallpaperBlur
      if (blurRaw !== undefined && blurRaw !== null) {
        var blurPx = Number(blurRaw)
        if (Number.isFinite(blurPx)) {
          blurPx = Math.min(40, Math.max(0, Math.round(blurPx)))
          document.documentElement.style.setProperty('--veenna-wallpaper-blur', blurPx + 'px')
          document.documentElement.style.setProperty(
            '--veenna-wallpaper-blur-scale',
            blurPx > 0 ? String(1 + Math.min(blurPx, 40) / 100) : '1',
          )
        }
      }
    }
  } catch {
    /* ignore malformed appearance cache */
  }
})()
