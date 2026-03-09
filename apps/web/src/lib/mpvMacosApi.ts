/**
 * macOS mpv adapter — provides the same API surface as tauri-plugin-libmpv-api
 * but calls our custom Rust commands (mpv render API) instead of the plugin.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Re-export compatible types so useDesktopPlayer works unchanged
export type MpvObservableProperty = readonly [string, string, ...unknown[]];

export interface MpvConfig {
  initialOptions?: Record<string, unknown>;
  observedProperties?: ReadonlyArray<MpvObservableProperty>;
}

export async function init(config?: MpvConfig): Promise<string> {
  return invoke<string>("mpv_init", { options: config ?? {} });
}

export async function destroy(): Promise<void> {
  return invoke<void>("mpv_destroy");
}

export async function command(
  name: string,
  args?: (string | boolean | number)[],
): Promise<void> {
  return invoke<void>("mpv_command", { name, args: args ?? [] });
}

export async function setProperty(
  name: string,
  value: string | boolean | number,
): Promise<void> {
  return invoke<void>("mpv_set_property", { name, value });
}

export async function getProperty<T extends string>(
  name: string,
  format: T,
): Promise<unknown> {
  return invoke<unknown>("mpv_get_property", { name, format });
}

export async function observeProperties<
  T extends ReadonlyArray<MpvObservableProperty>,
>(
  _properties: T,
  callback: (event: { name: string; data: unknown; id: number }) => void,
): Promise<UnlistenFn> {
  // Properties are already observed on the Rust side during init.
  // We just listen for the Tauri events here.
  return listen("mpv://property-change", (e) =>
    callback(e.payload as { name: string; data: unknown; id: number }),
  );
}

export async function listenEvents(
  callback: (event: { event: string; [key: string]: unknown }) => void,
): Promise<UnlistenFn> {
  return listen("mpv://event", (e) =>
    callback(e.payload as { event: string; [key: string]: unknown }),
  );
}
