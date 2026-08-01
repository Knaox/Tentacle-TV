import { useState } from "react";
import { supportsMpv } from "../desktop/bridge";
import { WatchWeb } from "./WatchWeb";
import { WatchDesktop } from "./WatchDesktop";

export function Watch() {
  // Shell doté de mpv (toutes plateformes) → lecteur desktop
  // Navigateur, ou shell sans mpv → lecteur web avec hls.js
  // Si mpv plante (init timeout, erreur native), bascule auto vers le player web
  // (hls.js utilise le webview natif et n'a pas la dépendance libmpv).
  //
  // La porte est `supportsMpv()` et non « suis-je sur le bureau » : pendant la
  // migration, la coquille Electron est une app de bureau qui n'a pas encore
  // son adaptateur mpv. Sans cette distinction, elle partait sur le lecteur
  // natif et n'avait personne au bout du fil.
  const [forceWeb, setForceWeb] = useState(false);
  if (supportsMpv() && !forceWeb) return <WatchDesktop onFallbackToWeb={() => setForceWeb(true)} />;
  return <WatchWeb />;
}
