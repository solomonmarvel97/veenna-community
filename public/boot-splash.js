/*
  Every Electron window loads this file, floating panels included. A
  full-bleed wordmark and a spinner belong to the workspace opening; on
  the always-on-top dictation HUD, a sticky, or the meeting prompt the
  same markup is a grey card sitting over a small panel - and, being
  fixed and inset-0, it swallows clicks until the bundle takes it away.
  Those windows get no splash at all, removed rather than hidden. Clio's
  overlay matters most: it is a transparent window over the whole display,
  shown at launch, so a splash there fills the screen before the main window
  appears. A public
  share link keeps the splash but in its plain share variant.

  The shell flag comes from the preload, which runs ahead of this script;
  the path is checked too so a window that somehow loads without it still
  reads correctly.
*/
;(function () {
  var el = document.getElementById('boot-splash')
  if (!el) return
  var shell = window.veennaElectron || {}
  var panels = ['/dictation-hud', '/meeting-prompt', '/stickies/widget', '/clio-overlay']
  var floating =
    Boolean(
      shell.isDictationHud || shell.isClioOverlay || shell.isStickyWidget || shell.isMeetingPrompt,
    ) ||
    panels.indexOf(window.location.pathname) !== -1
  if (floating) {
    el.remove()
    return
  }
  // A public share link loads one shared thing, not a workspace: say which.
  var shares = [
    ['/notes/share/', 'Loading note'],
    ['/chat/share/', 'Loading shared reply'],
    ['/loop/share/', 'Loading shared link'],
  ]
  for (var i = 0; i < shares.length; i++) {
    if (window.location.pathname.indexOf(shares[i][0]) !== 0) continue
    var label = document.getElementById('boot-splash-share-label')
    if (label) label.textContent = shares[i][1]
    el.setAttribute('data-variant', 'share')
    break
  }
  setTimeout(function () {
    el.className = 'is-visible'
  }, 400)
})()
