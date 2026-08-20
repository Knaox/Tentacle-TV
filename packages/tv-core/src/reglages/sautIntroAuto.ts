import { useSyncExternalStore } from "react";

/**
 * « Passer l'intro automatiquement » — un booléen, trois téléviseurs.
 *
 * Le magasin reçoit son stockage plutôt que d'en supposer un : `localStorage`
 * sur la LG, `RNStorageAdapter` sur l'Apple TV et l'Android TV. C'est le motif
 * du rail (`nav/railPinning.ts`), qui sert déjà les trois cibles avec un seul
 * jeu de règles.
 *
 * Même clé que le web (`tentacle_auto_skip_intro`) : le vocabulaire reste
 * identique d'une plateforme à l'autre, comme pour le Liquid Glass.
 *
 * Éteint par défaut : déplacer la tête de lecture tout seul est une liberté que
 * le lecteur ne prend pas sans qu'on la lui ait donnée.
 */

export const CLE_SAUT_INTRO_AUTO = "tentacle_auto_skip_intro";

/** Le minimum qu'un stockage doit offrir. Les deux le satisfont. */
export interface StockageSautIntro {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

export interface MagasinSautIntro {
  sAbonner(rappel: () => void): () => void;
  lireInstantane(): boolean;
  definir(actif: boolean): void;
  /**
   * Android TV lit un cache rempli par un `hydrate()` asynchrone au démarrage :
   * le premier instantané peut précéder la vraie valeur.
   */
  rehydrater(): void;
}

export function creerMagasinSautIntro(
  stockage: StockageSautIntro,
  cle: string = CLE_SAUT_INTRO_AUTO,
): MagasinSautIntro {
  const auditeurs = new Set<() => void>();

  const lireStockage = (): boolean => {
    try {
      return stockage.getItem(cle) === "true";
    } catch {
      // Stockage illisible : éteint, ce qui est le pire cas acceptable.
      return false;
    }
  };

  let instantane = lireStockage();

  return {
    sAbonner(rappel) {
      auditeurs.add(rappel);
      return () => {
        auditeurs.delete(rappel);
      };
    },
    lireInstantane: () => instantane,
    definir(actif) {
      if (actif === instantane) return;
      instantane = actif;
      try {
        stockage.setItem(cle, String(actif));
      } catch {
        // Stockage indisponible : le réglage vaut pour cette session.
      }
      auditeurs.forEach((auditeur) => auditeur());
    },
    rehydrater() {
      const lu = lireStockage();
      if (lu === instantane) return;
      instantane = lu;
      auditeurs.forEach((auditeur) => auditeur());
    },
  };
}

/** Le hook, lié à un magasin. Chaque cible en fabrique un au démarrage. */
export function creerUseSautIntroAuto(magasin: MagasinSautIntro) {
  return function useSautIntroAuto(): boolean {
    return useSyncExternalStore(magasin.sAbonner, magasin.lireInstantane, magasin.lireInstantane);
  };
}
