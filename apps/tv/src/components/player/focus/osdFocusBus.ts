import { useSyncExternalStore, type Component } from "react";

/**
 * Node natif (Pressable) du bouton play/pause de l'OSD — cible du
 * TVFocusGuideView de sortie du bouton skip (TVSkipSegmentButton) : tvOS
 * ignore les nextFocus*, un guide `destinations` est le seul pont directionnel
 * fiable. Alimenté par useOverlayFocusCore.registerButton.
 */
export const osdPlayPauseNodeRef: { current: Component | null } = { current: null };

/**
 * Le node natif du BOUTON DE SAUT — la cible du guide qui REMONTE depuis
 * l'habillage.
 *
 * Le pont n'existait que dans un sens : le bouton savait redescendre vers
 * play/pause, mais rien ne permettait d'y monter. Depuis la rangée de
 * transport, appuyer vers le haut ne menait nulle part — le bouton était à
 * l'écran, et hors d'atteinte. tvOS ignorant les `nextFocus*`, un
 * `TVFocusGuideView destinations` est là aussi le seul pont fiable.
 *
 * # Pourquoi un ABONNEMENT et non une simple ref
 *
 * L'habillage est rendu AVANT le bouton dans l'arbre du lecteur. À l'image où
 * il apprend qu'un bouton existe, le node n'est pas encore posé — une ref lue
 * à ce moment vaut `null`, et le guide ne se monterait jamais. L'abonnement
 * refait rendre l'habillage quand le node arrive VRAIMENT, sans que personne
 * ait à raisonner sur l'ordre de montage.
 */
let skipNode: Component | null = null;
const skipNodeWatchers = new Set<() => void>();

/** Publié par le bouton de saut à son montage, retiré à son démontage. */
export function setSkipNode(node: Component | null): void {
  if (skipNode === node) return;
  skipNode = node;
  for (const notify of skipNodeWatchers) notify();
}

function subscribeSkipNode(notify: () => void): () => void {
  skipNodeWatchers.add(notify);
  return () => { skipNodeWatchers.delete(notify); };
}

const readSkipNode = (): Component | null => skipNode;

/** Le node à viser, ou `null` s'il n'y a pas de bouton à atteindre. */
export function useSkipNode(): Component | null {
  return useSyncExternalStore(subscribeSkipNode, readSkipNode, readSkipNode);
}
