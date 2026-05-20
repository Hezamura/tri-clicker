use chrono::Local;
use rand::Rng;
use rdev::{listen, simulate, Button, Event, EventType, Key};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};

#[derive(Clone)]
struct AutomationState {
    click_stop: Arc<Mutex<Option<Arc<AtomicBool>>>>,
    recording: Arc<AtomicBool>,
    recorded: Arc<Mutex<Vec<RecordedInput>>>,
    last_event_at: Arc<Mutex<Option<Instant>>>,
    listener_started: Arc<AtomicBool>,
    pressed_keys: Arc<Mutex<HashSet<String>>>,
    hotkeys: Arc<Mutex<HotkeyConfig>>,
    hotkey_capture: Arc<AtomicBool>,
}

impl Default for AutomationState {
    fn default() -> Self {
        Self {
            click_stop: Arc::new(Mutex::new(None)),
            recording: Arc::new(AtomicBool::new(false)),
            recorded: Arc::new(Mutex::new(Vec::new())),
            last_event_at: Arc::new(Mutex::new(None)),
            listener_started: Arc::new(AtomicBool::new(false)),
            pressed_keys: Arc::new(Mutex::new(HashSet::new())),
            hotkeys: Arc::new(Mutex::new(HotkeyConfig::default())),
            hotkey_capture: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HotkeyConfig {
    start_stop: Vec<String>,
    record_stop: Vec<String>,
    playback_stop: Vec<String>,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            start_stop: vec!["F6".into()],
            record_stop: vec!["F7".into()],
            playback_stop: vec!["Escape".into()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClickRunConfig {
    button: String,
    mode: String,
    interval_ms: u64,
    initial_delay_ms: u64,
    count: u32,
    repeat_forever: bool,
    hold_ms: u64,
    jitter_ms: u64,
    random_radius: i32,
    burst_size: u32,
    x: Option<f64>,
    y: Option<f64>,
    sequence: Vec<ClickStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClickStep {
    action: String,
    button: String,
    x: Option<f64>,
    y: Option<f64>,
    delay_ms: u64,
    hold_ms: u64,
    key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecordedInput {
    kind: String,
    detail: String,
    x: Option<f64>,
    y: Option<f64>,
    delay_ms: u64,
    timestamp_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    running: bool,
    recording: bool,
    recorded_count: usize,
    hotkeys: HotkeyConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendEvent {
    action: String,
    message: String,
    at: String,
}

#[tauri::command]
fn get_runtime_status(state: State<'_, AutomationState>) -> RuntimeStatus {
    RuntimeStatus {
        running: is_running(&state),
        recording: state.recording.load(Ordering::SeqCst),
        recorded_count: state.recorded.lock().map(|items| items.len()).unwrap_or(0),
        hotkeys: state
            .hotkeys
            .lock()
            .map(|keys| keys.clone())
            .unwrap_or_else(|_| HotkeyConfig::default()),
    }
}

#[tauri::command]
fn set_hotkeys(config: HotkeyConfig, state: State<'_, AutomationState>) -> Result<(), String> {
    let mut hotkeys = state.hotkeys.lock().map_err(lock_error)?;
    *hotkeys = HotkeyConfig {
        start_stop: normalize_combo(config.start_stop),
        record_stop: normalize_combo(config.record_stop),
        playback_stop: normalize_combo(config.playback_stop),
    };
    Ok(())
}

#[tauri::command]
fn set_hotkey_capture(active: bool, state: State<'_, AutomationState>) -> Result<(), String> {
    state.hotkey_capture.store(active, Ordering::SeqCst);
    state.pressed_keys.lock().map_err(lock_error)?.clear();
    Ok(())
}

#[tauri::command]
fn start_clicker(
    app: AppHandle,
    state: State<'_, AutomationState>,
    config: ClickRunConfig,
) -> Result<(), String> {
    stop_clicker(app.clone(), state.clone())?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.click_stop.lock().map_err(lock_error)?;
        *slot = Some(stop_flag.clone());
    }

    let state_for_thread = state.inner().clone();
    thread::spawn(move || {
        emit_backend(
            &app,
            "clicker-started",
            "Clicker started with the active profile.",
        );

        if config.initial_delay_ms > 0 {
            sleep_interruptible(Duration::from_millis(config.initial_delay_ms), &stop_flag);
        }

        let mut completed = 0u32;
        loop {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            if !config.repeat_forever && completed >= config.count {
                break;
            }

            if let Err(error) = run_click_mode(&config, &stop_flag) {
                let _ = app.emit(
                    "tri://error",
                    BackendEvent {
                        action: "clicker-error".into(),
                        message: error,
                        at: Local::now().to_rfc3339(),
                    },
                );
                break;
            }

            completed = completed.saturating_add(1);
            let _ = app.emit("tri://tick", completed);
            let interval = next_interval(&config);
            sleep_interruptible(Duration::from_millis(interval), &stop_flag);
        }

        if let Ok(mut slot) = state_for_thread.click_stop.lock() {
            if slot
                .as_ref()
                .is_some_and(|flag| Arc::ptr_eq(flag, &stop_flag))
            {
                *slot = None;
            }
        }

        emit_backend(
            &app,
            "clicker-stopped",
            "Clicker stopped or completed its configured count.",
        );
    });

    Ok(())
}

#[tauri::command]
fn stop_clicker(app: AppHandle, state: State<'_, AutomationState>) -> Result<(), String> {
    let mut slot = state.click_stop.lock().map_err(lock_error)?;
    if let Some(flag) = slot.take() {
        flag.store(true, Ordering::SeqCst);
        emit_backend(&app, "clicker-stop-requested", "Stop signal sent.");
    }
    Ok(())
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<'_, AutomationState>) -> Result<(), String> {
    ensure_listener(app.clone(), state.inner().clone())?;
    state.recording.store(true, Ordering::SeqCst);
    state.recorded.lock().map_err(lock_error)?.clear();
    *state.last_event_at.lock().map_err(lock_error)? = None;
    emit_backend(&app, "recording-started", "Input recording started.");
    Ok(())
}

#[tauri::command]
fn stop_recording(
    app: AppHandle,
    state: State<'_, AutomationState>,
) -> Result<Vec<RecordedInput>, String> {
    state.recording.store(false, Ordering::SeqCst);
    let items = state.recorded.lock().map_err(lock_error)?.clone();
    emit_backend(&app, "recording-stopped", "Input recording stopped.");
    Ok(items)
}

#[tauri::command]
fn clear_recording(state: State<'_, AutomationState>) -> Result<(), String> {
    state.recorded.lock().map_err(lock_error)?.clear();
    Ok(())
}

#[tauri::command]
fn play_recording(
    app: AppHandle,
    state: State<'_, AutomationState>,
    events: Vec<RecordedInput>,
    speed: f64,
) -> Result<(), String> {
    stop_clicker(app.clone(), state.clone())?;
    let stop_flag = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.click_stop.lock().map_err(lock_error)?;
        *slot = Some(stop_flag.clone());
    }
    let state_for_thread = state.inner().clone();
    let playback_speed = speed.clamp(0.1, 10.0);

    thread::spawn(move || {
        emit_backend(&app, "playback-started", "Recorded macro playback started.");
        for event in events {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            let delay = (event.delay_ms as f64 / playback_speed).max(0.0) as u64;
            sleep_interruptible(Duration::from_millis(delay), &stop_flag);
            if let Err(error) = replay_input(&event) {
                let _ = app.emit(
                    "tri://error",
                    BackendEvent {
                        action: "playback-error".into(),
                        message: error,
                        at: Local::now().to_rfc3339(),
                    },
                );
                break;
            }
        }
        if let Ok(mut slot) = state_for_thread.click_stop.lock() {
            if slot
                .as_ref()
                .is_some_and(|flag| Arc::ptr_eq(flag, &stop_flag))
            {
                *slot = None;
            }
        }
        emit_backend(&app, "playback-stopped", "Recorded macro playback stopped.");
    });

    Ok(())
}

#[tauri::command]
fn minimize_to_tray(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window was not found.".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn ensure_listener(app: AppHandle, state: AutomationState) -> Result<(), String> {
    if state
        .listener_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    thread::spawn(move || {
        let listener_state = state.clone();
        let callback_app = app.clone();
        let error_app = app.clone();
        let callback = move |event: Event| {
            handle_hotkeys(&callback_app, &listener_state, &event);
            if listener_state.recording.load(Ordering::SeqCst) {
                if let Some(recorded) = convert_event(event, &listener_state) {
                    if let Ok(mut events) = listener_state.recorded.lock() {
                        if events.len() < 10_000 {
                            events.push(recorded);
                        }
                    }
                }
            }
        };

        if let Err(error) = listen(callback) {
            let _ = error_app.emit(
                "tri://error",
                BackendEvent {
                    action: "listener-error".into(),
                    message: format!("{error:?}"),
                    at: Local::now().to_rfc3339(),
                },
            );
            state.listener_started.store(false, Ordering::SeqCst);
        }
    });

    Ok(())
}

fn handle_hotkeys(app: &AppHandle, state: &AutomationState, event: &Event) {
    if state.hotkey_capture.load(Ordering::SeqCst) {
        return;
    }

    match event.event_type {
        EventType::KeyPress(key) => {
            let key_name = normalize_key(&key_to_string(key));
            let mut pressed = match state.pressed_keys.lock() {
                Ok(pressed) => pressed,
                Err(_) => return,
            };
            pressed.insert(key_name);
            let hotkeys = state
                .hotkeys
                .lock()
                .map(|keys| keys.clone())
                .unwrap_or_else(|_| HotkeyConfig::default());
            let action = if combo_matches(&pressed, &hotkeys.playback_stop) {
                Some("emergency-stop")
            } else if combo_matches(&pressed, &hotkeys.record_stop) {
                Some("record-toggle")
            } else if combo_matches(&pressed, &hotkeys.start_stop) {
                Some("start-stop")
            } else {
                None
            };
            drop(pressed);

            if let Some(action) = action {
                if action == "emergency-stop" {
                    if let Ok(mut slot) = state.click_stop.lock() {
                        if let Some(flag) = slot.take() {
                            flag.store(true, Ordering::SeqCst);
                        }
                    }
                }
                let _ = app.emit(
                    "tri://hotkey",
                    BackendEvent {
                        action: action.into(),
                        message: "Global hotkey pressed.".into(),
                        at: Local::now().to_rfc3339(),
                    },
                );
            }
        }
        EventType::KeyRelease(key) => {
            if let Ok(mut pressed) = state.pressed_keys.lock() {
                pressed.remove(&normalize_key(&key_to_string(key)));
            }
        }
        _ => {}
    }
}

fn convert_event(event: Event, state: &AutomationState) -> Option<RecordedInput> {
    let now = Instant::now();
    let mut last = state.last_event_at.lock().ok()?;
    let delay_ms = last
        .map(|last_instant| now.saturating_duration_since(last_instant).as_millis() as u64)
        .unwrap_or(0);
    *last = Some(now);

    let timestamp_ms = Local::now().timestamp_millis();
    match event.event_type {
        EventType::KeyPress(key) => Some(RecordedInput {
            kind: "keyPress".into(),
            detail: normalize_key(&key_to_string(key)),
            x: None,
            y: None,
            delay_ms,
            timestamp_ms,
        }),
        EventType::KeyRelease(key) => Some(RecordedInput {
            kind: "keyRelease".into(),
            detail: normalize_key(&key_to_string(key)),
            x: None,
            y: None,
            delay_ms,
            timestamp_ms,
        }),
        EventType::ButtonPress(button) => Some(RecordedInput {
            kind: "buttonPress".into(),
            detail: button_to_string(button),
            x: None,
            y: None,
            delay_ms,
            timestamp_ms,
        }),
        EventType::ButtonRelease(button) => Some(RecordedInput {
            kind: "buttonRelease".into(),
            detail: button_to_string(button),
            x: None,
            y: None,
            delay_ms,
            timestamp_ms,
        }),
        EventType::MouseMove { x, y } => Some(RecordedInput {
            kind: "mouseMove".into(),
            detail: "move".into(),
            x: Some(x),
            y: Some(y),
            delay_ms,
            timestamp_ms,
        }),
        EventType::Wheel { delta_x, delta_y } => Some(RecordedInput {
            kind: "wheel".into(),
            detail: format!("{delta_x},{delta_y}"),
            x: None,
            y: None,
            delay_ms,
            timestamp_ms,
        }),
    }
}

fn run_click_mode(config: &ClickRunConfig, stop_flag: &AtomicBool) -> Result<(), String> {
    match config.mode.as_str() {
        "double" => {
            perform_click(config, stop_flag)?;
            sleep_interruptible(Duration::from_millis(54), stop_flag);
            perform_click(config, stop_flag)
        }
        "hold" => perform_click(config, stop_flag),
        "burst" => {
            let burst_size = config.burst_size.max(1);
            for index in 0..burst_size {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }
                perform_click(config, stop_flag)?;
                if index + 1 < burst_size {
                    sleep_interruptible(Duration::from_millis(36), stop_flag);
                }
            }
            Ok(())
        }
        "sequence" => run_sequence(&config.sequence, stop_flag),
        _ => perform_click(config, stop_flag),
    }
}

fn perform_click(config: &ClickRunConfig, stop_flag: &AtomicBool) -> Result<(), String> {
    let (x, y) = target_position(config);
    if let (Some(x), Some(y)) = (x, y) {
        simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
    }

    let button = parse_button(&config.button);
    simulate(&EventType::ButtonPress(button)).map_err(simulate_error)?;
    let hold_ms = config
        .hold_ms
        .max(if config.mode == "hold" { 120 } else { 12 });
    sleep_interruptible(Duration::from_millis(hold_ms), stop_flag);
    simulate(&EventType::ButtonRelease(button)).map_err(simulate_error)?;
    Ok(())
}

fn run_sequence(sequence: &[ClickStep], stop_flag: &AtomicBool) -> Result<(), String> {
    for step in sequence {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }
        sleep_interruptible(Duration::from_millis(step.delay_ms), stop_flag);
        match step.action.as_str() {
            "key" => {
                if let Some(key_name) = &step.key {
                    tap_key(key_name)?;
                }
            }
            "keyDown" => {
                if let Some(key_name) = &step.key {
                    press_key(key_name)?;
                }
            }
            "keyUp" => {
                if let Some(key_name) = &step.key {
                    release_key(key_name)?;
                }
            }
            "move" => {
                if let (Some(x), Some(y)) = (step.x, step.y) {
                    simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
                }
            }
            "mouseDown" => {
                if let (Some(x), Some(y)) = (step.x, step.y) {
                    simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
                }
                let button = parse_button(&step.button);
                simulate(&EventType::ButtonPress(button)).map_err(simulate_error)?;
            }
            "mouseUp" => {
                if let (Some(x), Some(y)) = (step.x, step.y) {
                    simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
                }
                let button = parse_button(&step.button);
                simulate(&EventType::ButtonRelease(button)).map_err(simulate_error)?;
            }
            "wheel" => {
                if let Some(detail) = &step.key {
                    simulate_wheel(detail)?;
                }
            }
            _ => {
                if let (Some(x), Some(y)) = (step.x, step.y) {
                    simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
                }
                let button = parse_button(&step.button);
                simulate(&EventType::ButtonPress(button)).map_err(simulate_error)?;
                sleep_interruptible(Duration::from_millis(step.hold_ms.max(12)), stop_flag);
                simulate(&EventType::ButtonRelease(button)).map_err(simulate_error)?;
            }
        }
    }
    Ok(())
}

fn replay_input(event: &RecordedInput) -> Result<(), String> {
    match event.kind.as_str() {
        "keyPress" => {
            if let Some(key) = parse_key(&event.detail) {
                simulate(&EventType::KeyPress(key)).map_err(simulate_error)?;
            }
        }
        "keyRelease" => {
            if let Some(key) = parse_key(&event.detail) {
                simulate(&EventType::KeyRelease(key)).map_err(simulate_error)?;
            }
        }
        "buttonPress" => {
            simulate(&EventType::ButtonPress(parse_button(&event.detail)))
                .map_err(simulate_error)?;
        }
        "buttonRelease" => {
            simulate(&EventType::ButtonRelease(parse_button(&event.detail)))
                .map_err(simulate_error)?;
        }
        "mouseMove" => {
            if let (Some(x), Some(y)) = (event.x, event.y) {
                simulate(&EventType::MouseMove { x, y }).map_err(simulate_error)?;
            }
        }
        "wheel" => {
            simulate_wheel(&event.detail)?;
        }
        _ => {}
    }
    Ok(())
}

fn target_position(config: &ClickRunConfig) -> (Option<f64>, Option<f64>) {
    match (config.x, config.y) {
        (Some(x), Some(y)) if config.random_radius > 0 => {
            let mut rng = rand::thread_rng();
            let dx = rng.gen_range(-config.random_radius..=config.random_radius) as f64;
            let dy = rng.gen_range(-config.random_radius..=config.random_radius) as f64;
            (Some(x + dx), Some(y + dy))
        }
        (x, y) => (x, y),
    }
}

fn next_interval(config: &ClickRunConfig) -> u64 {
    if config.jitter_ms == 0 {
        return config.interval_ms.max(1);
    }
    let mut rng = rand::thread_rng();
    let jitter = rng.gen_range(-(config.jitter_ms as i64)..=(config.jitter_ms as i64));
    (config.interval_ms as i64 + jitter).max(1) as u64
}

fn sleep_interruptible(duration: Duration, stop_flag: &AtomicBool) {
    let start = Instant::now();
    while start.elapsed() < duration {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }
        thread::sleep(Duration::from_millis(5));
    }
}

fn is_running(state: &AutomationState) -> bool {
    state
        .click_stop
        .lock()
        .map(|slot| slot.is_some())
        .unwrap_or(false)
}

fn emit_backend(app: &AppHandle, action: &str, message: &str) {
    let _ = app.emit(
        "tri://status",
        BackendEvent {
            action: action.into(),
            message: message.into(),
            at: Local::now().to_rfc3339(),
        },
    );
}

fn parse_button(button: &str) -> Button {
    match normalize_key(button).as_str() {
        "RIGHT" => Button::Right,
        "MIDDLE" => Button::Middle,
        _ => Button::Left,
    }
}

fn button_to_string(button: Button) -> String {
    match button {
        Button::Left => "Left".into(),
        Button::Right => "Right".into(),
        Button::Middle => "Middle".into(),
        Button::Unknown(code) => format!("Unknown{code}"),
    }
}

fn tap_key(key_name: &str) -> Result<(), String> {
    press_key(key_name)?;
    thread::sleep(Duration::from_millis(18));
    release_key(key_name)
}

fn press_key(key_name: &str) -> Result<(), String> {
    if let Some(key) = parse_key(key_name) {
        simulate(&EventType::KeyPress(key)).map_err(simulate_error)?;
    }
    Ok(())
}

fn release_key(key_name: &str) -> Result<(), String> {
    if let Some(key) = parse_key(key_name) {
        simulate(&EventType::KeyRelease(key)).map_err(simulate_error)?;
    }
    Ok(())
}

fn simulate_wheel(detail: &str) -> Result<(), String> {
    let parts: Vec<_> = detail.split(',').collect();
    if parts.len() == 2 {
        let delta_x = parts[0].parse::<i64>().unwrap_or(0);
        let delta_y = parts[1].parse::<i64>().unwrap_or(0);
        simulate(&EventType::Wheel { delta_x, delta_y }).map_err(simulate_error)?;
    }
    Ok(())
}

fn parse_key(key_name: &str) -> Option<Key> {
    match normalize_key(key_name).as_str() {
        "A" => Some(Key::KeyA),
        "B" => Some(Key::KeyB),
        "C" => Some(Key::KeyC),
        "D" => Some(Key::KeyD),
        "E" => Some(Key::KeyE),
        "F" => Some(Key::KeyF),
        "G" => Some(Key::KeyG),
        "H" => Some(Key::KeyH),
        "I" => Some(Key::KeyI),
        "J" => Some(Key::KeyJ),
        "K" => Some(Key::KeyK),
        "L" => Some(Key::KeyL),
        "M" => Some(Key::KeyM),
        "N" => Some(Key::KeyN),
        "O" => Some(Key::KeyO),
        "P" => Some(Key::KeyP),
        "Q" => Some(Key::KeyQ),
        "R" => Some(Key::KeyR),
        "S" => Some(Key::KeyS),
        "T" => Some(Key::KeyT),
        "U" => Some(Key::KeyU),
        "V" => Some(Key::KeyV),
        "W" => Some(Key::KeyW),
        "X" => Some(Key::KeyX),
        "Y" => Some(Key::KeyY),
        "Z" => Some(Key::KeyZ),
        "0" => Some(Key::Num0),
        "1" => Some(Key::Num1),
        "2" => Some(Key::Num2),
        "3" => Some(Key::Num3),
        "4" => Some(Key::Num4),
        "5" => Some(Key::Num5),
        "6" => Some(Key::Num6),
        "7" => Some(Key::Num7),
        "8" => Some(Key::Num8),
        "9" => Some(Key::Num9),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        "ESCAPE" | "ESC" => Some(Key::Escape),
        "SPACE" => Some(Key::Space),
        "TAB" => Some(Key::Tab),
        "ENTER" | "RETURN" => Some(Key::Return),
        "BACKSPACE" => Some(Key::Backspace),
        "DELETE" => Some(Key::Delete),
        "UP" => Some(Key::UpArrow),
        "DOWN" => Some(Key::DownArrow),
        "LEFTARROW" | "ARROWLEFT" => Some(Key::LeftArrow),
        "RIGHTARROW" | "ARROWRIGHT" => Some(Key::RightArrow),
        _ => None,
    }
}

fn key_to_string(key: Key) -> String {
    format!("{key:?}")
}

fn normalize_combo(combo: Vec<String>) -> Vec<String> {
    combo.into_iter().map(|item| normalize_key(&item)).collect()
}

fn normalize_key(value: &str) -> String {
    let cleaned = value.trim().replace(' ', "");
    match cleaned.as_str() {
        "ControlLeft" | "ControlRight" | "Control" | "Ctrl" => "CTRL".into(),
        "ShiftLeft" | "ShiftRight" | "Shift" => "SHIFT".into(),
        "AltGr" | "Alt" => "ALT".into(),
        "MetaLeft" | "MetaRight" | "Meta" | "Command" | "Cmd" | "Win" => "META".into(),
        "Return" => "ENTER".into(),
        "LeftArrow" => "ARROWLEFT".into(),
        "RightArrow" => "ARROWRIGHT".into(),
        "UpArrow" => "UP".into(),
        "DownArrow" => "DOWN".into(),
        _ if cleaned.starts_with("Key") && cleaned.len() == 4 => cleaned[3..].to_uppercase(),
        _ if cleaned.starts_with("Num") && cleaned.len() == 4 => cleaned[3..].to_uppercase(),
        _ => cleaned.to_uppercase(),
    }
}

fn combo_matches(pressed: &HashSet<String>, combo: &[String]) -> bool {
    !combo.is_empty()
        && combo
            .iter()
            .all(|key| pressed.contains(&normalize_key(key)))
}

fn simulate_error(error: rdev::SimulateError) -> String {
    format!("Input simulation failed: {error:?}")
}

fn lock_error<T>(error: std::sync::PoisonError<T>) -> String {
    format!("Runtime state lock failed: {error}")
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show TriClick Studio", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("default icon".into()))?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("TriClick Studio")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .build(app)?;

    Ok(())
}

pub fn run() {
    let state = AutomationState::default();

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            setup_tray(app)?;
            let app_handle = app.handle().clone();
            let app_state = app.state::<AutomationState>().inner().clone();
            let _ = ensure_listener(app_handle, app_state);
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main_window(app.clone());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|app, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(app.clone());
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_status,
            set_hotkeys,
            set_hotkey_capture,
            start_clicker,
            stop_clicker,
            start_recording,
            stop_recording,
            clear_recording,
            play_recording,
            minimize_to_tray,
            show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running TriClick Studio");
}
