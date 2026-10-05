/**
 * La FORME des traits de la plateforme — ce que l'appareil sait rendre ou
 * offrir, lu par l'interface au lieu d'un `Platform.OS`. Les valeurs vivent
 * dans `traits.ts` (Apple TV, la base) et `traits.android.ts` ; ceux de la
 * télécommande sont à part, dans sa table (`RemoteBindings.traits`, tv-core).
 */
export interface PlatformTraits {
  /** Le réglage « Liquid Glass » existe : faux, le verre reste ENRICHI (le
   *  rendu du réglage coupé) et le réglage n'est pas proposé. */
  liquidGlass: boolean;
  /** Le moteur du lecteur annonce sa première image posée, son prêt (Exo,
   *  mpv) : le lecteur le tient en pause jusque-là, puis lève l'écran de
   *  chargement et la pause d'un même geste (tv-core `startGate`). */
  playerAnnouncesFirstFrame: boolean;
}
