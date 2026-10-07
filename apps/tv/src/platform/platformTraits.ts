/**
 * La FORME des traits de la plateforme — ce que l'appareil sait rendre ou
 * offrir, lu par l'interface au lieu d'un `Platform.OS`. Les valeurs vivent
 * dans `traits.ts` (Apple TV, la base) et `traits.android.ts` ; ceux de la
 * télécommande sont à part, dans sa table (`RemoteBindings.traits`, tv-core).
 */
import type { LicensePlatform } from "@tentacle-tv/shared/licenses";

export interface PlatformTraits {
  /** La plateforme de l'inventaire des licences (shared `licenses`) : ce
   *  qu'embarque CETTE application, et le tag de sa source (`tv-vX.Y.Z`). */
  licensePlatform: Extract<LicensePlatform, "tvos" | "androidtv">;
  /** Le réglage « Liquid Glass » existe : faux, le verre reste ENRICHI (le
   *  rendu du réglage coupé) et le réglage n'est pas proposé. */
  liquidGlass: boolean;
  /** Le moteur du lecteur annonce sa première image posée, son prêt (Exo,
   *  mpv) : le lecteur le tient en pause jusque-là, puis lève l'écran de
   *  chargement et la pause d'un même geste (tv-core `startGate`). */
  playerAnnouncesFirstFrame: boolean;
  /** Le réglage « Mode Lite » (Automatique / Activé / Désactivé) existe —
   *  Android TV seulement : le niveau de rendu de l'Apple TV est toujours
   *  « normal » (`platform/renderTier`). */
  renderTierSetting: boolean;
  /** La plateforme donne des focus DE PASSAGE (tv-core `isPassingFocus`) :
   *  Android, au premier focalisable, pendant qu'un élément annoncé avant
   *  d'être attaché s'attache. Ce qui s'ouvre au focus (la navigation) ne
   *  s'ouvre pas pour eux. tvOS : non — la règle n'y est jamais lue. */
  passingFocus: boolean;
}
