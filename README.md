# TriClick Studio

TriClick Studio is a multilingual desktop automation tool built with Tauri,
TypeScript, and Rust. It supports precise mouse clicking, keyboard and mouse
recording/playback, multiple profiles, scheduled tasks, custom hotkeys, theme
and font switching, and tray minimization.

The app is designed for Windows desktop workflows where repeatable input
automation needs a clean interface and native performance.

## Features

- Mouse click automation with single, double, hold, burst, and sequence modes
- Precise interval, jitter, delay, count, and repeat controls
- Keyboard and mouse recording with playback speed control
- Multiple profiles and in-app scheduled tasks
- Press-to-set custom global hotkeys
- Chinese, Japanese, and English UI
- Theme and font switching with embedded MiSans
- System tray minimization

## Run

```powershell
npm install
npm run tauri dev
```

## Build

```powershell
npm run tauri build
```

If the Windows installer tool download times out, build the standalone exe:

```powershell
npm run tauri:exe
```

MiSans is embedded from `src/assets/fonts/MiSans-Medium.ttf`.
