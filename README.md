# TriClick Studio

<p align="center">
  <strong>一个用 Tauri + TypeScript + Rust 打造的三语桌面自动化工作台。</strong>
</p>

<p align="center">
  <a href="https://github.com/Hezamura/tri-clicker/releases">
    <img alt="Release" src="https://img.shields.io/github/v/release/Hezamura/tri-clicker?style=flat-square">
  </a>
  <a href="https://github.com/Hezamura/tri-clicker/actions/workflows/release.yml">
    <img alt="Release build" src="https://img.shields.io/github/actions/workflow/status/Hezamura/tri-clicker/release.yml?branch=main&style=flat-square">
  </a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-1677ff?style=flat-square">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.x-24c8db?style=flat-square">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-native-ea6b20?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-React-3178c6?style=flat-square">
</p>

<p align="center">
  <a href="./README.md">中文</a> ·
  <a href="./docs/README.i18n.md#日本語">日本語</a> ·
  <a href="./docs/README.i18n.md#english">English</a>
</p>

TriClick Studio 是一个面向 Windows 桌面流程的鼠标与键盘自动化工具。它把常见连点器、动作录制器、宏序列编辑器、计划任务和配置管理收在一个赛博朋克风格的原生桌面控制台里，适合重复点击、固定流程回放、轻量测试辅助和日常操作编排。

> 请只在你有权限操作的软件和环境中使用自动化功能。输入模拟可能影响当前桌面焦点，运行前建议确认目标窗口、热键和停止方式。

## Download

从 [GitHub Releases](https://github.com/Hezamura/tri-clicker/releases) 下载最新版本：

| 版本 | 适合场景 | 文件 |
| --- | --- | --- |
| Portable | 免安装、临时使用、U 盘携带 | `TriClick-Studio-vX.Y.Z-portable.zip` |
| Installer | 长期使用、开始菜单和卸载入口 | `TriClick-Studio-vX.Y.Z-setup.exe` |

发布由 GitHub Actions 自动构建。推送 `v*` 标签后会同时生成便携版 zip 和 Windows 安装包。

## Highlights

| 模块 | 能力 |
| --- | --- |
| 精准连点 | 单击、双击、长按、爆发点击、键盘连按、序列模式 |
| 间隔控制 | 毫秒级间隔、启动延迟、随机抖动、随机半径 |
| 次数控制 | 固定次数、无限循环、运行时长上限、手动停止 |
| 宏录制 | 录制鼠标移动、点击、滚轮、键盘按下与松开 |
| 宏文件 | 导出/导入录制 JSON，一键优化录制，把录制转成可编辑序列 |
| 配置管理 | 多组 profile，录制内容可另存为新配置 |
| 计划任务 | 在应用内创建可启停的定时自动化任务 |
| 快捷键 | 按下设定式全局快捷键，支持自定义开始/停止 |
| 体验 | Cyberpunk 默认主题，中/日/英界面，主题切换，字体切换，托盘最小化 |
| 备份 | 配置、计划、设置、热键一键 JSON 备份与恢复 |

## Macro Workflow

1. 进入 `Recording` 页面并开始录制。
2. 操作鼠标和键盘，TriClick Studio 会保留事件延迟和动作细节。
3. 录制完成后可以直接播放，也可以导出为 `triclick-recording-YYYY-MM-DD.json`。
4. 需要复用时导入录制文件，或点击 `Use as sequence` 转到序列编辑器。
5. 使用 `Optimize recording` 清理密集鼠标移动事件，保留关键轨迹点和延迟节奏。
6. 序列里可以继续微调动作、坐标、按键、延迟、长按时间，并用上下移动整理点击顺序。
7. 满意后保存为 profile，再配合计划任务或快捷键运行。

当前序列动作包括：

| 动作 | 用途 |
| --- | --- |
| `click` | 在坐标处点击指定鼠标键 |
| `move` | 移动鼠标到指定坐标 |
| `key` | 完整按下并松开一个键 |
| `keyDown` / `keyUp` | 精细控制键盘按下和松开 |
| `mouseDown` / `mouseUp` | 精细控制鼠标按下和松开 |
| `wheel` | 回放滚轮事件 |

## Tech Stack

| 层 | 技术 |
| --- | --- |
| Desktop shell | Tauri 2 |
| Native automation | Rust, rdev |
| Frontend | React, TypeScript, Vite |
| Icons | lucide-react |
| Font | Embedded `MiSans-Medium.ttf` |
| Release | GitHub Actions, Windows runner |

## Development

准备环境：

```powershell
npm install
```

启动开发版：

```powershell
npm run tauri dev
```

只检查前端生产构建：

```powershell
npm run build
```

构建完整 Tauri 包：

```powershell
npm run tauri build
```

如果 Windows 安装器依赖下载超时，可以先构建免安装 exe：

```powershell
npm run tauri:exe
```

Rust 检查：

```powershell
cd src-tauri
cargo check
```

## Project Layout

```text
.
├─ src/                  React UI and desktop interaction state
├─ src/assets/fonts/     Embedded MiSans font
├─ src-tauri/            Rust commands, recorder, tray, native automation
├─ .github/workflows/    Release automation
└─ dist/                 Frontend build output
```

## Release Checklist

1. 更新 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 版本号。
2. 运行 `npm run build`、`cargo check`、`cargo fmt --check`。
3. 提交改动并推送 `main`。
4. 创建并推送版本标签，例如：

```powershell
git tag -a v0.3.0 -m "TriClick Studio v0.3.0"
git push origin v0.3.0
```

5. 在 [Actions](https://github.com/Hezamura/tri-clicker/actions) 等待 Release workflow 完成。
6. 在 [Releases](https://github.com/Hezamura/tri-clicker/releases) 检查便携版和安装包是否上传成功。

## Roadmap

- 图像/颜色检测点击目标
- 更多序列模板和动作分组
- 计划任务日历视图
- 配置导入冲突预览
- 更多 Cyberpunk 子主题和界面预设

## Star History

<p align="center">
  <a href="https://www.star-history.com/#Hezamura/tri-clicker&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Hezamura/tri-clicker&type=Date&theme=dark">
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Hezamura/tri-clicker&type=Date">
    </picture>
  </a>
</p>

## License

This project currently has no explicit license file. Add one before accepting external contributions.
