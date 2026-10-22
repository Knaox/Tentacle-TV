/**
 * L'épingle du plein écran — montage Wayland forcé (GNOME, wlroots).
 *
 * `SurfaceWayland` tient la fenêtre en plein écran tant qu'une vidéo mpv y est
 * attachée, et rend lui-même l'état d'avant en se détachant. Tant qu'elle est
 * posée, personne d'autre ne doit décider de la fenêtre (`playerExitWindowState`).
 * Sans elle — une bande-annonce, lue en HTML, ou une vidéo déjà détachée —, le
 * montage forcé n'a plus rien à protéger.
 *
 * Module à part, sans import : la session du lecteur le lit sans charger mpv.
 */

let pinned = false;

export function setFullscreenPinned(value: boolean): void {
  pinned = value;
}

export function fullscreenPinned(): boolean {
  return pinned;
}
