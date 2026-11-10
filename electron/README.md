# Electron main process

- `main.cjs`: entry. Applies the network switches, registers the app scheme, then starts `app/lifecycle.cjs`.
- `app/`: lifecycle, main window.
- `ipc/`: `channels.cjs` (every channel name), `registerHandlers.cjs` (handlers), and `../preload.cjs` (the renderer bridge, which must expose only channels listed in `channels.cjs`).
- `lib/communityLockdown.cjs`: the network lockdown. Read this before touching anything that makes a request.
- `lib/protocol.cjs`: serves the built UI from disk under `veenna-community://app/`. It never forwards a request.
- `lib/whisperCppStt.cjs`, `localStt*.cjs`, `whisperModels.cjs`: on-device speech recognition and model downloads.
- `lib/remoteManifest.cjs`: verifies the Community API's signed files (used only by the opt-in update check).
- `lib/localStore/`: the local SQLite store for dictations.
- `native/`, `*.swift`: the whisper.cpp helper and the macOS key monitor and overlay helpers.

Tests: `bun run test:electron`.
