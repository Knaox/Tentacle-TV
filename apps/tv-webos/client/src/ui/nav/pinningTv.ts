import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Ce que le rail n'affiche pas.
 *
 * **Une liste d'exclusion, pas une liste d'épinglage.** Le client web a bien
 * `usePinnedNav`, mais sa sémantique est inverse : le défaut y est vide et
 * signifie « rien dans la barre », ce qui convient à une barre horizontale où
 * la place manque. Son seul écrivain est le menu « Parcourir » de la barre du
 * haut, qui n'existe pas ici — un téléviseur fraîchement jumelé se retrouvait
 * donc avec trois entrées et aucune bibliothèque, sur un serveur qui en compte
 * huit.
 *
 * En inversant, le défaut vide signifie « tout est là » : on découvre son
 * serveur entier au premier allumage, puis on retire ce dont on ne veut pas. Le
 * rail ne peut jamais devenir vide par accident, et il n'y a rien à configurer
 * pour qu'il serve.
 *
 * Le stockage est local à la dalle — c'est déjà le cas de `usePinnedNav`, dont
 * l'origine est celle du serveur sur CE téléviseur. Deux appareils ne partagent
 * donc pas leur rail, ce qui est le comportement attendu : le salon et la
 * chambre ne regardent pas les mêmes choses.
 *
 * Le motif est celui d'`usePinnedNav` — instantané partagé en module et
 * `useSyncExternalStore` — pour que toutes les instances du hook restent
 * d'accord sans passer par un contexte.
 */

const CLE_STOCKAGE = "tentacle_webos_rail";

interface EtatRail {
  masquees: string[];
}

const VIDE: EtatRail = { masquees: [] };

let instantane: EtatRail = lireStockage();
const auditeurs = new Set<() => void>();

function lireStockage(): EtatRail {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return VIDE;
    const lu = JSON.parse(brut) as Partial<EtatRail>;
    return { masquees: Array.isArray(lu.masquees) ? lu.masquees : [] };
  } catch {
    return VIDE;
  }
}

function ecrire(suivant: EtatRail): void {
  instantane = suivant;
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(suivant));
  } catch {
    // Stockage indisponible : le rail vaut pour cette session, et c'est tout.
  }
  auditeurs.forEach((auditeur) => auditeur());
}

function sAbonner(rappel: () => void): () => void {
  auditeurs.add(rappel);
  return () => {
    auditeurs.delete(rappel);
  };
}

function lireInstantane(): EtatRail {
  return instantane;
}

export interface EpinglageRail {
  masquees: string[];
  estMasquee: (cle: string) => boolean;
  basculer: (cle: string) => void;
  toutAfficher: () => void;
}

export function useEpinglageRail(): EpinglageRail {
  const etat = useSyncExternalStore(sAbonner, lireInstantane);

  const basculer = useCallback((cle: string) => {
    const precedent = lireInstantane();
    const masquees = precedent.masquees.indexOf(cle) >= 0
      ? precedent.masquees.filter((autre) => autre !== cle)
      : precedent.masquees.concat(cle);
    ecrire({ masquees });
  }, []);

  const toutAfficher = useCallback(() => {
    if (lireInstantane().masquees.length === 0) return;
    ecrire({ masquees: [] });
  }, []);

  const estMasquee = useCallback(
    (cle: string) => etat.masquees.indexOf(cle) >= 0,
    [etat.masquees],
  );

  return useMemo(
    () => ({ masquees: etat.masquees, estMasquee, basculer, toutAfficher }),
    [etat.masquees, estMasquee, basculer, toutAfficher],
  );
}
