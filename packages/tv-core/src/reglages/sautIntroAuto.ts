import { useSyncExternalStore } from "react";
import {
  CLES_REGLAGE_APPAREIL,
  creerMagasinBooleen,
  type MagasinBooleen,
  type StockageAppareil,
} from "@tentacle-tv/shared";

/**
 * « Passer l'intro automatiquement » — un booléen, trois téléviseurs.
 *
 * Le magasin reçoit son stockage plutôt que d'en supposer un : `localStorage`
 * sur la LG, `RNStorageAdapter` sur l'Apple TV et l'Android TV. C'est le motif
 * du rail (`nav/railPinning.ts`), qui sert déjà les trois cibles avec un seul
 * jeu de règles.
 *
 * La clé, le défaut et la mécanique viennent de `@tentacle-tv/shared` : le web
 * et l'ordinateur lisent la même chose, et il n'y a qu'un endroit à changer.
 *
 * ALLUMÉ par défaut — voir `DEFAUT_REGLAGE_APPAREIL`.
 */

export const CLE_SAUT_INTRO_AUTO = CLES_REGLAGE_APPAREIL.sautIntroAuto;

/** Conservés sous leurs anciens noms : trois applications les importent. */
export type StockageSautIntro = StockageAppareil;
export type MagasinSautIntro = MagasinBooleen;

export function creerMagasinSautIntro(
  stockage: StockageSautIntro,
  cle: string = CLE_SAUT_INTRO_AUTO,
): MagasinSautIntro {
  return creerMagasinBooleen(stockage, cle);
}

/** Le hook, lié à un magasin. Chaque cible en fabrique un au démarrage. */
export function creerUseSautIntroAuto(magasin: MagasinSautIntro) {
  return function useSautIntroAuto(): boolean {
    return useSyncExternalStore(magasin.sAbonner, magasin.lireInstantane, magasin.lireInstantane);
  };
}
