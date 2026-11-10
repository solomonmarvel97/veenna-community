import type { UniversalSearchGroup } from '@/types/universalSearch'

export type BrowserTab = {
  tabId: string
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  favicon: string | null
  createdAt: number
}

export type BrowserStateEvent = {
  type?: 'state' | 'created' | 'closed' | 'error' | 'open'
  tab?: BrowserTab
  tabId?: string | null
  activeTabId?: string | null
  code?: number | string | null
  message?: string
  url?: string | null
}
export type LocalStoreEntityRecord = {
  type: LocalStoreEntityType
  id: string
  payload: Record<string, unknown> | null
  searchText?: string
  updatedAt?: string
}
export type VeennaAppInfo = {
  name: string
  version: string
  isPackaged: boolean
  platform: NodeJS.Platform
}

export type DictationForegroundSnapshot = {
  appName: string | null
  windowTitle?: string | null
  bundleId?: string | null
  /** macOS Accessibility: true when a text field/area had focus at capture time. */
  textInputFocused?: boolean
}

export type DictationHotkeyPayload = {
  action:
    | 'down'
    | 'up'
    | 'confirm'
    | 'toggle-continuous'
    | 'hands-free-mode'
    | 'window-left'
    | 'foreground'
  foreground?: DictationForegroundSnapshot | null
}

export type VoiceHotkey = {
  ctrl?: boolean
  control?: boolean
  alt?: boolean
  option?: boolean
  shift?: boolean
  meta?: boolean
  cmd?: boolean
  command?: boolean
  key?: string
}
export type OpenAtLoginStatus = {
  openAtLogin: boolean
  systemOpenAtLogin: boolean
  wasOpenedAtLogin: boolean
  canRegister: boolean
}

export type SetOpenAtLoginResult = {
  ok: boolean
  reason?: string
  openAtLogin?: boolean
  requested?: boolean
}

export type DictationTrayState = 'idle' | 'recording' | 'processing' | 'error'
export type DictationTraySnapshot = {
  state: DictationTrayState
}

/** The kinds of record kept in the local database. */
export type LocalStoreEntityType = 'voice_capture' | 'todo_list' | 'todo_item'

export type LocalStoreUpsertPayload = {
  type: LocalStoreEntityType
  id: string
  payload: Record<string, unknown>
  searchText: string
  updatedAt?: string
  serverRev?: string | null
}

export type LocalStoreBulkUpsertPayload = {
  entities: LocalStoreUpsertPayload[]
}

export type LocalStoreListEntitiesPayload = {
  types?: LocalStoreEntityType[]
}

export type LocalStoreListEntitiesResult = {
  ok: boolean
  entities?: LocalStoreEntityRecord[]
  reason?: string
}
/** What macOS says about one permission veenna asks for. */
export type VeennaPermissionStatus =
  'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported'

export type VeennaPermission = {
  id: string
  label: string
  /** What veenna needs it for, in the user's terms. */
  purpose: string
  status: VeennaPermissionStatus
  /** Whether the system has a prompt we can raise for this one. */
  canRequest: boolean
  /** Whether it can be put back to never-asked. */
  canReset: boolean
  canOpenSettings: boolean
}

export type VeennaPermissionList = {
  supported: boolean
  platform: string
  permissions: VeennaPermission[]
}
export type VeennaPermissionResult = {
  ok: boolean
  reason?: string
  status?: VeennaPermissionStatus
  /** The system pane was opened instead of, or as well as, the action. */
  opened?: boolean
  /**
   * macOS had a prompt for this one but could not raise it: the permission was
   * cleared while the app was running, and the cached decision only clears on
   * relaunch. Settings was opened instead.
   */
  promptUnavailable?: boolean
}

declare global {
  interface Window {
    /** Main-window hook used by the HUD overlay to insert dictation into the focused field. */
    __veennaInsertDictationText?: (text: string) => boolean
    veennaElectron?: {
      isElectron: boolean
      isDictationHud?: boolean
      platform?: NodeJS.Platform
      getAppInfo?: () => Promise<VeennaAppInfo>
      setNativeTheme?: (source: 'light' | 'dark' | 'system') => Promise<{ ok: boolean }>
      /** The window's minimum width follows the nav: wider while it is open. */
      setNavCollapsed?: (collapsed: boolean) => Promise<{ ok: boolean }>
      pasteText?: (
        text: string,
        target?: { appName?: string | null; bundleId?: string | null; intoOwnApp?: boolean } | null,
        allowFallbackTarget?: boolean,
      ) => Promise<{ ok: boolean; reason?: string }>
      insertTextInApp?: (
        text: string,
      ) => Promise<{ ok: boolean; focused?: boolean; reason?: string }>
      onInsertTextInApp?: (
        handler: (text: string) => boolean | { ok: boolean; focused?: boolean },
      ) => (() => void) | void
      copyText?: (text: string) => Promise<{ ok: boolean; reason?: string }>
      getForegroundApp?: () => Promise<DictationForegroundSnapshot>
      registerHotkey?: (
        hotkey: VoiceHotkey | null,
      ) => Promise<{ ok: boolean; accelerator?: string; reason?: string; cleared?: boolean }>
      startDictationHotkey?: () => Promise<{ ok: boolean; reason?: string; ready?: boolean }>
      getDictationAccessibility?: () => Promise<{
        required: boolean
        trusted: boolean
        hotkeyConsumesEvents?: boolean
        inputMonitoring?: boolean
        /** The key monitor is running and has reported its permissions. */
        monitorReady?: boolean
        monitorBinary?: string | null
      }>
      openAccessibilitySettings?: () => Promise<{ ok: boolean }>
      openInputMonitoringSettings?: () => Promise<{ ok: boolean }>
      listSystemPermissions?: () => Promise<VeennaPermissionList>
      requestSystemPermission?: (id: string) => Promise<VeennaPermissionResult>
      resetSystemPermission?: (id: string) => Promise<VeennaPermissionResult>
      openSystemPermissionSettings?: (id: string) => Promise<{ ok: boolean; reason?: string }>
      setOverlayExpanded?: (
        expanded: boolean,
        handsFree?: boolean,
        showModeBar?: boolean,
        showModeMenu?: boolean,
        showPasteFallback?: boolean,
      ) => Promise<{ ok: boolean }>
      setOverlayHitRect?: (rect: {
        x: number
        y: number
        width: number
        height: number
      }) => Promise<{ ok: boolean }>
      onOverlayLayout?: (
        handler: (payload: {
          pill: { x: number; y: number }
          size: { width: number; height: number }
          conversation?: boolean
        }) => void,
      ) => () => void
      moveOverlayBy?: (deltaX: number, deltaY: number) => Promise<{ ok: boolean }>
      engageOverlay?: (lock?: boolean) => Promise<{ ok: boolean }>
      revealOverlay?: () => Promise<{ ok: boolean }>
      setHudIdleVisible?: (visible: boolean) => Promise<{ ok: boolean }>
      setHudVisibleDuringScreenShare?: (visible: boolean) => Promise<{ ok: boolean }>
      getOpenAtLogin?: () => Promise<OpenAtLoginStatus>
      setOpenAtLogin?: (enabled: boolean) => Promise<SetOpenAtLoginResult>
      setDuckAudioWhileDictating?: (enabled: boolean) => Promise<{ ok: boolean; enabled: boolean }>
      setDictationState?: (
        state:
          | DictationTrayState
          | (DictationTraySnapshot & { duckAudio?: boolean }),
      ) => Promise<{ ok: boolean }>
      notifyVoiceDataChanged?: (payload?: {
        capture?: import('@/stores/voiceCaptures').VoiceCapture
        audioSaving?: boolean
        audioCaptureId?: string
      }) => Promise<{ ok: boolean }>
      onVoiceDataChanged?: (
        handler: (payload: {
                              capture?: import('@/stores/voiceCaptures').VoiceCapture
          audioSaving?: boolean
          audioCaptureId?: string
        }) => void,
      ) => (() => void) | void
      onDictationHotkey?: (
        handler: (payload: DictationHotkeyPayload) => void,
      ) => (() => void) | void
      onHudIdleVisibleSync?: (
        handler: (payload: { visible: boolean; persist?: boolean }) => void,
      ) => (() => void) | void
      onOpenSettingsModal?: (handler: (payload: { tab?: string }) => void) => (() => void) | void
      /** Page zoom changed from the menu, a shortcut or ctrl-wheel; 1 is 100%. */
      onZoomChanged?: (handler: (factor: number) => void) => (() => void) | void
      openExternalUrl?: (url: string) => Promise<{ ok: boolean; reason?: string; message?: string }>
      /** Community edition: opt-in check of the signed version and model manifests (two GETs, nothing sent). */
      checkCommunityUpdates?: () => Promise<
        | {
            ok: true
            currentVersion: string
            latestVersion: string
            updateAvailable: boolean
            notes: string
            pageUrl: string
            newModels: Array<{ id: string; label: string; sizeLabel: string }>
          }
        | { ok: false; reason: string; message: string }
      >
      /** Community edition: saves a .veennapack to Documents/Veenna Migration. */
      saveCommunityPack?: (
        bytes: Uint8Array,
        options?: { reveal?: boolean },
      ) => Promise<{ ok: boolean; path?: string; reason?: string; message?: string }>
      onHudScreenShareVisibleSync?: (
        handler: (payload: { visible: boolean; persist?: boolean }) => void,
      ) => (() => void) | void
      openLocalStore?: (
        userId: string,
      ) => Promise<{ ok: boolean; userId?: string; reason?: string }>
      closeLocalStore?: () => Promise<{ ok: boolean }>
      upsertLocalEntity?: (
        payload: LocalStoreUpsertPayload,
      ) => Promise<{ ok: boolean; reason?: string }>
      deleteLocalEntity?: (payload: {
        type: LocalStoreEntityType
        id: string
      }) => Promise<{ ok: boolean; reason?: string }>
      clearLocalSyncedEntities?: () => Promise<{
        ok: boolean
        entitiesCleared?: number
        vectorsCleared?: number
        reason?: string
      }>
      bulkUpsertLocalEntities?: (
        payload: LocalStoreBulkUpsertPayload,
      ) => Promise<{ ok: boolean; count?: number; reason?: string }>
      listLocalEntities?: (
        payload?: LocalStoreListEntitiesPayload,
      ) => Promise<LocalStoreListEntitiesResult>
      getLocalAppSetting?: (
        key: string,
      ) => Promise<{ ok: boolean; value?: unknown; reason?: string }>
      setLocalAppSetting?: (
        key: string,
        value: unknown,
      ) => Promise<{ ok: boolean; reason?: string }>
      listWhisperModels?: () => Promise<{
        ok: boolean
        models?: Array<{
          id: string
          label: string
          tier: string
          sizeLabel: string
          description: string
          bundled: boolean
          huggingFaceUrl: string
          installed: boolean
          source: 'bundled' | 'user' | null
          bytesOnDisk: number
          downloading: boolean
        }>
        reason?: string
      }>
      downloadWhisperModel?: (modelId: string) => Promise<{
        ok: boolean
        models?: unknown[]
        reason?: string
      }>
      cancelWhisperModelDownload?: (modelId: string) => Promise<{ ok: boolean; reason?: string }>
      deleteWhisperModel?: (modelId: string) => Promise<{
        ok: boolean
        removed?: boolean
        models?: unknown[]
        reason?: string
      }>
      onWhisperModelDownloadProgress?: (
        handler: (payload: {
          modelId: string
          phase: string
          file: string | null
          fileIndex: number
          fileCount: number
          bytesReceived?: number
          bytesTotal?: number
          percent: number
        }) => void,
      ) => (() => void) | void
      getSpeechCapabilities?: () => Promise<{
        ok: boolean
        capabilities?: import('@/lib/voice/speechModelRequirements').SpeechCapabilitiesSnapshot
        reason?: string
      }>
      preloadLocalSttModel?: (payload: {
        modelId: string
      }) => Promise<{ ok: boolean; reason?: string }>
      transcribeLocalAudio?: (payload: {
        /** Mono PCM float32 samples (typically 16 kHz) for local Whisper. */
        samples: ArrayBuffer
        sampleRate: number
        modelId: string
        language?: string | null
        durationMs?: number | null
      }) => Promise<{
        ok: boolean
        text?: string
        durationMs?: number | null
        /** How long the model itself took, and which engine ran it (for dictation traces). */
        inferenceMs?: number | null
        runtime?: 'whisper-cpp' | 'onnx' | null
        reason?: string
      }>
      resetLocalSttModel?: () => Promise<{ ok: boolean; reason?: string }>
      browser?: {
        capabilities: () => Promise<{
          ok: boolean
          available?: boolean
          maxTabs?: number
          reason?: string
        }>
        create: (options?: {
          url?: string
          activate?: boolean
        }) => Promise<{ ok: boolean; tab?: BrowserTab; reason?: string; message?: string }>
        navigate: (
          tabId: string,
          url: string,
        ) => Promise<{ ok: boolean; tab?: BrowserTab; reason?: string; message?: string }>
        goBack: (tabId: string) => Promise<{ ok: boolean; reason?: string }>
        goForward: (tabId: string) => Promise<{ ok: boolean; reason?: string }>
        reload: (tabId: string) => Promise<{ ok: boolean; reason?: string }>
        stop: (tabId: string) => Promise<{ ok: boolean; reason?: string }>
        setActive: (tabId: string) => Promise<{ ok: boolean; tab?: BrowserTab; reason?: string }>
        close: (
          tabId: string,
        ) => Promise<{ ok: boolean; activeTabId?: string | null; reason?: string }>
        list: () => Promise<{
          ok: boolean
          tabs?: BrowserTab[]
          activeTabId?: string | null
          reason?: string
        }>
        openExternal: (
          tabId: string,
        ) => Promise<{ ok: boolean; url?: string; reason?: string; message?: string }>
        capture: (tabId: string) => Promise<{
          ok: boolean
          copied?: boolean
          saved?: boolean
          fileName?: string | null
          reason?: string
          message?: string
        }>
        capturePreview: () => Promise<{
          ok: boolean
          dataUrl?: string
          reason?: string
          message?: string
        }>
        /** The agent driving a tab: `{ action, args }` from a browser_* tool. */
        agentAction?: (request: {
          action: string
          args?: Record<string, unknown>
        }) => Promise<Record<string, unknown> & { ok: boolean; reason?: string; message?: string }>
        setBounds: (bounds: { x: number; y: number; width: number; height: number }) => void
        requestBoundsRefresh: () => void
        setPanelVisible: (visible: boolean) => Promise<{ ok: boolean; visible?: boolean }>
        setOccluded: (occluded: boolean) => Promise<{ ok: boolean; occluded?: boolean }>
        onState: (handler: (payload: BrowserStateEvent) => void) => (() => void) | void
        onError: (
          handler: (payload: {
            tabId: string | null
            code: number | string | null
            message: string
            url?: string | null
          }) => void,
        ) => (() => void) | void
      }
    }
  }
}

export {}
/** One row of a native right-click menu (electron/lib/nativeContextMenu.cjs). */
type NativeContextMenuItem =
  | { type: 'separator' }
  | {
      id?: string
      label: string
      /** Electron accelerator shown as the hint (never registered), e.g. `CmdOrCtrl+Shift+Z`. */
      accelerator?: string
      enabled?: boolean
      checked?: boolean
      submenu?: NativeContextMenuItem[]
    }
