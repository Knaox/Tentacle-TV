import { magasinEpinglageRail } from "../components/nav/railPinning";
import { magasinSautIntro } from "./sautIntroAuto";

/**
 * Les magasins de réglages sont créés au CHARGEMENT DES MODULES, avant que le
 * stockage natif ne soit hydraté : sur Android TV, `getItem` ne lit qu'un cache
 * rempli par un `hydrate()` asynchrone. Sans cette relecture, chaque réglage
 * repart à sa valeur par défaut à chaque démarrage — c'est le défaut qui avait
 * fait réapparaître les entrées masquées du rail.
 *
 * À appeler une fois, juste après `hydrate()`.
 */
export function rehydraterMagasins(): void {
  magasinEpinglageRail.rehydrater();
  magasinSautIntro.rehydrater();
}
