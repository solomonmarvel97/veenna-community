# Veenna Community

Free dictation that runs entirely on your device. Hold a key, speak, and the text appears wherever you were typing.

No account. No cloud. Your audio and your words never leave your computer.

## Features

- **Push-to-talk anywhere.** A global hotkey, with an optional hands-free double-tap and a small floating status pill.
- **On-device speech recognition.** [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (GPU where available) and ONNX Whisper models. Download more models in Settings, or import your own file.
- **History and insights.** Past dictations with audio, plus words, pace and activity, all computed locally.
- **Export.** Save everything to a `.veennapack` file to move to the full Veenna app.

## Privacy

Community blocks all network traffic except read-only (GET/HEAD) requests to the speech-model host and the Community API. The block lives in [`electron/lib/communityLockdown.cjs`](electron/lib/communityLockdown.cjs) and is covered by tests.

The app never checks for updates by itself. Only the **Check for updates** button talks to the API, and it sends nothing from your device.

## Using the hotkey

| Platform | Key           | Hold to dictate                         | Hands-free                              |
| -------- | ------------- | --------------------------------------- | --------------------------------------- |
| macOS    | **Option** (left or right) | Hold it, speak, let go to paste | Press it twice, speak, press it once more to finish |
| Windows  | **Right Alt** | Hold it, speak, let go to paste         | Press it twice, speak, press it once more to finish |
| Linux    | **Right Alt** | Works while the Veenna window is focused; a system-wide hotkey is not available yet | Same, inside the window |

- Click into the app you want to type in first. The text is pasted where your cursor is when you let go.
- You can change the hands-free shortcut in **Settings → Dictation**.
- On macOS the first launch asks for **Microphone**, **Accessibility** and **Input Monitoring**. Without Accessibility and Input Monitoring the global key cannot hear you, and Settings → Permissions shows what is missing.
- On Windows, allow the microphone when asked.

## Getting started

You need [Bun](https://bun.sh). Each platform builds on its own operating system:

- **macOS:** Xcode command-line tools (for the Swift helpers).
- **Windows:** Visual Studio Build Tools with the C++ workload and CMake (for the speech helper).
- **Linux:** a C++ toolchain and CMake (`build-essential cmake`) and the X11 development headers. Linux packages are configured but have not been built or tested yet.

```bash
make install
make dev
```

Run `make` to list every command.

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `make dev`          | Run the desktop app                                                 |
| `make test`         | Renderer and main-process tests                                     |
| `make check`        | Type-check, lint and all tests                                      |
| `make mac-unsigned` | Build a macOS installer for local use                               |
| `make mac`          | Build a signed, notarised macOS installer (needs Apple credentials) |
| `make windows`      | Build a Windows installer (`.exe` and `.zip`)                       |
| `make linux`        | Build Linux packages (`.deb`, `.AppImage`, `.tar.gz`)               |

The same commands without `make`:

```bash
bun run electron:build:unsigned   # macOS, local use
bun run electron:build            # macOS, signed and notarised
bun run electron:build:win        # Windows
bun run electron:build:linux      # Linux
```

Installers are written to `release/`.

## Project layout

```text
src/        Vue 3 app: dictation, insights, settings and the HUD window
electron/   main process, preload, native helpers, network lockdown
api/        Community API: signed model catalog and version manifest
scripts/    icons, whisper build and packaging hooks
```

See [`electron/README.md`](electron/README.md) for the main process and [`api/README.md`](api/README.md) for the API.

## Licence

MIT. See [`LICENSE`](LICENSE).
