'use strict';

/** IPC channel names - keep in sync with preload.cjs and src/types/electron.d.ts */
module.exports = {

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

  NOTIFICATION_CLICK: 'veenna:notification-click',

  SET_NATIVE_THEME: 'veenna:set-native-theme',
  SET_NAV_COLLAPSED: 'veenna:set-nav-collapsed',
  OPEN_ACCESSIBILITY_SETTINGS: 'veenna:open-accessibility-settings',
  OPEN_INPUT_MONITORING_SETTINGS: 'veenna:open-input-monitoring-settings',
  PERMISSIONS_LIST: 'veenna:permissions-list',
  PERMISSIONS_REQUEST: 'veenna:permissions-request',
  PERMISSIONS_RESET: 'veenna:permissions-reset',
  PERMISSIONS_OPEN_SETTINGS: 'veenna:permissions-open-settings',

  OVERLAY_SET_EXPANDED: 'veenna:overlay-set-expanded',

  /** Main app → HUD: mute or unmute the Talk microphone. */

  OVERLAY_SET_HIT_RECT: 'veenna:overlay-set-hit-rect',
  OVERLAY_LAYOUT: 'veenna:overlay-layout',
  OVERLAY_MOVE_BY: 'veenna:overlay-move-by',
  OVERLAY_ENGAGE: 'veenna:overlay-engage',
  OVERLAY_REVEAL: 'veenna:overlay-reveal',
  OVERLAY_SET_HUD_IDLE_VISIBLE: 'veenna:overlay-set-hud-idle-visible',
  /** Renderer → main: keep the idle pill away (Notes in front) or let it back. */

  OVERLAY_SET_HUD_SCREEN_SHARE_VISIBLE: 'veenna:overlay-set-hud-screen-share-visible',
  /** Main → HUD: cursor is over overlay bounds (tracked in main process). */

  GET_OPEN_AT_LOGIN: 'veenna:get-open-at-login',
  SET_OPEN_AT_LOGIN: 'veenna:set-open-at-login',
  DICTATION_STATE: 'veenna:dictation-state',

  /** Renderer → main → all renderers: HUD created/updated voice data (captures / notes / tasks). */
  VOICE_DATA_CHANGED: 'veenna:voice-data-changed',
  /** Main → main window: open the in-app settings modal. */
  OPEN_SETTINGS_MODAL: 'veenna:open-settings-modal',
  /** Main → renderer: the page zoom factor just changed (1 = 100%). */
  ZOOM_CHANGED: 'veenna:zoom-changed',
  /** Main → renderers: persist HUD idle visibility from tray menu. */
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
  /** Desktop pack (shared tools + built-in skills) and the per-user skill mirror. */

  SPEECH_CAPABILITIES: 'veenna:speech-capabilities',
  LOCAL_STT_PRELOAD: 'veenna:local-stt-preload',
  LOCAL_STT_TRANSCRIBE: 'veenna:local-stt-transcribe',
  LOCAL_STT_RESET: 'veenna:local-stt-reset',

  /** Main → renderer: auto-update status changed. */

  OPEN_EXTERNAL_URL: 'veenna:open-external-url',
  /** Community edition: write a .veennapack migration file to the Veenna Migration folder. */
  COMMUNITY_SAVE_PACK: 'community:save-pack',
  COMMUNITY_CHECK_UPDATES: 'community:check-updates',

};
