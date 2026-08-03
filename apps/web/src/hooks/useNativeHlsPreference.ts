import { isTauriShell } from "../desktop/bridge";
import { isMacOS } from "./useDesktopPlayer";

/**
 * Faut-il confier le HLS au moteur plutôt qu'à hls.js ?
 *
 * Le HLS natif est celui de WebKit. `isTauriShell()` répondant oui sous
 * Electron aussi, la coquille Electron macOS l'activait — alors que son moteur
 * est Chromium, qui n'a pas de HLS natif et a besoin de hls.js. Même piège que
 * dans `usePlaybackInfo`, et invisible sous Windows où `isMacOS()` est faux.
 *
 * Extrait de `WatchWeb` pour donner un point d'accroche unique : les coquilles
 * dont le décodage passe par le matériel — un téléviseur, par exemple —
 * répondent oui sans qu'aucune condition de plateforme ait à être écrite dans
 * le lecteur.
 */
export function preferNativeHls(): boolean {
  return isTauriShell() && isMacOS();
}
