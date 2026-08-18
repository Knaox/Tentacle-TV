import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Ce que le rail n'affiche pas.
 *
 * **Une liste d'exclusion, pas une liste d'épinglage.** Le client web a bien
 * `usePinnedNav`, mais sa sémantique est inverse : le défaut y est vide et
 * signifie « rien dans la barre », ce qui convient à une barre horizontale où
 * la place manque. Sur un téléviseur, hériter de ce défaut livrait un serveur
 * de huit bibliothèques derrière trois entrées dont aucune n'y menait.
 *
 * En inversant, le défaut vide signifie « tout est là » : on découvre son
 * serveur entier au premier allumage, puis on retire ce dont on ne veut pas. Le
 * rail ne peut jamais devenir vide par accident, et il n'y a rien à configurer
 * pour qu'il serve.
 *
 * Le stockage est local à l'appareil, volontairement : le salon et la chambre
 * ne regardent pas les mêmes choses.
 *
 * Module pur : le stockage est injecté. `localStorage` le satisfait tel quel
 * côté LG ; `RNStorageAdapter` aussi côté natif, qui est synchrone une fois
 * hydraté — c'est ce qui permet à `useSyncExternalStore` de fonctionner des
 * deux côtés sans traitement particulier.
 */

export const CLE_STOCKAGE_RAIL = "tentacle_webos_rail";

/** Le minimum qu'un stockage doit offrir. `localStorage` et `RNStorageAdapter`
 *  le satisfont l'un comme l'autre. */
export interface StockageRail {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

interface EtatRail {
  masquees: string[];
}

const VIDE: EtatRail = { masquees: [] };

export interface EpinglageRail {
  masquees: string[];
  estMasquee: (cle: string) => boolean;
  basculer: (cle: string) => void;
  toutAfficher: () => void;
}

export interface MagasinEpinglageRail {
  sAbonner: (rappel: () => void) => () => void;
  lireInstantane: () => EtatRail;
  basculer: (cle: string) => void;
  toutAfficher: () => void;
  estMasquee: (cle: string) => boolean;
}

/**
 * Crée le magasin. Un seul par application : l'instantané est partagé pour que
 * toutes les instances du hook restent d'accord sans passer par un contexte.
 */
export function creerMagasinEpinglageRail(
  stockage: StockageRail,
  cle: string = CLE_STOCKAGE_RAIL,
): MagasinEpinglageRail {
  const auditeurs = new Set<() => void>();

  const lireStockage = (): EtatRail => {
    try {
      const brut = stockage.getItem(cle);
      if (!brut) return VIDE;
      const lu = JSON.parse(brut) as Partial<EtatRail>;
      return { masquees: Array.isArray(lu.masquees) ? lu.masquees : [] };
    } catch {
      // Stockage illisible ou JSON corrompu : le rail montre tout, ce qui est
      // le pire cas acceptable. Un rail vide, lui, ne le serait pas.
      return VIDE;
    }
  };

  let instantane: EtatRail = lireStockage();

  const ecrire = (suivant: EtatRail): void => {
    instantane = suivant;
    try {
      stockage.setItem(cle, JSON.stringify(suivant));
    } catch {
      // Stockage indisponible : le rail vaut pour cette session, et c'est tout.
    }
    auditeurs.forEach((auditeur) => auditeur());
  };

  return {
    sAbonner(rappel) {
      auditeurs.add(rappel);
      return () => {
        auditeurs.delete(rappel);
      };
    },
    lireInstantane: () => instantane,
    basculer(cleEntree) {
      const masquees = instantane.masquees.includes(cleEntree)
        ? instantane.masquees.filter((autre) => autre !== cleEntree)
        : instantane.masquees.concat(cleEntree);
      ecrire({ masquees });
    },
    toutAfficher() {
      if (instantane.masquees.length === 0) return;
      ecrire({ masquees: [] });
    },
    estMasquee: (cleEntree) => instantane.masquees.includes(cleEntree),
  };
}

/** Le hook, lié à un magasin. Chaque cible en fabrique un au démarrage. */
export function creerUseEpinglageRail(magasin: MagasinEpinglageRail) {
  return function useEpinglageRail(): EpinglageRail {
    const etat = useSyncExternalStore(magasin.sAbonner, magasin.lireInstantane);

    const basculer = useCallback((cle: string) => magasin.basculer(cle), []);
    const toutAfficher = useCallback(() => magasin.toutAfficher(), []);
    const estMasquee = useCallback(
      (cle: string) => etat.masquees.includes(cle),
      [etat.masquees],
    );

    return useMemo(
      () => ({ masquees: etat.masquees, estMasquee, basculer, toutAfficher }),
      [etat.masquees, estMasquee, basculer, toutAfficher],
    );
  };
}
