# TriClick Studio Multilingual Guide

## 中文

TriClick Studio 是一个 Windows 桌面自动化工具，使用 Tauri + TypeScript + Rust 构建。它面向鼠标连点、键盘自动化、宏录制回放、序列编辑、多配置管理和计划任务，默认采用赛博朋克风格界面，并内嵌 MiSans 字体。

### 下载

从 [GitHub Releases](https://github.com/Hezamura/tri-clicker/releases) 下载最新版本。

| 文件 | 用途 |
| --- | --- |
| `TriClick-Studio-vX.Y.Z-portable.zip` | 便携版，解压即可运行 |
| `TriClick-Studio-vX.Y.Z-setup.exe` | 安装版，适合长期使用 |

### 核心功能

| 模块 | 说明 |
| --- | --- |
| 点击模式 | 单击、双击、长按、爆发点击、键盘连按、可编辑序列 |
| 精准控制 | 毫秒级间隔、启动延迟、运行上限、固定次数、无限循环 |
| 随机化 | 点击间隔抖动、固定坐标随机半径 |
| 录制回放 | 录制鼠标移动、鼠标按下/松开、滚轮、键盘按下/松开 |
| 录制优化 | 压缩密集鼠标移动事件，保留关键轨迹和延迟 |
| 配置管理 | 多组配置、复制配置、录制另存为配置 |
| 计划任务 | 按星期和时间自动运行指定配置 |
| 快捷键 | 按下设定式快捷键，支持启动/停止、录制/停止、紧急停止 |
| 外观 | 中文、日本語、English，主题切换，字体切换，托盘最小化 |
| 数据 | 配置备份/恢复，录制 JSON 导入/导出 |

### 基本流程

1. 在 `Profiles` 页面创建或选择配置。
2. 调整点击模式、间隔、次数、运行上限、坐标和随机化参数。
3. 需要复杂流程时进入 `Recording` 页面录制鼠标和键盘操作。
4. 录制后可以直接回放，也可以优化并转为可编辑序列，继续整理每个步骤的顺序和延迟。
5. 通过快捷键或计划任务启动自动化。

### 安全提示

自动化会影响当前桌面焦点。运行前请确认目标窗口、快捷键和停止方式，只在你有权限操作的软件和环境中使用。

## 日本語

TriClick Studio は、Tauri + TypeScript + Rust で作られた Windows 向けデスクトップ自動化ツールです。マウス連打、キーボード操作、マクロ記録と再生、シーケンス編集、複数プロファイル、スケジュール実行をひとつのサイバーパンク風コントロールパネルにまとめています。MiSans フォントも同梱されています。

### ダウンロード

最新版は [GitHub Releases](https://github.com/Hezamura/tri-clicker/releases) から入手できます。

| ファイル | 用途 |
| --- | --- |
| `TriClick-Studio-vX.Y.Z-portable.zip` | ポータブル版。展開してすぐ実行できます |
| `TriClick-Studio-vX.Y.Z-setup.exe` | インストーラー版。継続利用に向いています |

### 主な機能

| モジュール | 説明 |
| --- | --- |
| クリック方式 | 単発、ダブル、長押し、連打、キー連打、編集可能なシーケンス |
| 精密制御 | ミリ秒単位の間隔、開始遅延、実行上限、回数指定、無限ループ |
| ランダム化 | 間隔の揺れ、固定座標のランダム範囲 |
| 記録と再生 | マウス移動、押下/解放、ホイール、キー押下/解放を記録 |
| 記録最適化 | 密集したマウス移動を圧縮し、重要な軌跡と遅延を保持 |
| プロファイル | 複数設定、複製、記録から新規設定作成 |
| スケジュール | 曜日と時刻で指定プロファイルを実行 |
| ショートカット | キーを押して設定する方式。開始/停止、記録/停止、緊急停止に対応 |
| 外観 | 中文、日本語、English、テーマ切替、フォント切替、トレイ最小化 |
| データ | 設定バックアップ/復元、記録 JSON のインポート/エクスポート |

### 基本的な使い方

1. `Profiles` ページでプロファイルを選択または作成します。
2. クリック方式、間隔、回数、実行上限、座標、ランダム化を調整します。
3. 複雑な操作は `Recording` ページでマウスとキーボードを記録します。
4. 記録はそのまま再生でき、最適化して編集可能なシーケンスにも変換し、各手順の順序と遅延を調整できます。
5. ショートカットまたはスケジュールから自動化を開始します。

### 注意

自動化は現在のデスクトップフォーカスに作用します。対象ウィンドウ、ショートカット、停止方法を確認し、操作権限のある環境でのみ使用してください。

## English

TriClick Studio is a Windows desktop automation tool built with Tauri, TypeScript, and Rust. It combines mouse clicking, keyboard automation, macro recording and playback, sequence editing, multiple profiles, and scheduled tasks in a cyberpunk-inspired native control console. The app also ships with an embedded MiSans font.

### Download

Download the latest build from [GitHub Releases](https://github.com/Hezamura/tri-clicker/releases).

| File | Use case |
| --- | --- |
| `TriClick-Studio-vX.Y.Z-portable.zip` | Portable build. Unzip and run |
| `TriClick-Studio-vX.Y.Z-setup.exe` | Installer build for regular use |

### Features

| Area | Details |
| --- | --- |
| Click modes | Single click, double click, hold, burst, key tap, editable sequences |
| Precision | Millisecond intervals, start delay, run limit, fixed count, loop mode |
| Randomization | Interval jitter and random radius around fixed coordinates |
| Recording | Mouse movement, button down/up, wheel, key down/up |
| Recording cleanup | Compacts dense mouse movement while preserving key path points and timing |
| Profiles | Multiple profiles, duplication, save recording as profile |
| Scheduling | Run selected profiles by weekday and time |
| Hotkeys | Press-to-set hotkeys for start/stop, record/stop, and emergency stop |
| Interface | Chinese, Japanese, English, theme switching, font switching, tray minimize |
| Data | Backup/restore settings and import/export recording JSON |

### Basic Workflow

1. Open `Profiles` and choose or create a profile.
2. Tune the click mode, interval, count, run limit, coordinates, and randomization.
3. Use `Recording` for complex mouse and keyboard workflows.
4. Replay recordings directly, or optimize them and convert them into editable sequences with reorderable steps.
5. Start automation through a hotkey or a scheduled task.

### Safety

Automation affects the current desktop focus. Confirm the target window, hotkeys, and stop method before running, and only use it in software and environments where you have permission.
