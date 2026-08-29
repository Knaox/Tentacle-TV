/**
 * Ce que Linux ajoute à la fabrication de la fenêtre.
 *
 * Une seule option, mais elle ne se devine pas : **Linux se range du côté de
 * macOS, pas de celui de Windows.**
 *
 * Sous Windows, `transparent: true` est banni — il y retire le cadre, empêche le
 * redimensionnement et casse `setFullScreen` — et `setBackgroundColor` avec un
 * alpha nul, posé à l'exécution, suffit à laisser voir la fenêtre de mpv.
 *
 * ⚠️ **Ce geste ne marche pas ici.** Mesuré le 25.08.2026 sur KWin Wayland, en
 * comptant les pixels d'une capture pendant une lecture, tout le reste égal :
 *
 *     transparent posé à l'exécution   vidéo visible sur  7,3 % de l'écran,
 *                                      noir sur 71,3 %  → la page peint par-dessus
 *     transparent à la construction    vidéo visible sur 19,2 % de l'écran,
 *                                      noir sur 36,8 %  → l'écran entier de la vidéo
 *
 * Comme sur macOS, Chromium n'alloue une surface avec canal alpha que si la
 * fenêtre est fabriquée transparente.
 *
 * Et contrairement à Windows, le drapeau ne coûte ici aucun des trois défauts :
 * relevé dans la même mesure, `isResizable`, `isMaximizable` et `isFullScreen`
 * répondent tous correctement, cadre natif compris. Rien à compenser.
 */

/** Les options de fenêtre propres à Linux. Vide ailleurs. */
export function linuxFrameOptions(): Record<string, unknown> {
  if (process.platform !== "linux") return {};
  return { transparent: true };
}
