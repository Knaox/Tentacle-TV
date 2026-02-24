/// Event names emitted to the frontend via Tauri's event system.
///
/// The mpv reader thread in player.rs emits these events:
///
/// - `mpv:state` — MpvState object, emitted on every property change
///   Fields: playing, position, duration, volume, muted, paused, eof,
///           audioTrack, subtitleTrack
///
/// Frontend listens with:
///   import { listen } from '@tauri-apps/api/event';
///   const unlisten = await listen<MpvState>('mpv:state', (event) => { ... });

pub const _MPV_STATE_EVENT: &str = "mpv:state";
