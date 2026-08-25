/**
 * Faut-il confier le HLS au moteur plutôt qu'à hls.js ?
 *
 * Le HLS natif était celui de WebKit, sous la coquille Tauri de macOS. Il n'y a
 * plus de WebKit : les trois systèmes tournent sur Chromium, qui n'a pas de HLS
 * natif et a besoin de hls.js.
 *
 * Le point d'accroche est conservé, et c'est sa raison d'être : les coquilles
 * dont le décodage passe par le matériel — un téléviseur, par exemple —
 * substituent ce module et répondent oui, sans qu'aucune condition de
 * plateforme ait à être écrite dans le lecteur.
 */
export function preferNativeHls(): boolean {
  return false;
}

/**
 * Sous HLS natif, le sélecteur de qualité reste-t-il opérant ?
 *
 * Changer de palier ne passe pas par les niveaux de hls.js : la page recrée
 * la session (`handleQualityChange` → nouvelle PlaybackInfo → nouvelle URL),
 * ce qui fonctionne quel que soit le démultiplexeur. Historiquement le
 * lecteur masquait pourtant le sélecteur dès que le moteur prenait le HLS —
 * prudence héritée de la coquille macOS, où la lecture passe de toute façon
 * par mpv. On garde ce comportement ici ; le client téléviseur, dont c'est
 * l'unique mécanisme de changement de qualité, substitue ce module et répond
 * oui.
 */
export function nativeHlsSupportsQualitySwitch(): boolean {
  return false;
}
