import { useState } from "react";
import { isTauri } from "../hooks/useDesktopPlayer";
import { WatchWeb } from "./WatchWeb";
import { WatchDesktop } from "./WatchDesktop";

export function Watch() {
  // Tauri (toutes plateformes) → MPV desktop player
  // Navigateur → player web avec hls.js
  // Si mpv plante (init timeout, erreur Rust), bascule auto vers le player web
  // (hls.js utilise le webview natif et n'a pas la dépendance libmpv).
  const [forceWeb, setForceWeb] = useState(false);
  if (isTauri() && !forceWeb) return <WatchDesktop onFallbackToWeb={() => setForceWeb(true)} />;
  return <WatchWeb />;
}
