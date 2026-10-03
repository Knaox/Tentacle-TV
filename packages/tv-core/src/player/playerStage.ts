/**
 * Ce que l'habillage du lecteur MONTRE, et qui tient le focus — des
 * dérivations pures de l'état du lecteur (Apple TV refondu). Les vues les
 * suivent (`PlayerChromeView`), le focus aussi : la même règle des deux
 * côtés, jamais deux copies.
 */

/** Ce que l'habillage lit de l'état du lecteur. */
export interface PlayerChromeState {
  /** La lecture a commencé (ni ouverture, ni échec avant la première image). */
  playing: boolean;
  /** L'habillage allumé par les contrôles (`overlayVisible`). */
  overlayVisible: boolean;
  /** Épinglé par la pause, tant que Retour ne l'a pas masqué. */
  pinned: boolean;
  scrubbing: boolean;
  /** Une surface « À suivre » (carte ou affiche de fin) est montée. */
  autoPlayActive: boolean;
  /** Un panneau (épisodes, pistes, réglages) est à l'écran. */
  panelShown: boolean;
  endScreenShown: boolean;
  /** Le message-outil, activé, couvre la dalle. */
  troubleCovers: boolean;
  skipShown: boolean;
  upNextShown: boolean;
}

export interface PlayerChromeVisibility {
  /** L'habillage à l'écran — avant ce qui le recouvre. */
  osdVisible: boolean;
  /** Ce qui recouvre fait taire le reste (pilule, carte). */
  covered: boolean;
  /** L'habillage À L'ÉCRAN : Retour le masque. */
  osdShown: boolean;
  pillShown: boolean;
  upNextShown: boolean;
}

/**
 * L'habillage : affiché, ou épinglé par la pause hors défilement ; il se tait
 * devant une carte « À suivre », et la vue devant le reste (panneau,
 * défilement, fin, message-outil activé).
 */
export function playerChromeVisibility(s: PlayerChromeState): PlayerChromeVisibility {
  const osdVisible = (s.overlayVisible && !s.autoPlayActive) || (s.pinned && !s.scrubbing);
  const covered = !s.playing || s.scrubbing || s.panelShown || s.endScreenShown || s.troubleCovers;
  return {
    osdVisible,
    covered,
    osdShown: s.playing && osdVisible && !s.panelShown && !s.scrubbing && !s.endScreenShown && !s.troubleCovers,
    pillShown: s.skipShown && !covered,
    upNextShown: s.upNextShown && !covered,
  };
}

/** Ce que le FOND du lecteur lit pour savoir s'il tient le focus. */
export interface PlayerBackgroundState {
  loading: boolean;
  overlayVisible: boolean;
  pinned: boolean;
  scrubbing: boolean;
  showSettings: boolean;
  showEpisodes: boolean;
  autoPlayActive: boolean;
  troubleCovers: boolean;
  /** Le genre de surimpression de l'arbitre (`skip`, `nextButton`, …). */
  overlayKind: string;
}

export interface PlayerBackgroundFocus {
  /** Quelque chose recouvre la vidéo : le fond se retire de l'accessibilité. */
  panelOpen: boolean;
  /** Focalisable : habillage caché, rien par-dessus, lecture commencée. */
  focusable: boolean;
  /** Il RÉCLAME le focus — sauf sous un bouton de saut, qui le garde. */
  claims: boolean;
}

/**
 * Le fond du lecteur : focalisable seulement quand l'habillage est caché et
 * que rien ne le recouvre — OK ou une direction le rallume. Jamais sous
 * l'écran d'ouverture : c'est sa sortie qui tient le focus.
 */
export function playerBackgroundFocus(s: PlayerBackgroundState): PlayerBackgroundFocus {
  const overlayShown = s.overlayVisible || (s.pinned && !s.scrubbing);
  const panelOpen = s.showSettings || s.autoPlayActive || s.showEpisodes || s.troubleCovers;
  const focusable = !s.loading && !overlayShown && !panelOpen;
  const skipActive = s.overlayKind === "skip" || s.overlayKind === "nextButton";
  return { panelOpen, focusable, claims: focusable && !skipActive };
}
