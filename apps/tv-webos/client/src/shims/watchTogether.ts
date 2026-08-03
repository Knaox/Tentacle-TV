import { createElement, type ReactNode, type ReactElement } from "react";

/**
 * Visionnage synchronisé, neutralisé.
 *
 * La fonctionnalité suppose un second écran pour la conversation et une saisie
 * de texte confortable — deux choses qu'un salon n'offre pas. Le fournisseur
 * laisse passer ses enfants sans ouvrir de connexion ni monter la surcouche de
 * discussion, ce qui sort du bundle l'arbre `watchTogether/` en entier, y
 * compris les seuls appelants de `useMotionValue`, `useDragControls` et
 * `animate`.
 */
export function WatchTogetherProvider(
  proprietes: { children?: ReactNode },
): ReactElement {
  return createElement("div", { style: { display: "contents" } }, proprietes.children);
}

export interface WatchTogetherContextValue {
  room: null;
  invites: readonly never[];
  selfId: null;
  isInGroup: boolean;
  isHost: boolean;
  send: () => boolean;
  serverNow: () => number;
  actions: Record<string, () => Promise<never>>;
}

const HORS_GROUPE: WatchTogetherContextValue = {
  room: null,
  invites: [],
  selfId: null,
  isInGroup: false,
  isHost: false,
  send: () => false,
  serverNow: () => Date.now(),
  actions: {
    create: refuser,
    invite: refuser,
    respond: refuser,
    leave: refuser,
    kick: refuser,
  },
};

/**
 * Le vrai hook lève quand il est appelé hors du fournisseur. Ici il rend un
 * état « jamais en groupe » : les appelants testent tous `isInGroup` avant
 * d'afficher quoi que ce soit, et leurs boutons ne mènent nulle part.
 */
export function useWatchTogether(): WatchTogetherContextValue {
  return HORS_GROUPE;
}

function refuser(): Promise<never> {
  return Promise.reject(new Error("Visionnage synchronisé indisponible sur le téléviseur"));
}
