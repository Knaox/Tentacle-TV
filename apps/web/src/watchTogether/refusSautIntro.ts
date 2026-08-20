import { useEffect, useSyncExternalStore } from "react";
import { subscribeSocket } from "@tentacle-tv/api-client";
import { wtLog } from "./wtLog";

/**
 * Le refus du saut d'intro, partagé par le groupe.
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

let refus = 0;
const auditeurs = new Set<() => void>();

const lire = (): number => refus;

const emettre = (): void => {
  refus += 1;
  for (const auditeur of auditeurs) auditeur();
};

const sAbonner = (auditeur: () => void): (() => void) => {
  auditeurs.add(auditeur);
  return () => {
    auditeurs.delete(auditeur);
  };
};

/** Combien de refus ont été prononcés — le décompte n'en lit que les fronts. */
export function useRefusSautIntro(): number {
  return useSyncExternalStore(sAbonner, lire, lire);
}

/** Un membre du groupe s'y oppose : on s'aligne. */
export const signalerRefusDistant = emettre;

/**
 * Le pont, monté par les pages de lecture : il diffuse le refus local au groupe
 * et relaie celui des autres. Sans groupe actif, il ne fait rien.
 */
export function useSautIntroGroupe(notifier: (() => void) | undefined): void {
  useEffect(() => {
    return subscribeSocket((msg) => {
      if (msg.type === "wt:skipIntroDismiss") {
        wtLog("engine", "refus du saut d'intro distant", { from: msg.originUserId });
        signalerRefusDistant();
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

let notifierLocal: (() => void) | undefined;

/** La croix vient d'être cliquée : l'annoncer au groupe, s'il y en a un. */
export const annoncerRefusLocal = (): void => notifierLocal?.();
