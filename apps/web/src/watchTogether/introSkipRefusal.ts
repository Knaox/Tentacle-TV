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
export interface RemoteRefusal {
  readonly counter: number;
  readonly type: SegmentType;
}

let refusal: RemoteRefusal = { counter: 0, type: "Intro" };
const listeners = new Set<() => void>();

// L'instantané est REMPLACÉ, jamais muté : `useSyncExternalStore` compare les
// identités, et rendre un objet neuf à chaque lecture boucherait le rendu.
const read = (): RemoteRefusal => refusal;

const emit = (type: SegmentType): void => {
  refusal = { counter: refusal.counter + 1, type };
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Le dernier refus reçu — le décompte n'en lit que les fronts (le compteur). */
export function useIntroSkipRefusal(): RemoteRefusal {
  return useSyncExternalStore(subscribe, read, read);
}

/** Un membre du groupe s'y oppose : on s'aligne. */
export const reportRemoteRefusal = emit;

/**
 * Le pont, monté par les pages de lecture : il diffuse le refus local au groupe
 * et relaie celui des autres. Sans groupe actif, il ne fait rien.
 */
export function useGroupIntroSkip(
  notify: ((type: SegmentType) => void) | undefined,
): void {
  useEffect(() => {
    return subscribeSocket((msg) => {
      if (msg.type === "wt:skipIntroDismiss") {
        // Type absent : un client d'avant la refonte, qui ne savait sauter que
        // l'intro. C'est la compatibilité ascendante du protocole.
        const type = msg.segmentType ?? "Intro";
        wtLog("engine", "refus de saut distant", { from: msg.originUserId, type });
        reportRemoteRefusal(type);
      }
    });
  }, []);

  useEffect(() => {
    localNotify = notify;
    return () => {
      localNotify = undefined;
    };
  }, [notify]);
}

let localNotify: ((type: SegmentType) => void) | undefined;

/** La croix vient d'être cliquée : l'annoncer au groupe, s'il y en a un. */
export const announceLocalRefusal = (type: SegmentType): void => localNotify?.(type);
