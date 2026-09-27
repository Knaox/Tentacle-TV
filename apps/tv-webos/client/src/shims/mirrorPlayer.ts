/**
 * La surcouche du lecteur du miroir (téléphone, iPad), absente.
 *
 * Même raison que `mirrorScreens.ts` : `useMirror()` est toujours faux sur un
 * téléviseur, mais `VideoPlayer` et `WatchWeb` importent la surcouche, et le
 * bundler la compilait avec ses styles en ligne récents (`max()`, `gap`). Le
 * pont rend, comme hors miroir sur le web, la visibilité et le glissé du
 * lecteur de bureau tels quels.
 */

function Absent(): null {
  return null;
}

const NOOP_BRIDGE = { visible: true, setVisible: () => {}, setScrubbing: () => {} };

export const MirrorPlayerOverlay = Absent;
export const MirrorPlayerLoadingScreen = Absent;

export function useMirrorPlayerBridge(desktopVisible: boolean, desktopScrubbing: boolean) {
  return { mirror: false, showControls: desktopVisible, scrubbing: desktopScrubbing, bridge: NOOP_BRIDGE };
}
