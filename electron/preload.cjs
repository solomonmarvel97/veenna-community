'use strict'

const { contextBridge, ipcRenderer, webFrame } = require('electron')

/**
 * Channel names inlined for sandboxed preload (relative require of ./ipc/channels.cjs
 * fails under sandbox:true). Keep in sync with electron/ipc/channels.cjs.
 */
const channels = {

  PASTE_TEXT: 'veenna:dictation-paste-text',
  INSERT_IN_APP_TEXT: 'veenna:dictation-insert-in-app',
  INSERT_IN_APP_TEXT_APPLY: 'veenna:dictation-insert-in-app-apply',
  INSERT_IN_APP_TEXT_APPLIED: 'veenna:dictation-insert-in-app-applied',
  COPY_TEXT: 'veenna:clipboard-write-text',

  GET_FOREGROUND_APP: 'veenna:voice-get-foreground-app',
  REGISTER_HOTKEY: 'veenna:voice-register-hotkey',
  START_DICTATION_HOTKEY: 'veenna:voice-start-dictation-hotkey',
  DICTATION_ACCESSIBILITY: 'veenna:voice-dictation-accessibility',
  GET_APP_INFO: 'veenna:get-app-info',

  SET_NATIVE_THEME: 'veenna:set-native-theme',
  SET_NAV_COLLAPSED: 'veenna:set-nav-collapsed',
  OPEN_ACCESSIBILITY_SETTINGS: 'veenna:open-accessibility-settings',
  OPEN_INPUT_MONITORING_SETTINGS: 'veenna:open-input-monitoring-settings',
  PERMISSIONS_LIST: 'veenna:permissions-list',
  PERMISSIONS_REQUEST: 'veenna:permissions-request',
  PERMISSIONS_RESET: 'veenna:permissions-reset',
  PERMISSIONS_OPEN_SETTINGS: 'veenna:permissions-open-settings',

  OVERLAY_SET_EXPANDED: 'veenna:overlay-set-expanded',

  OVERLAY_SET_HIT_RECT: 'veenna:overlay-set-hit-rect',
  OVERLAY_LAYOUT: 'veenna:overlay-layout',
  OVERLAY_MOVE_BY: 'veenna:overlay-move-by',
  OVERLAY_ENGAGE: 'veenna:overlay-engage',
  OVERLAY_REVEAL: 'veenna:overlay-reveal',
  OVERLAY_SET_HUD_IDLE_VISIBLE: 'veenna:overlay-set-hud-idle-visible',

  OVERLAY_SET_HUD_SCREEN_SHARE_VISIBLE: 'veenna:overlay-set-hud-screen-share-visible',

  GET_OPEN_AT_LOGIN: 'veenna:get-open-at-login',
  SET_OPEN_AT_LOGIN: 'veenna:set-open-at-login',
  DICTATION_STATE: 'veenna:dictation-state',

  VOICE_DATA_CHANGED: 'veenna:voice-data-changed',
  OPEN_SETTINGS_MODAL: 'veenna:open-settings-modal',
  ZOOM_CHANGED: 'veenna:zoom-changed',
  HUD_IDLE_VISIBLE_SYNC: 'veenna:hud-idle-visible-sync',
  HUD_SCREEN_SHARE_VISIBLE_SYNC: 'veenna:hud-screen-share-visible-sync',
  LOCAL_STORE_OPEN: 'veenna:local-store-open',
  LOCAL_STORE_CLOSE: 'veenna:local-store-close',
  LOCAL_STORE_UPSERT: 'veenna:local-store-upsert',
  LOCAL_STORE_DELETE: 'veenna:local-store-delete',
  LOCAL_STORE_CLEAR_SYNCED: 'veenna:local-store-clear-synced',
  LOCAL_STORE_BULK_UPSERT: 'veenna:local-store-bulk-upsert',
  LOCAL_STORE_LIST_ENTITIES: 'veenna:local-store-list-entities',

  LOCAL_STORE_GET_APP_SETTING: 'veenna:local-store-get-app-setting',
  LOCAL_STORE_SET_APP_SETTING: 'veenna:local-store-set-app-setting',

  SET_DUCK_AUDIO_WHILE_DICTATING: 'veenna:set-duck-audio-while-dictating',
  WHISPER_MODEL_LIST: 'veenna:whisper-model-list',
  WHISPER_MODEL_DOWNLOAD: 'veenna:whisper-model-download',
  WHISPER_MODEL_CANCEL: 'veenna:whisper-model-cancel',
  WHISPER_MODEL_DELETE: 'veenna:whisper-model-delete',
  WHISPER_MODEL_DOWNLOAD_PROGRESS: 'veenna:whisper-model-download-progress',

  SPEECH_CAPABILITIES: 'veenna:speech-capabilities',
  LOCAL_STT_PRELOAD: 'veenna:local-stt-preload',
  LOCAL_STT_TRANSCRIBE: 'veenna:local-stt-transcribe',
  LOCAL_STT_RESET: 'veenna:local-stt-reset',

  OPEN_EXTERNAL_URL: 'veenna:open-external-url',
  COMMUNITY_SAVE_PACK: 'community:save-pack',
  COMMUNITY_CHECK_UPDATES: 'community:check-updates',

}

const isDictationHud = process.argv.includes('--dictation-hud')

// Chromium shares zoom across windows on one origin, and the HUD shares the app's.
// Setting it from the frame detaches this window, so app zoom never reaches it.
if (isDictationHud) webFrame.setZoomFactor(1)

function toPlainIpcPayload(value) {
  if (value == null || typeof value !== 'object') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

const LOCAL_STORE_CHANNELS = new Set([
  channels.LOCAL_STORE_OPEN,
  channels.LOCAL_STORE_CLOSE,
  channels.LOCAL_STORE_UPSERT,
  channels.LOCAL_STORE_DELETE,
  channels.LOCAL_STORE_CLEAR_SYNCED,
  channels.LOCAL_STORE_BULK_UPSERT,
  channels.LOCAL_STORE_LIST_ENTITIES,

  channels.LOCAL_STORE_GET_APP_SETTING,
  channels.LOCAL_STORE_SET_APP_SETTING,
])

function invoke(channel, ...args) {
  if (!LOCAL_STORE_CHANNELS.has(channel)) {
    return ipcRenderer.invoke(channel, ...args)
  }

  const payload = args[0]
  try {
    const plain = payload === undefined ? undefined : toPlainIpcPayload(payload)
    if (payload !== undefined && payload !== null && plain === null) {
      return Promise.resolve({ ok: false, reason: 'clone_failed' })
    }
    return ipcRenderer.invoke(channel, plain).catch((error) => ({
      ok: false,
      reason: error instanceof Error ? error.message : 'invoke_failed',
    }))
  } catch (error) {
    return Promise.resolve({
      ok: false,
      reason: error instanceof Error ? error.message : 'clone_failed',
    })
  }
}

contextBridge.exposeInMainWorld('veennaElectron', {
  isElectron: true,
  isDictationHud,
  platform: process.platform,

  getAppInfo: () => invoke(channels.GET_APP_INFO),
  setNativeTheme: (source) => invoke(channels.SET_NATIVE_THEME, source),
  setNavCollapsed: (collapsed) => invoke(channels.SET_NAV_COLLAPSED, collapsed),

  pasteText: (text, target, allowFallbackTarget = true) =>
    invoke(channels.PASTE_TEXT, String(text ?? ''), target ?? null, allowFallbackTarget !== false),
  insertTextInApp: (text) => invoke(channels.INSERT_IN_APP_TEXT, String(text ?? '')),
  onInsertTextInApp: (handler) => {
    const listener = (_event, payload) => {
      const text = String(payload?.text ?? '')
      const requestId = payload?.requestId
      let ok = false
      let focused = false
      try {
        const result = handler(text)
        if (result && typeof result === 'object') {
          ok = Boolean(result.ok)
          focused = Boolean(result.focused)
        } else {
          ok = Boolean(result)
          focused = ok
        }
      } catch {
        ok = false
      }
      ipcRenderer.send(channels.INSERT_IN_APP_TEXT_APPLIED, { requestId, ok, focused })
    }
    ipcRenderer.on(channels.INSERT_IN_APP_TEXT_APPLY, listener)
    return () => ipcRenderer.removeListener(channels.INSERT_IN_APP_TEXT_APPLY, listener)
  },
  copyText: (text) => invoke(channels.COPY_TEXT, String(text ?? '')),
  getForegroundApp: () => invoke(channels.GET_FOREGROUND_APP),
  registerHotkey: (hotkey) => invoke(channels.REGISTER_HOTKEY, hotkey),
  startDictationHotkey: () => invoke(channels.START_DICTATION_HOTKEY),
  getDictationAccessibility: () => invoke(channels.DICTATION_ACCESSIBILITY),
  openAccessibilitySettings: () => invoke(channels.OPEN_ACCESSIBILITY_SETTINGS),
  openInputMonitoringSettings: () => invoke(channels.OPEN_INPUT_MONITORING_SETTINGS),
  listSystemPermissions: () => invoke(channels.PERMISSIONS_LIST),
  requestSystemPermission: (id) => invoke(channels.PERMISSIONS_REQUEST, String(id ?? '')),
  resetSystemPermission: (id) => invoke(channels.PERMISSIONS_RESET, String(id ?? '')),
  openSystemPermissionSettings: (id) =>
    invoke(channels.PERMISSIONS_OPEN_SETTINGS, String(id ?? '')),
  setOverlayExpanded: (
    expanded,
    handsFree = false,
    showModeBar = false,
    showModeMenu = false,
    showPasteFallback = false,
  ) =>
    invoke(channels.OVERLAY_SET_EXPANDED, {
      expanded: Boolean(expanded),
      handsFree: Boolean(handsFree),
      showModeBar: Boolean(showModeBar),
      showModeMenu: Boolean(showModeMenu),
      showPasteFallback: Boolean(showPasteFallback),
    }),
  setOverlayHitRect: (rect) =>
    invoke(channels.OVERLAY_SET_HIT_RECT, {
      x: Number(rect?.x ?? 0),
      y: Number(rect?.y ?? 0),
      width: Number(rect?.width ?? 0),
      height: Number(rect?.height ?? 0),
    }),
  moveOverlayBy: (deltaX, deltaY) =>
    invoke(channels.OVERLAY_MOVE_BY, { deltaX: Number(deltaX), deltaY: Number(deltaY) }),
  engageOverlay: (lock) =>
    invoke(channels.OVERLAY_ENGAGE, typeof lock === 'boolean' ? { lock } : {}),
  revealOverlay: () => invoke(channels.OVERLAY_REVEAL),
  setHudIdleVisible: (visible) =>
    invoke(channels.OVERLAY_SET_HUD_IDLE_VISIBLE, { visible: Boolean(visible) }),
  setHudVisibleDuringScreenShare: (visible) =>
    invoke(channels.OVERLAY_SET_HUD_SCREEN_SHARE_VISIBLE, { visible: Boolean(visible) }),
  getOpenAtLogin: () => invoke(channels.GET_OPEN_AT_LOGIN),
  setOpenAtLogin: (enabled) => invoke(channels.SET_OPEN_AT_LOGIN, Boolean(enabled)),
  setDuckAudioWhileDictating: (enabled) => invoke(channels.SET_DUCK_AUDIO_WHILE_DICTATING, Boolean(enabled)),
  setDictationState: (state) => invoke(channels.DICTATION_STATE, state || {}),

  notifyVoiceDataChanged: (payload) => invoke(channels.VOICE_DATA_CHANGED, payload || {}),
  onVoiceDataChanged: (handler) => {
    const listener = (_event, payload) => handler(payload || {})
    ipcRenderer.on(channels.VOICE_DATA_CHANGED, listener)
    return () => ipcRenderer.removeListener(channels.VOICE_DATA_CHANGED, listener)
  },

  onDictationHotkey: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('dictation-hotkey', listener)
    return () => ipcRenderer.removeListener('dictation-hotkey', listener)
  },

  onOverlayLayout: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on(channels.OVERLAY_LAYOUT, listener)
    return () => ipcRenderer.removeListener(channels.OVERLAY_LAYOUT, listener)
  },

  onOpenSettingsModal: (handler) => {
    const listener = (_event, payload) => handler(payload || {})
    ipcRenderer.on(channels.OPEN_SETTINGS_MODAL, listener)
    return () => ipcRenderer.removeListener(channels.OPEN_SETTINGS_MODAL, listener)
  },

  onZoomChanged: (handler) => {
    const listener = (_event, factor) => handler(Number(factor) || 1)
    ipcRenderer.on(channels.ZOOM_CHANGED, listener)
    return () => ipcRenderer.removeListener(channels.ZOOM_CHANGED, listener)
  },

  onHudIdleVisibleSync: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on(channels.HUD_IDLE_VISIBLE_SYNC, listener)
    return () => ipcRenderer.removeListener(channels.HUD_IDLE_VISIBLE_SYNC, listener)
  },

  onHudScreenShareVisibleSync: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on(channels.HUD_SCREEN_SHARE_VISIBLE_SYNC, listener)
    return () => ipcRenderer.removeListener(channels.HUD_SCREEN_SHARE_VISIBLE_SYNC, listener)
  },

  openLocalStore: (userId) => invoke(channels.LOCAL_STORE_OPEN, { userId }),
  closeLocalStore: () => invoke(channels.LOCAL_STORE_CLOSE),
  upsertLocalEntity: (payload) => invoke(channels.LOCAL_STORE_UPSERT, payload),
  deleteLocalEntity: (payload) => invoke(channels.LOCAL_STORE_DELETE, payload),
  clearLocalSyncedEntities: () => invoke(channels.LOCAL_STORE_CLEAR_SYNCED),
  bulkUpsertLocalEntities: (payload) => invoke(channels.LOCAL_STORE_BULK_UPSERT, payload),
  listLocalEntities: (payload) => invoke(channels.LOCAL_STORE_LIST_ENTITIES, payload || {}),
  getLocalAppSetting: (key) => invoke(channels.LOCAL_STORE_GET_APP_SETTING, { key }),
  setLocalAppSetting: (key, value) => invoke(channels.LOCAL_STORE_SET_APP_SETTING, { key, value }),

  listWhisperModels: () => invoke(channels.WHISPER_MODEL_LIST),
  downloadWhisperModel: (modelId) => invoke(channels.WHISPER_MODEL_DOWNLOAD, { modelId }),
  cancelWhisperModelDownload: (modelId) => invoke(channels.WHISPER_MODEL_CANCEL, { modelId }),
  deleteWhisperModel: (modelId) => invoke(channels.WHISPER_MODEL_DELETE, { modelId }),
  onWhisperModelDownloadProgress: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on(channels.WHISPER_MODEL_DOWNLOAD_PROGRESS, listener)
    return () => ipcRenderer.removeListener(channels.WHISPER_MODEL_DOWNLOAD_PROGRESS, listener)
  },

  getSpeechCapabilities: () => invoke(channels.SPEECH_CAPABILITIES),

  preloadLocalSttModel: (payload) =>
    invoke(channels.LOCAL_STT_PRELOAD, {
      modelId: typeof payload?.modelId === 'string' ? payload.modelId : '',
    }),
  transcribeLocalAudio: (payload) =>
    invoke(channels.LOCAL_STT_TRANSCRIBE, {
      samples: payload?.samples,
      sampleRate: payload?.sampleRate,
      modelId: typeof payload?.modelId === 'string' ? payload.modelId : '',
      language: typeof payload?.language === 'string' ? payload.language : null,
      durationMs: payload?.durationMs ?? null,
    }),
  resetLocalSttModel: () => invoke(channels.LOCAL_STT_RESET),
  openExternalUrl: (url) => invoke(channels.OPEN_EXTERNAL_URL, String(url ?? '')),
  checkCommunityUpdates: () => invoke(channels.COMMUNITY_CHECK_UPDATES),
  saveCommunityPack: (bytes, options) =>
    invoke(channels.COMMUNITY_SAVE_PACK, bytes, { reveal: options?.reveal !== false }),

})
