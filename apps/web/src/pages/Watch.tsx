import { isTauri } from "../hooks/useDesktopPlayer";
import { WatchWeb } from "./WatchWeb";
import { WatchDesktop } from "./WatchDesktop";

export function Watch() {
  // Tauri (all platforms) → MPV desktop player
  // Navigateur → player web avec hls.js
  if (isTauri()) return <WatchDesktop />;
  return <WatchWeb />;
}
