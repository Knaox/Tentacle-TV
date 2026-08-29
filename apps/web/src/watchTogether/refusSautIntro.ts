import { useEffect, useSyncExternalStore } from "react";
import { subscribeSocket } from "@tentacle-tv/api-client";
import type { SegmentType } from "@tentacle-tv/shared";
import { wtLog } from "./wtLog";

/**
 * Le refus du saut d'un PASSAGE, partagé par le groupe.
 *
 * # Pourquoi un bus plutôt qu'une propriété de plus
 *
 * Le décompte vit dans les surcouches du lecteur ; le moteur de groupe, deux
 * étages plus haut. Faire descendre l'un jusqu'à l'autre demanderait des lignes
 * à `VideoPlayer` et `DesktopPlayer`, qui sont tous deux au plafond des 300 —
 * pour un signal qui ne porte rien d'autre que « quelqu'un a dit non ». Le
 * dépôt a déjà ce motif ailleurs (`osdFocusBus`, côté téléviseur).
 *
 * # Pourquoi le refus voyage, et pas le saut
 *
 * La position de lecture est commune à la séance. Un saut se propage donc tout
 * seul, par la synchronisation habituelle, et le décompte de l'autre membre
 * s'éteint de lui-même quand la lecture quitte l'intro. Le refus, lui, ne
 * produit aucun mouvement : sans ce relais, le décompte du voisin partirait
 * quand même et traînerait hors de l'intro celui qui venait de la garder.
 */

/** Le compteur porte le front, le type dit QUEL passage a été gardé. */
export interface RefusDistant {
  readonly compteur: number;
  readonly type: SegmentType;
}

let refus: RefusDistant = { compteur: 0, type: "Intro" };
const auditeurs = new Set<() => void>();

// L'instantané est REMPLACÉ, jamais muté : `useSyncExternalStore` compare les
// identités, et rendre un objet neuf à chaque lecture boucherait le rendu.
const lire = (): RefusDistant => refus;

const emettre = (type: SegmentType): void => {
  refus = { compteur: refus.compteur + 1, type };
  for (const auditeur of auditeurs) auditeur();
};

const sAbonner = (auditeur: () => void): (() => void) => {
  auditeurs.add(auditeur);
  return () => {
    auditeurs.delete(auditeur);
  };
};

/** Le dernier refus reçu — le décompte n'en lit que les fronts (le compteur). */
export function useRefusSautIntro(): RefusDistant {
  return useSyncExternalStore(sAbonner, lire, lire);
}

/** Un membre du groupe s'y oppose : on s'aligne. */
export const signalerRefusDistant = emettre;

/**
 * Le pont, monté par les pages de lecture : il diffuse le refus local au groupe
 * et relaie celui des autres. Sans groupe actif, il ne fait rien.
 */
export function useSautIntroGroupe(
  notifier: ((type: SegmentType) => void) | undefined,
): void {
  useEffect(() => {
    return subscribeSocket((msg) => {
      if (msg.type === "wt:skipIntroDismiss") {
        // Type absent : un client d'avant la refonte, qui ne savait sauter que
        // l'intro. C'est la compatibilité ascendante du protocole.
        const type = msg.segmentType ?? "Intro";
        wtLog("engine", "refus de saut distant", { from: msg.originUserId, type });
        signalerRefusDistant(type);
      }
    });
  }, []);

  useEffect(() => {
    notifierLocal = notifier;
    return () => {
      notifierLocal = undefined;
    };
  }, [notifier]);
}

let notifierLocal: ((type: SegmentType) => void) | undefined;

/** La croix vient d'être cliquée : l'annoncer au groupe, s'il y en a un. */
export const annoncerRefusLocal = (type: SegmentType): void => notifierLocal?.(type);
