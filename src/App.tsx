import {
  AlarmClock,
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ClipboardList,
  Copy,
  Download,
  Gauge,
  Keyboard,
  Languages,
  ListChecks,
  Minimize2,
  MousePointerClick,
  Palette,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  Video,
  Wand2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type Language = "zh" | "ja" | "en";
type ThemeName = "cyberpunk" | "graphite" | "sakura" | "forest" | "paper";
type FontName = "MiSans" | "System" | "Serif" | "Mono" | "Custom";
type ClickMode = "single" | "double" | "hold" | "burst" | "keyTap" | "sequence";
type MouseButtonName = "Left" | "Right" | "Middle";
type TabName = "profiles" | "recording" | "schedule" | "settings";
type StepAction =
  | "click"
  | "move"
  | "key"
  | "keyDown"
  | "keyUp"
  | "mouseDown"
  | "mouseUp"
  | "wheel";

type Translation = Record<string, string>;

type ClickStep = {
  id: string;
  action: StepAction;
  button: MouseButtonName;
  x: number;
  y: number;
  delayMs: number;
  holdMs: number;
  key: string;
};

type Profile = {
  id: string;
  name: string;
  accent: string;
  button: MouseButtonName;
  mode: ClickMode;
  intervalMs: number;
  initialDelayMs: number;
  count: number;
  repeatForever: boolean;
  maxDurationMs: number;
  holdMs: number;
  jitterMs: number;
  randomRadius: number;
  burstSize: number;
  tapKey: string;
  targetMode: "current" | "fixed";
  x: number;
  y: number;
  sequence: ClickStep[];
};

type ScheduleTask = {
  id: string;
  name: string;
  profileId: string;
  enabled: boolean;
  time: string;
  days: number[];
  lastRunKey?: string;
};

type RecordedInput = {
  kind: string;
  detail: string;
  x?: number;
  y?: number;
  delayMs: number;
  timestampMs: number;
};

type HotkeyConfig = {
  startStop: string[];
  recordStop: string[];
  playbackStop: string[];
};

type RuntimeStatus = {
  running: boolean;
  recording: boolean;
  recordedCount: number;
  hotkeys: HotkeyConfig;
};

type BackendEvent = {
  action: string;
  message: string;
  at: string;
};

type Settings = {
  language: Language;
  theme: ThemeName;
  font: FontName;
  customFont: string;
  density: "cozy" | "compact";
};

type BackupPayload = {
  version: number;
  exportedAt: string;
  profiles: Profile[];
  activeProfileId: string;
  schedules: ScheduleTask[];
  settings: Settings;
  hotkeys: HotkeyConfig;
};

type RecordingPayload = {
  version: number;
  exportedAt: string;
  name: string;
  events: RecordedInput[];
};

const translations: Record<Language, Translation> = {
  zh: {
    app: "TriClick Studio",
    statusReady: "就绪",
    statusRunning: "运行中",
    statusRecording: "录制中",
    start: "启动",
    stop: "停止",
    record: "录制",
    finish: "完成",
    playRecording: "播放录制",
    profiles: "配置",
    recording: "录制",
    schedule: "计划",
    settings: "设置",
    currentProfile: "当前配置",
    addProfile: "添加配置",
    duplicate: "复制",
    delete: "删除",
    save: "保存",
    mode: "点击模式",
    button: "按键",
    interval: "间隔",
    count: "次数",
    runDuration: "运行上限",
    forever: "无限循环",
    initialDelay: "启动延迟",
    hold: "按住",
    jitter: "随机抖动",
    radius: "随机半径",
    burst: "连发数量",
    tapKey: "连按按键",
    target: "目标",
    currentCursor: "当前光标",
    fixedPoint: "固定坐标",
    x: "X",
    y: "Y",
    single: "单击",
    double: "双击",
    holdMode: "长按",
    burstMode: "连发",
    keyTapMode: "键盘连按",
    sequence: "序列",
    left: "左键",
    right: "右键",
    middle: "中键",
    sequenceEditor: "序列编辑",
    addStep: "添加步骤",
    clear: "清空",
    events: "事件",
    noRecording: "还没有录制事件",
    recordingHint: "按录制后操作鼠标键盘",
    exportRecording: "导出录制",
    importRecording: "导入录制",
    optimizeRecording: "优化录制",
    applyRecordingSequence: "转为当前序列",
    saveRecordingProfile: "另存为配置",
    recordingReady: "录制文件已导出",
    recordingLoaded: "录制文件已导入",
    recordingImportFailed: "录制文件无法导入",
    recordingOptimized: "录制已优化，移除 {count} 个事件",
    recordingClean: "录制已经足够干净",
    recordingConverted: "录制已转为当前序列",
    recordingProfileCreated: "已从录制创建配置",
    duration: "时长",
    moves: "移动",
    keysStat: "键盘",
    mouseStat: "鼠标",
    cps: "CPS",
    playbackSpeed: "播放速度",
    schedules: "计划任务",
    addSchedule: "添加计划",
    time: "时间",
    enabled: "启用",
    days: "星期",
    theme: "主题",
    font: "字体",
    language: "语言",
    density: "密度",
    cozy: "舒适",
    compact: "紧凑",
    hotkeys: "快捷键",
    startStopHotkey: "启动/停止",
    recordHotkey: "录制/停止",
    emergencyHotkey: "紧急停止",
    setHotkey: "设定",
    pressHotkey: "请按快捷键",
    cancel: "取消",
    minimizeTray: "最小化托盘",
    activity: "运行日志",
    apply: "应用",
    customFont: "自定义字体名",
    backup: "备份与恢复",
    exportBackup: "导出配置",
    importBackup: "导入配置",
    backupReady: "配置备份已导出",
    backupLoaded: "配置备份已导入",
    importFailed: "配置文件无法导入",
    monday: "一",
    tuesday: "二",
    wednesday: "三",
    thursday: "四",
    friday: "五",
    saturday: "六",
    sunday: "日",
    graph: "石墨",
    cyberpunk: "赛博朋克",
    sakura: "樱色",
    forest: "森林",
    paper: "纸面",
    add: "添加",
    stepClick: "点击",
    stepMove: "移动",
    stepKey: "按键",
    stepKeyDown: "按下键",
    stepKeyUp: "松开键",
    stepMouseDown: "按下鼠标",
    stepMouseUp: "松开鼠标",
    stepWheel: "滚轮",
    moveUp: "上移",
    moveDown: "下移",
    delay: "延迟",
    key: "键",
    simulated: "浏览器预览模式，桌面命令会在 Tauri 中执行",
  },
  ja: {
    app: "TriClick Studio",
    statusReady: "待機中",
    statusRunning: "実行中",
    statusRecording: "記録中",
    start: "開始",
    stop: "停止",
    record: "記録",
    finish: "完了",
    playRecording: "記録を再生",
    profiles: "設定",
    recording: "記録",
    schedule: "予定",
    settings: "調整",
    currentProfile: "現在の設定",
    addProfile: "設定を追加",
    duplicate: "複製",
    delete: "削除",
    save: "保存",
    mode: "クリック方式",
    button: "ボタン",
    interval: "間隔",
    count: "回数",
    runDuration: "実行上限",
    forever: "無限ループ",
    initialDelay: "開始遅延",
    hold: "保持",
    jitter: "ランダム揺れ",
    radius: "ランダム範囲",
    burst: "連打数",
    tapKey: "連打キー",
    target: "対象",
    currentCursor: "現在位置",
    fixedPoint: "固定座標",
    x: "X",
    y: "Y",
    single: "単発",
    double: "ダブル",
    holdMode: "長押し",
    burstMode: "連打",
    keyTapMode: "キー連打",
    sequence: "シーケンス",
    left: "左",
    right: "右",
    middle: "中央",
    sequenceEditor: "シーケンス編集",
    addStep: "手順を追加",
    clear: "クリア",
    events: "イベント",
    noRecording: "記録イベントはまだありません",
    recordingHint: "記録中にマウスとキーボードを操作",
    exportRecording: "記録を書き出す",
    importRecording: "記録を読み込む",
    optimizeRecording: "記録を最適化",
    applyRecordingSequence: "現在のシーケンスへ",
    saveRecordingProfile: "設定として保存",
    recordingReady: "記録を書き出しました",
    recordingLoaded: "記録を読み込みました",
    recordingImportFailed: "記録ファイルを読み込めません",
    recordingOptimized: "記録を最適化し、{count} 件を削除しました",
    recordingClean: "記録はすでに整理されています",
    recordingConverted: "記録を現在のシーケンスへ変換しました",
    recordingProfileCreated: "記録から設定を作成しました",
    duration: "時間",
    moves: "移動",
    keysStat: "キー",
    mouseStat: "マウス",
    cps: "CPS",
    playbackSpeed: "再生速度",
    schedules: "予定タスク",
    addSchedule: "予定を追加",
    time: "時刻",
    enabled: "有効",
    days: "曜日",
    theme: "テーマ",
    font: "フォント",
    language: "言語",
    density: "密度",
    cozy: "ゆったり",
    compact: "コンパクト",
    hotkeys: "ショートカット",
    startStopHotkey: "開始/停止",
    recordHotkey: "記録/停止",
    emergencyHotkey: "緊急停止",
    setHotkey: "設定",
    pressHotkey: "キーを押してください",
    cancel: "キャンセル",
    minimizeTray: "トレイへ最小化",
    activity: "ログ",
    apply: "適用",
    customFont: "カスタムフォント名",
    backup: "バックアップと復元",
    exportBackup: "設定を書き出す",
    importBackup: "設定を読み込む",
    backupReady: "設定を書き出しました",
    backupLoaded: "設定を読み込みました",
    importFailed: "設定ファイルを読み込めません",
    monday: "月",
    tuesday: "火",
    wednesday: "水",
    thursday: "木",
    friday: "金",
    saturday: "土",
    sunday: "日",
    graph: "グラファイト",
    cyberpunk: "サイバーパンク",
    sakura: "桜",
    forest: "森",
    paper: "紙",
    add: "追加",
    stepClick: "クリック",
    stepMove: "移動",
    stepKey: "キー",
    stepKeyDown: "キー押下",
    stepKeyUp: "キー解放",
    stepMouseDown: "マウス押下",
    stepMouseUp: "マウス解放",
    stepWheel: "ホイール",
    moveUp: "上へ",
    moveDown: "下へ",
    delay: "遅延",
    key: "キー",
    simulated: "ブラウザプレビューです。デスクトップ操作は Tauri で実行されます",
  },
  en: {
    app: "TriClick Studio",
    statusReady: "Ready",
    statusRunning: "Running",
    statusRecording: "Recording",
    start: "Start",
    stop: "Stop",
    record: "Record",
    finish: "Finish",
    playRecording: "Play recording",
    profiles: "Profiles",
    recording: "Recording",
    schedule: "Schedule",
    settings: "Settings",
    currentProfile: "Current profile",
    addProfile: "Add profile",
    duplicate: "Duplicate",
    delete: "Delete",
    save: "Save",
    mode: "Click mode",
    button: "Button",
    interval: "Interval",
    count: "Count",
    runDuration: "Run limit",
    forever: "Loop",
    initialDelay: "Start delay",
    hold: "Hold",
    jitter: "Jitter",
    radius: "Random radius",
    burst: "Burst size",
    tapKey: "Tap key",
    target: "Target",
    currentCursor: "Current cursor",
    fixedPoint: "Fixed point",
    x: "X",
    y: "Y",
    single: "Single",
    double: "Double",
    holdMode: "Hold",
    burstMode: "Burst",
    keyTapMode: "Key tap",
    sequence: "Sequence",
    left: "Left",
    right: "Right",
    middle: "Middle",
    sequenceEditor: "Sequence editor",
    addStep: "Add step",
    clear: "Clear",
    events: "Events",
    noRecording: "No recorded events yet",
    recordingHint: "Use mouse and keyboard while recording",
    exportRecording: "Export recording",
    importRecording: "Import recording",
    optimizeRecording: "Optimize recording",
    applyRecordingSequence: "Use as sequence",
    saveRecordingProfile: "Save as profile",
    recordingReady: "Recording exported",
    recordingLoaded: "Recording imported",
    recordingImportFailed: "Could not import recording",
    recordingOptimized: "Recording optimized, removed {count} events",
    recordingClean: "Recording is already clean",
    recordingConverted: "Recording applied to current sequence",
    recordingProfileCreated: "Profile created from recording",
    duration: "Duration",
    moves: "Moves",
    keysStat: "Keys",
    mouseStat: "Mouse",
    cps: "CPS",
    playbackSpeed: "Playback speed",
    schedules: "Scheduled tasks",
    addSchedule: "Add task",
    time: "Time",
    enabled: "Enabled",
    days: "Days",
    theme: "Theme",
    font: "Font",
    language: "Language",
    density: "Density",
    cozy: "Cozy",
    compact: "Compact",
    hotkeys: "Hotkeys",
    startStopHotkey: "Start/stop",
    recordHotkey: "Record/stop",
    emergencyHotkey: "Emergency stop",
    setHotkey: "Set",
    pressHotkey: "Press keys",
    cancel: "Cancel",
    minimizeTray: "Minimize to tray",
    activity: "Activity",
    apply: "Apply",
    customFont: "Custom font name",
    backup: "Backup and restore",
    exportBackup: "Export backup",
    importBackup: "Import backup",
    backupReady: "Backup exported",
    backupLoaded: "Backup imported",
    importFailed: "Could not import backup",
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
    graph: "Graphite",
    cyberpunk: "Cyberpunk",
    sakura: "Sakura",
    forest: "Forest",
    paper: "Paper",
    add: "Add",
    stepClick: "Click",
    stepMove: "Move",
    stepKey: "Key",
    stepKeyDown: "Key down",
    stepKeyUp: "Key up",
    stepMouseDown: "Mouse down",
    stepMouseUp: "Mouse up",
    stepWheel: "Wheel",
    moveUp: "Move up",
    moveDown: "Move down",
    delay: "Delay",
    key: "Key",
    simulated: "Browser preview mode. Desktop commands run inside Tauri.",
  },
};

const themeLabels: Record<ThemeName, keyof Translation> = {
  cyberpunk: "cyberpunk",
  graphite: "graph",
  sakura: "sakura",
  forest: "forest",
  paper: "paper",
};

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const modeLabels: Record<ClickMode, keyof Translation> = {
  single: "single",
  double: "double",
  hold: "holdMode",
  burst: "burstMode",
  keyTap: "keyTapMode",
  sequence: "sequence",
};

const stepActionLabels: Record<StepAction, keyof Translation> = {
  click: "stepClick",
  move: "stepMove",
  key: "stepKey",
  keyDown: "stepKeyDown",
  keyUp: "stepKeyUp",
  mouseDown: "stepMouseDown",
  mouseUp: "stepMouseUp",
  wheel: "stepWheel",
};

const buttonLabels: Record<MouseButtonName, keyof Translation> = {
  Left: "left",
  Right: "right",
  Middle: "middle",
};

const defaultSequence: ClickStep[] = [
  {
    id: "step-1",
    action: "click",
    button: "Left",
    x: 640,
    y: 360,
    delayMs: 0,
    holdMs: 18,
    key: "A",
  },
  {
    id: "step-2",
    action: "key",
    button: "Left",
    x: 640,
    y: 360,
    delayMs: 120,
    holdMs: 18,
    key: "Space",
  },
];

const defaultProfiles: Profile[] = [
  {
    id: "profile-main",
    name: "Daily Tap",
    accent: "#28f7ff",
    button: "Left",
    mode: "single",
    intervalMs: 80,
    initialDelayMs: 300,
    count: 100,
    repeatForever: false,
    maxDurationMs: 0,
    holdMs: 18,
    jitterMs: 0,
    randomRadius: 0,
    burstSize: 3,
    tapKey: "Space",
    targetMode: "current",
    x: 640,
    y: 360,
    sequence: defaultSequence,
  },
  {
    id: "profile-burst",
    name: "Burst Check",
    accent: "#ff3df2",
    button: "Left",
    mode: "burst",
    intervalMs: 250,
    initialDelayMs: 500,
    count: 20,
    repeatForever: false,
    maxDurationMs: 0,
    holdMs: 15,
    jitterMs: 12,
    randomRadius: 4,
    burstSize: 5,
    tapKey: "Space",
    targetMode: "fixed",
    x: 820,
    y: 460,
    sequence: defaultSequence,
  },
];

const defaultSchedules: ScheduleTask[] = [
  {
    id: "schedule-1",
    name: "Morning check",
    profileId: "profile-main",
    enabled: false,
    time: "09:00",
    days: [1, 2, 3, 4, 5],
  },
];

const defaultSettings: Settings = {
  language: "zh",
  theme: "cyberpunk",
  font: "MiSans",
  customFont: "MiSans",
  density: "cozy",
};

const defaultHotkeys: HotkeyConfig = {
  startStop: ["F6"],
  recordStop: ["F7"],
  playbackStop: ["Escape"],
};

const normalizeProfile = (profile: Profile): Profile => ({
  ...profile,
  maxDurationMs: profile.maxDurationMs ?? 0,
  tapKey: profile.tapKey ?? "Space",
  sequence: Array.isArray(profile.sequence) ? profile.sequence : defaultSequence,
});

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const readStore = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStore = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled in previews.
  }
};

const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== "object") return false;
  const backup = value as Partial<BackupPayload>;
  return (
    Array.isArray(backup.profiles) &&
    backup.profiles.length > 0 &&
    typeof backup.activeProfileId === "string" &&
    Array.isArray(backup.schedules) &&
    Boolean(backup.settings) &&
    Boolean(backup.hotkeys)
  );
};

const isRecordedInput = (value: unknown): value is RecordedInput => {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<RecordedInput>;
  return (
    typeof event.kind === "string" &&
    typeof event.detail === "string" &&
    typeof event.delayMs === "number" &&
    typeof event.timestampMs === "number" &&
    (event.x === undefined || typeof event.x === "number") &&
    (event.y === undefined || typeof event.y === "number")
  );
};

const isRecordingPayload = (value: unknown): value is RecordingPayload => {
  if (!value || typeof value !== "object") return false;
  const recording = value as Partial<RecordingPayload>;
  return (
    typeof recording.name === "string" &&
    Array.isArray(recording.events) &&
    recording.events.length <= 10_000 &&
    recording.events.every(isRecordedInput)
  );
};

const downloadJson = (fileName: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const comboToString = (combo: string[]) => combo.join("+");

const clampNumber = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

const formatDuration = (value: number) => {
  const ms = clampNumber(Math.round(value), 0, 24 * 60 * 60 * 1000);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
};

const actionUsesKey = (action: StepAction) =>
  action === "key" || action === "keyDown" || action === "keyUp" || action === "wheel";

const actionUsesPosition = (action: StepAction) =>
  action === "click" || action === "move" || action === "mouseDown" || action === "mouseUp";

const actionUsesHold = (action: StepAction) => action === "click" || action === "key";

const buttonFromDetail = (detail: string, fallback: MouseButtonName): MouseButtonName => {
  if (detail === "Right") return "Right";
  if (detail === "Middle") return "Middle";
  if (detail === "Left") return "Left";
  return fallback;
};

const eventDistance = (a: RecordedInput, b: RecordedInput) => {
  if (
    typeof a.x !== "number" ||
    typeof a.y !== "number" ||
    typeof b.x !== "number" ||
    typeof b.y !== "number"
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const compactMoveRun = (events: RecordedInput[]) => {
  if (events.length <= 2) return events.map((event) => ({ ...event }));

  const compacted: RecordedInput[] = [];
  let carriedDelay = 0;
  let lastKept: RecordedInput | undefined;

  events.forEach((event, index) => {
    const candidate = {
      ...event,
      delayMs: clampNumber(Math.round(event.delayMs + carriedDelay), 0, 3_600_000),
    };
    const isBoundary = index === 0 || index === events.length - 1;
    const elapsed = lastKept ? candidate.timestampMs - lastKept.timestampMs : Number.POSITIVE_INFINITY;
    const distance = lastKept ? eventDistance(candidate, lastKept) : Number.POSITIVE_INFINITY;
    const shouldKeep = isBoundary || elapsed >= 90 || distance >= 64;

    if (shouldKeep) {
      compacted.push(candidate);
      carriedDelay = 0;
      lastKept = candidate;
      return;
    }

    carriedDelay += event.delayMs;
  });

  return compacted;
};

const optimizeRecordedEvents = (events: RecordedInput[]) => {
  const optimized: RecordedInput[] = [];
  let moveRun: RecordedInput[] = [];

  const flushMoves = () => {
    if (!moveRun.length) return;
    optimized.push(...compactMoveRun(moveRun));
    moveRun = [];
  };

  events.forEach((event) => {
    if (event.kind === "mouseMove") {
      moveRun.push(event);
      return;
    }
    flushMoves();
    optimized.push({ ...event });
  });

  flushMoves();
  return optimized;
};

const summarizeRecording = (events: RecordedInput[]) => ({
  total: events.length,
  durationMs: events.reduce((sum, event) => sum + event.delayMs, 0),
  moves: events.filter((event) => event.kind === "mouseMove").length,
  keys: events.filter((event) => event.kind.startsWith("key")).length,
  mouse: events.filter(
    (event) =>
      event.kind === "buttonPress" || event.kind === "buttonRelease" || event.kind === "wheel",
  ).length,
});

const recordingToSequence = (events: RecordedInput[], base: Profile): ClickStep[] => {
  let lastX = base.x;
  let lastY = base.y;
  return events.map((event) => {
    if (typeof event.x === "number") lastX = event.x;
    if (typeof event.y === "number") lastY = event.y;

    const step: ClickStep = {
      id: uid("step"),
      action: "move",
      button: base.button,
      x: Math.round(lastX),
      y: Math.round(lastY),
      delayMs: clampNumber(Math.round(event.delayMs), 0, 3_600_000),
      holdMs: base.holdMs,
      key: "Space",
    };

    switch (event.kind) {
      case "keyPress":
        return { ...step, action: "keyDown", key: event.detail };
      case "keyRelease":
        return { ...step, action: "keyUp", key: event.detail };
      case "buttonPress":
        return { ...step, action: "mouseDown", button: buttonFromDetail(event.detail, base.button) };
      case "buttonRelease":
        return { ...step, action: "mouseUp", button: buttonFromDetail(event.detail, base.button) };
      case "wheel":
        return { ...step, action: "wheel", key: event.detail };
      default:
        return { ...step, action: "move" };
    }
  });
};

const normalizeBrowserKey = (key: string) => {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
};

const comboFromKeyEvent = (event: KeyboardEvent) => {
  const modifierKeys = new Set(["Control", "Shift", "Alt", "Meta"]);
  const mainKey = normalizeBrowserKey(event.key);

  if (modifierKeys.has(mainKey)) {
    return [];
  }

  const combo: string[] = [];
  if (event.ctrlKey) combo.push("Control");
  if (event.altKey) combo.push("Alt");
  if (event.shiftKey) combo.push("Shift");
  if (event.metaKey) combo.push("Meta");
  combo.push(mainKey);
  return combo;
};

function App() {
  const [profiles, setProfiles] = useState<Profile[]>(() =>
    readStore<Profile[]>("tri.profiles", defaultProfiles).map(normalizeProfile),
  );
  const [activeProfileId, setActiveProfileId] = useState(() =>
    readStore("tri.activeProfileId", defaultProfiles[0].id),
  );
  const [schedules, setSchedules] = useState<ScheduleTask[]>(() =>
    readStore("tri.schedules", defaultSchedules),
  );
  const [settings, setSettings] = useState<Settings>(() =>
    readStore("tri.settings", defaultSettings),
  );
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() =>
    readStore("tri.hotkeys", defaultHotkeys),
  );
  const [activeTab, setActiveTab] = useState<TabName>("profiles");
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<RecordedInput[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activity, setActivity] = useState<string[]>([]);
  const [tickCount, setTickCount] = useState(0);
  const [previewNotice, setPreviewNotice] = useState(!isTauriRuntime());
  const backupInputRef = useRef<HTMLInputElement>(null);
  const recordingInputRef = useRef<HTMLInputElement>(null);

  const t = translations[settings.language];
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0],
    [activeProfileId, profiles],
  );
  const recordingStats = useMemo(() => summarizeRecording(recorded), [recorded]);
  const optimizedRecordingCount = useMemo(
    () => (recorded.length ? optimizeRecordedEvents(recorded).length : 0),
    [recorded],
  );
  const estimatedCps = useMemo(() => {
    if (!activeProfile) return 0;
    const clicksPerCycle =
      activeProfile.mode === "double"
        ? 2
        : activeProfile.mode === "burst"
          ? activeProfile.burstSize
          : 1;
    return (1000 / Math.max(1, activeProfile.intervalMs)) * clicksPerCycle;
  }, [activeProfile]);
  const latestRef = useRef({ profiles, schedules, running, activeProfileId });

  useEffect(() => {
    latestRef.current = { profiles, schedules, running, activeProfileId };
  }, [profiles, schedules, running, activeProfileId]);

  useEffect(() => writeStore("tri.profiles", profiles), [profiles]);
  useEffect(() => writeStore("tri.activeProfileId", activeProfileId), [activeProfileId]);
  useEffect(() => writeStore("tri.schedules", schedules), [schedules]);
  useEffect(() => writeStore("tri.settings", settings), [settings]);
  useEffect(() => writeStore("tri.hotkeys", hotkeys), [hotkeys]);

  const log = useCallback((message: string) => {
    const stamped = `${new Date().toLocaleTimeString()}  ${message}`;
    setActivity((items) => [stamped, ...items].slice(0, 12));
  }, []);

  const safeInvoke = useCallback(
    async <T,>(command: string, args?: Record<string, unknown>, fallback?: T): Promise<T> => {
      if (!isTauriRuntime()) {
        setPreviewNotice(true);
        return fallback as T;
      }
      return invoke<T>(command, args);
    },
    [],
  );

  const syncHotkeys = useCallback(
    async (nextHotkeys: HotkeyConfig) => {
      setHotkeys(nextHotkeys);
      await safeInvoke("set_hotkeys", { config: nextHotkeys }, undefined);
    },
    [safeInvoke],
  );

  const setHotkeyCapture = useCallback(
    async (active: boolean) => {
      await safeInvoke("set_hotkey_capture", { active }, undefined);
    },
    [safeInvoke],
  );

  const exportBackup = useCallback(() => {
    const backup: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles,
      activeProfileId,
      schedules,
      settings,
      hotkeys,
    };
    downloadJson(`triclick-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
    log(t.backupReady);
  }, [activeProfileId, hotkeys, log, profiles, schedules, settings, t.backupReady]);

  const importBackup = useCallback(
    async (file: File) => {
      try {
        const backup = JSON.parse(await file.text()) as unknown;
        if (!isBackupPayload(backup)) {
          throw new Error("Invalid backup payload.");
        }

        const nextActiveProfileId = backup.profiles.some(
          (profile) => profile.id === backup.activeProfileId,
        )
          ? backup.activeProfileId
          : backup.profiles[0].id;

        setProfiles(backup.profiles.map(normalizeProfile));
        setActiveProfileId(nextActiveProfileId);
        setSchedules(backup.schedules);
        setSettings(backup.settings);
        await syncHotkeys(backup.hotkeys);
        log(t.backupLoaded);
      } catch {
        log(t.importFailed);
      }
    },
    [log, syncHotkeys, t.backupLoaded, t.importFailed],
  );

  const startProfile = useCallback(
    async (profile: Profile) => {
      const config = {
        button: profile.button,
        mode: profile.mode,
        tapKey: profile.tapKey,
        intervalMs: clampNumber(profile.intervalMs, 1, 3_600_000),
        initialDelayMs: clampNumber(profile.initialDelayMs, 0, 3_600_000),
        count: clampNumber(profile.count, 1, 1_000_000),
        repeatForever: profile.repeatForever,
        maxDurationMs: clampNumber(profile.maxDurationMs, 0, 86_400_000),
        holdMs: clampNumber(profile.holdMs, 1, 60_000),
        jitterMs: clampNumber(profile.jitterMs, 0, 60_000),
        randomRadius: clampNumber(profile.randomRadius, 0, 9999),
        burstSize: clampNumber(profile.burstSize, 1, 1000),
        x: profile.targetMode === "fixed" ? profile.x : null,
        y: profile.targetMode === "fixed" ? profile.y : null,
        sequence: profile.sequence.map((step) => ({
          action: step.action,
          button: step.button,
          x: step.x,
          y: step.y,
          delayMs: step.delayMs,
          holdMs: step.holdMs,
          key: step.key,
        })),
      };
      await safeInvoke("start_clicker", { config }, undefined);
      setRunning(true);
      setTickCount(0);
      log(`${t.start}: ${profile.name}`);
    },
    [log, safeInvoke, t.start],
  );

  const stopAutomation = useCallback(async () => {
    await safeInvoke("stop_clicker", undefined, undefined);
    setRunning(false);
    log(t.stop);
  }, [log, safeInvoke, t.stop]);

  const toggleRun = useCallback(async () => {
    if (!activeProfile) return;
    if (running) {
      await stopAutomation();
    } else {
      await startProfile(activeProfile);
    }
  }, [activeProfile, running, startProfile, stopAutomation]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      const events = await safeInvoke<RecordedInput[]>(
        "stop_recording",
        undefined,
        recorded,
      );
      setRecording(false);
      setRecorded(events ?? recorded);
      log(t.finish);
      return;
    }
    await safeInvoke("start_recording", undefined, undefined);
    setRecorded([]);
    setRecording(true);
    log(t.record);
  }, [log, recorded, recording, safeInvoke, t.finish, t.record]);

  const playRecorded = useCallback(async () => {
    if (!recorded.length) return;
    await safeInvoke("play_recording", { events: recorded, speed: playbackSpeed }, undefined);
    setRunning(true);
    log(t.playRecording);
  }, [log, playbackSpeed, recorded, safeInvoke, t.playRecording]);

  const updateActiveProfile = useCallback(
    (patch: Partial<Profile>) => {
      if (!activeProfile) return;
      setProfiles((items) =>
        items.map((profile) =>
          profile.id === activeProfile.id ? { ...profile, ...patch } : profile,
        ),
      );
    },
    [activeProfile],
  );

  const exportRecording = useCallback(() => {
    if (!recorded.length) return;
    const payload: RecordingPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      name: activeProfile?.name ?? "TriClick Recording",
      events: recorded,
    };
    downloadJson(`triclick-recording-${new Date().toISOString().slice(0, 10)}.json`, payload);
    log(t.recordingReady);
  }, [activeProfile?.name, log, recorded, t.recordingReady]);

  const importRecording = useCallback(
    async (file: File) => {
      try {
        const payload = JSON.parse(await file.text()) as unknown;
        if (!isRecordingPayload(payload)) {
          throw new Error("Invalid recording payload.");
        }
        setRecorded(payload.events);
        log(t.recordingLoaded);
      } catch {
        log(t.recordingImportFailed);
      }
    },
    [log, t.recordingImportFailed, t.recordingLoaded],
  );

  const optimizeRecording = useCallback(() => {
    if (!recorded.length) return;
    const optimized = optimizeRecordedEvents(recorded);
    const removed = recorded.length - optimized.length;
    if (removed <= 0) {
      log(t.recordingClean);
      return;
    }
    setRecorded(optimized);
    log(t.recordingOptimized.replace("{count}", String(removed)));
  }, [log, recorded, t.recordingClean, t.recordingOptimized]);

  const applyRecordingToSequence = useCallback(() => {
    if (!activeProfile || !recorded.length) return;
    updateActiveProfile({
      mode: "sequence",
      sequence: recordingToSequence(recorded, activeProfile),
    });
    setActiveTab("profiles");
    log(t.recordingConverted);
  }, [activeProfile, log, recorded, t.recordingConverted, updateActiveProfile]);

  const saveRecordingAsProfile = useCallback(() => {
    if (!activeProfile || !recorded.length) return;
    const next: Profile = {
      ...activeProfile,
      id: uid("profile"),
      name: `${activeProfile.name} Recording`,
      mode: "sequence",
      count: 1,
      repeatForever: false,
      sequence: recordingToSequence(recorded, activeProfile),
    };
    setProfiles((items) => [...items, next]);
    setActiveProfileId(next.id);
    setActiveTab("profiles");
    log(t.recordingProfileCreated);
  }, [activeProfile, log, recorded, t.recordingProfileCreated]);

  const addProfile = () => {
    const base = activeProfile ?? defaultProfiles[0];
    const next: Profile = {
      ...base,
      id: uid("profile"),
      name: `${base.name} ${profiles.length + 1}`,
      accent: ["#26b7a0", "#ef6f61", "#4f8fef", "#d99b2b"][profiles.length % 4],
      sequence: base.sequence.map((step) => ({ ...step, id: uid("step") })),
    };
    setProfiles((items) => [...items, next]);
    setActiveProfileId(next.id);
  };

  const duplicateProfile = () => {
    if (!activeProfile) return;
    const next = {
      ...activeProfile,
      id: uid("profile"),
      name: `${activeProfile.name} Copy`,
      sequence: activeProfile.sequence.map((step) => ({ ...step, id: uid("step") })),
    };
    setProfiles((items) => [...items, next]);
    setActiveProfileId(next.id);
  };

  const deleteProfile = () => {
    if (!activeProfile || profiles.length === 1) return;
    const nextProfiles = profiles.filter((profile) => profile.id !== activeProfile.id);
    setProfiles(nextProfiles);
    setActiveProfileId(nextProfiles[0].id);
  };

  const addSchedule = () => {
    const profile = activeProfile ?? defaultProfiles[0];
    setSchedules((items) => [
      ...items,
      {
        id: uid("schedule"),
        name: `Task ${items.length + 1}`,
        profileId: profile.id,
        enabled: true,
        time: "12:00",
        days: [1, 2, 3, 4, 5],
      },
    ]);
  };

  const updateSchedule = (id: string, patch: Partial<ScheduleTask>) => {
    setSchedules((items) =>
      items.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  };

  const addStep = () => {
    if (!activeProfile) return;
    updateActiveProfile({
      sequence: [
        ...activeProfile.sequence,
        {
          id: uid("step"),
          action: "click",
          button: activeProfile.button,
          x: activeProfile.x,
          y: activeProfile.y,
          delayMs: activeProfile.intervalMs,
          holdMs: activeProfile.holdMs,
          key: "Space",
        },
      ],
    });
  };

  const updateStep = (id: string, patch: Partial<ClickStep>) => {
    if (!activeProfile) return;
    updateActiveProfile({
      sequence: activeProfile.sequence.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    });
  };

  const removeStep = (id: string) => {
    if (!activeProfile) return;
    updateActiveProfile({
      sequence: activeProfile.sequence.filter((step) => step.id !== id),
    });
  };

  const moveStep = (id: string, direction: -1 | 1) => {
    if (!activeProfile) return;
    const index = activeProfile.sequence.findIndex((step) => step.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= activeProfile.sequence.length) return;

    const nextSequence = [...activeProfile.sequence];
    [nextSequence[index], nextSequence[nextIndex]] = [nextSequence[nextIndex], nextSequence[index]];
    updateActiveProfile({ sequence: nextSequence });
  };

  useEffect(() => {
    safeInvoke<RuntimeStatus>("get_runtime_status", undefined, {
      running: false,
      recording: false,
      recordedCount: 0,
      hotkeys,
    })
      .then((status) => {
        if (status) {
          setRunning(status.running);
          setRecording(status.recording);
          setHotkeys(status.hotkeys);
        }
      })
      .catch(() => setPreviewNotice(true));
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlisteners: UnlistenFn[] = [];
    const setup = async () => {
      unlisteners.push(
        await listen<BackendEvent>("tri://status", (event) => {
          log(event.payload.message);
          if (event.payload.action.includes("stopped")) setRunning(false);
          if (event.payload.action.includes("started")) setRunning(true);
        }),
      );
      unlisteners.push(
        await listen<BackendEvent>("tri://error", (event) => log(event.payload.message)),
      );
      unlisteners.push(
        await listen<number>("tri://tick", (event) => setTickCount(event.payload)),
      );
      unlisteners.push(
        await listen<BackendEvent>("tri://hotkey", async (event) => {
          if (event.payload.action === "record-toggle") {
            await toggleRecording();
          } else if (event.payload.action === "emergency-stop") {
            setRunning(false);
          } else if (event.payload.action === "start-stop") {
            await toggleRun();
          }
        }),
      );
    };
    setup().catch(() => setPreviewNotice(true));
    return () => unlisteners.forEach((unlisten) => unlisten());
  }, [log, toggleRecording, toggleRun]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const day = now.getDay();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      const runKey = `${now.toISOString().slice(0, 10)}-${time}`;
      const { profiles: latestProfiles, schedules: latestSchedules, running: isRunning } =
        latestRef.current;
      if (isRunning) return;
      latestSchedules.forEach((task) => {
        if (!task.enabled || task.time !== time || task.lastRunKey === runKey) return;
        if (!task.days.includes(day)) return;
        const profile = latestProfiles.find((item) => item.id === task.profileId);
        if (!profile) return;
        updateSchedule(task.id, { lastRunKey: runKey });
        void startProfile(profile);
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [startProfile]);

  const fontStack = useMemo(() => {
    if (settings.font === "MiSans") return "MiSans, system-ui, sans-serif";
    if (settings.font === "Serif") return "Georgia, 'Times New Roman', serif";
    if (settings.font === "Mono") return "'Cascadia Mono', Consolas, monospace";
    if (settings.font === "Custom") return `${settings.customFont}, system-ui, sans-serif`;
    return "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }, [settings.customFont, settings.font]);

  if (!activeProfile) {
    return null;
  }

  return (
    <main
      className={`app theme-${settings.theme} density-${settings.density}`}
      style={
        {
          "--app-font": fontStack,
          "--accent": activeProfile.accent,
        } as React.CSSProperties
      }
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <MousePointerClick size={22} />
          </div>
          <div>
            <strong>{t.app}</strong>
            <span>{running ? t.statusRunning : recording ? t.statusRecording : t.statusReady}</span>
          </div>
        </div>

        <nav className="tabs">
          {[
            { id: "profiles" as const, label: t.profiles, icon: SlidersHorizontal },
            { id: "recording" as const, label: t.recording, icon: Video },
            { id: "schedule" as const, label: t.schedule, icon: AlarmClock },
            { id: "settings" as const, label: t.settings, icon: Settings2 },
          ].map((item) => (
            <button
              key={item.id}
              className={activeTab === item.id ? "active" : ""}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="profile-list">
          <span className="section-label">{t.currentProfile}</span>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className={`profile-pill ${profile.id === activeProfile.id ? "active" : ""}`}
              onClick={() => setActiveProfileId(profile.id)}
            >
              <i style={{ background: profile.accent }} />
              <span>{profile.name}</span>
            </button>
          ))}
        </div>

        <button className="tray-button" onClick={() => safeInvoke("minimize_to_tray")}>
          <Minimize2 size={16} />
          <span>{t.minimizeTray}</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="status-chip">
            <CircleDot size={16} />
            <span>{running ? t.statusRunning : recording ? t.statusRecording : t.statusReady}</span>
              <strong>{tickCount}</strong>
            </div>
          <div className="telemetry-strip">
            <span>
              <small>{t.cps}</small>
              <strong>{estimatedCps.toFixed(1)}</strong>
            </span>
            <span>
              <small>{t.interval}</small>
              <strong>{activeProfile.intervalMs}ms</strong>
            </span>
            <span>
              <small>{t.runDuration}</small>
              <strong>
                {activeProfile.maxDurationMs ? formatDuration(activeProfile.maxDurationMs) : "∞"}
              </strong>
            </span>
          </div>
          <div className="quick-actions">
            <button className="ghost-button" onClick={toggleRecording}>
              {recording ? <Square size={17} /> : <Radio size={17} />}
              <span>{recording ? t.finish : t.record}</span>
            </button>
            <button className={running ? "danger-button" : "primary-button"} onClick={toggleRun}>
              {running ? <Pause size={18} /> : <Play size={18} />}
              <span>{running ? t.stop : t.start}</span>
            </button>
          </div>
        </header>

        {previewNotice && (
          <div className="notice">
            <BadgeCheck size={17} />
            <span>{t.simulated}</span>
            <button onClick={() => setPreviewNotice(false)}>OK</button>
          </div>
        )}

        {activeTab === "profiles" && (
          <div className="grid profile-grid">
            <section className="panel control-panel">
              <div className="panel-title">
                <div>
                  <span>{t.currentProfile}</span>
                  <input
                    value={activeProfile.name}
                    onChange={(event) => updateActiveProfile({ name: event.target.value })}
                  />
                </div>
                <div className="icon-row">
                  <button title={t.addProfile} onClick={addProfile}>
                    <Plus size={17} />
                  </button>
                  <button title={t.duplicate} onClick={duplicateProfile}>
                    <Copy size={17} />
                  </button>
                  <button title={t.delete} onClick={deleteProfile} disabled={profiles.length === 1}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              <Segmented
                label={t.mode}
                value={activeProfile.mode}
                options={(Object.keys(modeLabels) as ClickMode[]).map((mode) => ({
                  value: mode,
                  label: t[modeLabels[mode]],
                }))}
                onChange={(mode) => updateActiveProfile({ mode: mode as ClickMode })}
              />

              {activeProfile.mode === "keyTap" ? (
                <label className="text-field">
                  <span>{t.tapKey}</span>
                  <input
                    value={activeProfile.tapKey}
                    onChange={(event) => updateActiveProfile({ tapKey: event.target.value })}
                  />
                </label>
              ) : (
                <Segmented
                  label={t.button}
                  value={activeProfile.button}
                  options={(Object.keys(buttonLabels) as MouseButtonName[]).map((button) => ({
                    value: button,
                    label: t[buttonLabels[button]],
                  }))}
                  onChange={(button) => updateActiveProfile({ button: button as MouseButtonName })}
                />
              )}

              <div className="number-grid">
                <NumberField
                  label={t.interval}
                  value={activeProfile.intervalMs}
                  suffix="ms"
                  min={1}
                  max={3_600_000}
                  onChange={(intervalMs) => updateActiveProfile({ intervalMs })}
                />
                <NumberField
                  label={t.count}
                  value={activeProfile.count}
                  min={1}
                  max={1_000_000}
                  disabled={activeProfile.repeatForever}
                  onChange={(count) => updateActiveProfile({ count })}
                />
                <NumberField
                  label={t.initialDelay}
                  value={activeProfile.initialDelayMs}
                  suffix="ms"
                  min={0}
                  max={3_600_000}
                  onChange={(initialDelayMs) => updateActiveProfile({ initialDelayMs })}
                />
                <NumberField
                  label={t.hold}
                  value={activeProfile.holdMs}
                  suffix="ms"
                  min={1}
                  max={60_000}
                  onChange={(holdMs) => updateActiveProfile({ holdMs })}
                />
                <NumberField
                  label={t.runDuration}
                  value={activeProfile.maxDurationMs}
                  suffix="ms"
                  min={0}
                  max={86_400_000}
                  onChange={(maxDurationMs) => updateActiveProfile({ maxDurationMs })}
                />
              </div>

              <div className="toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={activeProfile.repeatForever}
                    onChange={(event) =>
                      updateActiveProfile({ repeatForever: event.target.checked })
                    }
                  />
                  <span>{t.forever}</span>
                </label>
                <label className="swatch-label">
                  <Palette size={16} />
                  <input
                    type="color"
                    value={activeProfile.accent}
                    onChange={(event) => updateActiveProfile({ accent: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="panel precision-panel">
              <div className="panel-heading">
                <Gauge size={18} />
                <h2>{t.interval}</h2>
              </div>
              <SliderField
                label={t.interval}
                value={activeProfile.intervalMs}
                min={1}
                max={2000}
                suffix="ms"
                onChange={(intervalMs) => updateActiveProfile({ intervalMs })}
              />
              <SliderField
                label={t.jitter}
                value={activeProfile.jitterMs}
                min={0}
                max={500}
                suffix="ms"
                onChange={(jitterMs) => updateActiveProfile({ jitterMs })}
              />
              <SliderField
                label={t.radius}
                value={activeProfile.randomRadius}
                min={0}
                max={120}
                suffix="px"
                onChange={(randomRadius) => updateActiveProfile({ randomRadius })}
              />
              <SliderField
                label={t.burst}
                value={activeProfile.burstSize}
                min={1}
                max={30}
                onChange={(burstSize) => updateActiveProfile({ burstSize })}
              />

              <Segmented
                label={t.target}
                value={activeProfile.targetMode}
                options={[
                  { value: "current", label: t.currentCursor },
                  { value: "fixed", label: t.fixedPoint },
                ]}
                onChange={(targetMode) =>
                  updateActiveProfile({ targetMode: targetMode as Profile["targetMode"] })
                }
              />
              <div className="coordinate-row">
                <NumberField
                  label={t.x}
                  value={activeProfile.x}
                  min={0}
                  max={20_000}
                  disabled={activeProfile.targetMode === "current"}
                  onChange={(x) => updateActiveProfile({ x })}
                />
                <NumberField
                  label={t.y}
                  value={activeProfile.y}
                  min={0}
                  max={20_000}
                  disabled={activeProfile.targetMode === "current"}
                  onChange={(y) => updateActiveProfile({ y })}
                />
              </div>
            </section>

            <section className="panel sequence-panel">
              <div className="panel-heading split">
                <span>
                  <ListChecks size={18} />
                  <h2>{t.sequenceEditor}</h2>
                </span>
                <button onClick={addStep}>
                  <Plus size={16} />
                  <span>{t.addStep}</span>
                </button>
              </div>
              <div className="sequence-list">
                {activeProfile.sequence.map((step, index) => (
                  <div className="sequence-row" key={step.id}>
                    <select
                      value={step.action}
                      onChange={(event) =>
                        updateStep(step.id, { action: event.target.value as ClickStep["action"] })
                      }
                    >
                      {(Object.keys(stepActionLabels) as StepAction[]).map((action) => (
                        <option key={action} value={action}>
                          {t[stepActionLabels[action]]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={step.key}
                      disabled={!actionUsesKey(step.action)}
                      onChange={(event) => updateStep(step.id, { key: event.target.value })}
                    />
                    <input
                      type="number"
                      value={step.x}
                      disabled={!actionUsesPosition(step.action)}
                      onChange={(event) => updateStep(step.id, { x: Number(event.target.value) })}
                    />
                    <input
                      type="number"
                      value={step.y}
                      disabled={!actionUsesPosition(step.action)}
                      onChange={(event) => updateStep(step.id, { y: Number(event.target.value) })}
                    />
                    <input
                      type="number"
                      value={step.holdMs}
                      disabled={!actionUsesHold(step.action)}
                      onChange={(event) =>
                        updateStep(step.id, { holdMs: Number(event.target.value) })
                      }
                    />
                    <input
                      type="number"
                      value={step.delayMs}
                      onChange={(event) =>
                        updateStep(step.id, { delayMs: Number(event.target.value) })
                      }
                    />
                    <div className="step-actions">
                      <button
                        title={t.moveUp}
                        onClick={() => moveStep(step.id, -1)}
                        disabled={index === 0}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        title={t.moveDown}
                        onClick={() => moveStep(step.id, 1)}
                        disabled={index === activeProfile.sequence.length - 1}
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button title={t.delete} onClick={() => removeStep(step.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "recording" && (
          <div className="grid recording-grid">
            <section className="panel recorder-panel">
              <div className="panel-heading">
                <Video size={18} />
                <h2>{t.recording}</h2>
              </div>
              <div className="record-button-wrap">
                <button className={recording ? "danger-circle" : "record-circle"} onClick={toggleRecording}>
                  {recording ? <Square size={30} /> : <Radio size={34} />}
                </button>
                <strong>{recording ? t.statusRecording : t.recordingHint}</strong>
              </div>
              <div className="recording-stats">
                <div>
                  <span>{t.events}</span>
                  <strong>{recordingStats.total}</strong>
                </div>
                <div>
                  <span>{t.duration}</span>
                  <strong>{formatDuration(recordingStats.durationMs)}</strong>
                </div>
                <div>
                  <span>{t.moves}</span>
                  <strong>{recordingStats.moves}</strong>
                </div>
                <div>
                  <span>{t.keysStat}</span>
                  <strong>{recordingStats.keys}</strong>
                </div>
                <div>
                  <span>{t.mouseStat}</span>
                  <strong>{recordingStats.mouse}</strong>
                </div>
              </div>
              <div className="playback-row">
                <SliderField
                  label={t.playbackSpeed}
                  value={playbackSpeed * 100}
                  min={10}
                  max={300}
                  suffix="%"
                  onChange={(value) => setPlaybackSpeed(value / 100)}
                />
                <button className="primary-button" onClick={playRecorded} disabled={!recorded.length}>
                  <Play size={17} />
                  <span>{t.playRecording}</span>
                </button>
                <button
                  onClick={() => {
                    void safeInvoke("clear_recording");
                    setRecorded([]);
                  }}
                >
                  <Trash2 size={16} />
                  <span>{t.clear}</span>
                </button>
              </div>
              <div className="macro-actions">
                <button onClick={exportRecording} disabled={!recorded.length}>
                  <Download size={16} />
                  <span>{t.exportRecording}</span>
                </button>
                <button onClick={() => recordingInputRef.current?.click()}>
                  <Upload size={16} />
                  <span>{t.importRecording}</span>
                </button>
                <button
                  onClick={optimizeRecording}
                  disabled={!recorded.length || optimizedRecordingCount === recorded.length}
                  title={
                    recorded.length
                      ? `${recorded.length} -> ${optimizedRecordingCount}`
                      : t.optimizeRecording
                  }
                >
                  <Sparkles size={16} />
                  <span>{t.optimizeRecording}</span>
                </button>
                <button onClick={applyRecordingToSequence} disabled={!recorded.length}>
                  <Wand2 size={16} />
                  <span>{t.applyRecordingSequence}</span>
                </button>
                <button onClick={saveRecordingAsProfile} disabled={!recorded.length}>
                  <Save size={16} />
                  <span>{t.saveRecordingProfile}</span>
                </button>
              </div>
              <input
                ref={recordingInputRef}
                className="backup-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) {
                    void importRecording(file);
                  }
                }}
              />
            </section>

            <section className="panel event-panel">
              <div className="panel-heading">
                <ClipboardList size={18} />
                <h2>{t.events}</h2>
              </div>
              <div className="event-list">
                {recorded.length === 0 && <p>{t.noRecording}</p>}
                {recorded.slice(0, 140).map((event, index) => (
                  <div className="event-row" key={`${event.timestampMs}-${index}`}>
                    <span>{index + 1}</span>
                    <strong>{event.kind}</strong>
                    <em>{event.detail}</em>
                    <small>{event.delayMs}ms</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="grid schedule-grid">
            <section className="panel schedule-panel">
              <div className="panel-heading split">
                <span>
                  <AlarmClock size={18} />
                  <h2>{t.schedules}</h2>
                </span>
                <button onClick={addSchedule}>
                  <Plus size={16} />
                  <span>{t.addSchedule}</span>
                </button>
              </div>
              <div className="task-list">
                {schedules.map((task) => (
                  <div className="task-row" key={task.id}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={(event) =>
                          updateSchedule(task.id, { enabled: event.target.checked })
                        }
                      />
                      <span />
                    </label>
                    <input
                      value={task.name}
                      onChange={(event) => updateSchedule(task.id, { name: event.target.value })}
                    />
                    <select
                      value={task.profileId}
                      onChange={(event) =>
                        updateSchedule(task.id, { profileId: event.target.value })
                      }
                    >
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={task.time}
                      onChange={(event) => updateSchedule(task.id, { time: event.target.value })}
                    />
                    <div className="day-row">
                      {weekdays.map((dayLabel, dayIndex) => (
                        <button
                          key={dayLabel}
                          className={task.days.includes(dayIndex) ? "selected" : ""}
                          onClick={() => {
                            const days = task.days.includes(dayIndex)
                              ? task.days.filter((day) => day !== dayIndex)
                              : [...task.days, dayIndex].sort();
                            updateSchedule(task.id, { days });
                          }}
                        >
                          {t[dayLabel]}
                        </button>
                      ))}
                    </div>
                    <button
                      title={t.delete}
                      onClick={() =>
                        setSchedules((items) => items.filter((item) => item.id !== task.id))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid settings-grid">
            <section className="panel">
              <div className="panel-heading">
                <Languages size={18} />
                <h2>{t.language}</h2>
              </div>
              <Segmented
                label={t.language}
                value={settings.language}
                options={[
                  { value: "zh", label: "中文" },
                  { value: "ja", label: "日本語" },
                  { value: "en", label: "English" },
                ]}
                onChange={(language) =>
                  setSettings((current) => ({ ...current, language: language as Language }))
                }
              />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <Sparkles size={18} />
                <h2>{t.theme}</h2>
              </div>
              <div className="theme-grid">
                {(Object.keys(themeLabels) as ThemeName[]).map((theme) => (
                  <button
                    key={theme}
                    className={`theme-swatch theme-${theme} ${
                      settings.theme === theme ? "active" : ""
                    }`}
                    onClick={() => setSettings((current) => ({ ...current, theme }))}
                  >
                    <i />
                    <span>{t[themeLabels[theme]]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <Type size={18} />
                <h2>{t.font}</h2>
              </div>
              <Segmented
                label={t.font}
                value={settings.font}
                options={(["MiSans", "System", "Serif", "Mono", "Custom"] as FontName[]).map(
                  (font) => ({ value: font, label: font }),
                )}
                onChange={(font) => setSettings((current) => ({ ...current, font: font as FontName }))}
              />
              {settings.font === "Custom" && (
                <label className="text-field">
                  <span>{t.customFont}</span>
                  <input
                    value={settings.customFont}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        customFont: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <Segmented
                label={t.density}
                value={settings.density}
                options={[
                  { value: "cozy", label: t.cozy },
                  { value: "compact", label: t.compact },
                ]}
                onChange={(density) =>
                  setSettings((current) => ({
                    ...current,
                    density: density as Settings["density"],
                  }))
                }
              />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <Keyboard size={18} />
                <h2>{t.hotkeys}</h2>
              </div>
              <HotkeyField
                label={t.startStopHotkey}
                value={hotkeys.startStop}
                setLabel={t.setHotkey}
                pressLabel={t.pressHotkey}
                cancelLabel={t.cancel}
                onCaptureChange={setHotkeyCapture}
                onChange={(combo) => syncHotkeys({ ...hotkeys, startStop: combo })}
              />
              <HotkeyField
                label={t.recordHotkey}
                value={hotkeys.recordStop}
                setLabel={t.setHotkey}
                pressLabel={t.pressHotkey}
                cancelLabel={t.cancel}
                onCaptureChange={setHotkeyCapture}
                onChange={(combo) => syncHotkeys({ ...hotkeys, recordStop: combo })}
              />
              <HotkeyField
                label={t.emergencyHotkey}
                value={hotkeys.playbackStop}
                setLabel={t.setHotkey}
                pressLabel={t.pressHotkey}
                cancelLabel={t.cancel}
                onCaptureChange={setHotkeyCapture}
                onChange={(combo) => syncHotkeys({ ...hotkeys, playbackStop: combo })}
              />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <ClipboardList size={18} />
                <h2>{t.backup}</h2>
              </div>
              <div className="backup-actions">
                <button onClick={exportBackup}>
                  <Download size={16} />
                  <span>{t.exportBackup}</span>
                </button>
                <button onClick={() => backupInputRef.current?.click()}>
                  <Upload size={16} />
                  <span>{t.importBackup}</span>
                </button>
              </div>
              <input
                ref={backupInputRef}
                className="backup-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) {
                    void importBackup(file);
                  }
                }}
              />
            </section>
          </div>
        )}
      </section>

      <aside className="activity-panel">
        <div className="panel-heading">
          <Bell size={18} />
          <h2>{t.activity}</h2>
        </div>
        <div className="activity-list">
          {activity.length === 0 && <span>{t.statusReady}</span>}
          {activity.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="meter">
          <div style={{ width: `${Math.min(100, (tickCount % 100) + 4)}%` }} />
        </div>
      </aside>
    </main>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-group">
      <span>{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            className={option.value === value ? "selected" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <strong>
          {Math.round(value)}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function HotkeyField({
  label,
  value,
  setLabel,
  pressLabel,
  cancelLabel,
  onCaptureChange,
  onChange,
}: {
  label: string;
  value: string[];
  setLabel: string;
  pressLabel: string;
  cancelLabel: string;
  onCaptureChange: (active: boolean) => void | Promise<void>;
  onChange: (value: string[]) => void | Promise<void>;
}) {
  const [capturing, setCapturing] = useState(false);

  const stopCapture = useCallback(() => {
    setCapturing(false);
    void onCaptureChange(false);
  }, [onCaptureChange]);

  useEffect(() => {
    if (!capturing) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const combo = comboFromKeyEvent(event);
      if (!combo.length) return;

      setCapturing(false);
      void onCaptureChange(false);
      void onChange(combo);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [capturing, onCaptureChange, onChange]);

  useEffect(
    () => () => {
      if (capturing) {
        void onCaptureChange(false);
      }
    },
    [capturing, onCaptureChange],
  );

  const startCapture = () => {
    setCapturing(true);
    void onCaptureChange(true);
  };

  return (
    <div className={`hotkey-field ${capturing ? "capturing" : ""}`}>
      <span>{label}</span>
      <div className="hotkey-capture">
        <Zap size={15} />
        <strong>{capturing ? pressLabel : comboToString(value)}</strong>
        <button type="button" onClick={capturing ? stopCapture : startCapture}>
          {capturing ? cancelLabel : setLabel}
        </button>
      </div>
    </div>
  );
}

export default App;
