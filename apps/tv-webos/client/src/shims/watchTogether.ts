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

/**
 * `isInGroup` à VRAI, et ce n'est pas une inversion de sens : c'est la réponse
 * à la seule question que les appelants posent réellement.
 *
 * Ils ne demandent pas « suis-je en groupe ? » mais « dois-je proposer le
 * visionnage synchronisé ? ». `DetailActions` teste `!isInGroup || isHost`, et
 * répondait donc OUI avec un faux : la fiche média portait un bouton circulaire
 * mort, qui prenait une place dans le parcours du D-pad et ne menait nulle
 * part. `PlaybackRateControl` fait de même pour la vitesse de lecture, dont
 * personne ne veut dans un salon.
 *
 * Un `isHost` faux à côté ferme la seule branche qui rendrait quelque chose. Ce
 * sont les deux seuls lecteurs hors du module `watchTogether/`, absent du
 * bundle : une ligne retire deux cibles mortes.
 */
const HORS_GROUPE: WatchTogetherContextValue = {
  room: null,
  invites: [],
  selfId: null,
  isInGroup: true,
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
