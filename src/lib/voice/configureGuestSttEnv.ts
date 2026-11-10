const LOCAL_MODEL_PREFIX = '/models/'

type Transformers = typeof import('@xenova/transformers')

// transformers.js drags onnxruntime-web in with it, several MB of JS. Electron
// transcribes in the main process and never needs it, so the renderer only
// loads it the first time a model actually runs here.
let transformersPromise: Promise<Transformers> | null = null

function transformersWasmBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL('transformers-wasm/', window.location.origin).href
  }
  return '/transformers-wasm/'
}

/** Configure transformers.js to load whisper from bundled /models/ (Vite public/ or the app protocol). */
function configureGuestSttEnv({ env }: Transformers) {
  // Vite pre-bundles @xenova/transformers with Node fs/path polyfills, so env.useFS
  // becomes true in the renderer. That makes local paths hit the filesystem (/models/…)
  // instead of HTTP. Force fetch-based loading from our public/ models directory.
  env.useFS = false
  env.useFSCache = false

  env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2)
  env.allowLocalModels = true
  env.localModelPath = LOCAL_MODEL_PREFIX
  env.useBrowserCache = false

  if (import.meta.env.VITE_IS_ELECTRON === 'true') {
    env.allowRemoteModels = false
    env.backends.onnx.wasm.wasmPaths = transformersWasmBaseUrl()
  }
}

/** Loads transformers.js once, configured for the bundled models. */
export function loadGuestSttTransformers(): Promise<Transformers> {
  transformersPromise ??= import('@xenova/transformers').then((transformers) => {
    configureGuestSttEnv(transformers)
    return transformers
  })
  return transformersPromise
}

function whisperConfigPathForModel(modelId: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(`${modelId}/config.json`, `${window.location.origin}${LOCAL_MODEL_PREFIX}`).href
  }
  return `${LOCAL_MODEL_PREFIX}${modelId}/config.json`
}

export async function isGuestWhisperModelAvailable(modelId: string): Promise<boolean> {
  try {
    const res = await fetch(whisperConfigPathForModel(modelId), { method: 'GET' })
    if (!res.ok) return false
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/html')) return false
    const text = (await res.text()).trim()
    return text.startsWith('{')
  } catch {
    return false
  }
}

export function guestSttUnavailableMessage(): string {
  return 'Local speech model is not installed. Open Settings → Models to check status.'
}
