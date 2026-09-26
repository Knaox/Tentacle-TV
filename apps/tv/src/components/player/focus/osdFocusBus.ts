import { useSyncExternalStore, type Component } from "react";

/**
 * Node natif (Pressable) du bouton play/pause de l'OSD — cible du
 * TVFocusGuideView de sortie du bouton skip (TVPlaybackOverlay) : tvOS
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
 * `TVFocusGuideView destinations` est là aussi le seul pont fiable. Android,
 * lui, obéit d'abord aux `nextFocusUp` — qui visaient « quitter » : le cœur
 * du focus de l'habillage vise donc ce même node (`useOverlayFocusCore`).
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

/**
 * Le bouton de saut qui APPARAÎT prend le focus — même quand l'habillage se
 * rallume au même instant.
 *
 * C'est le cas à la sortie d'une avance rapide : l'habillage revient, le
 * bouton reparaît un rendu plus tard, et la restauration de l'habillage
 * (220 ms) passait APRÈS la réclamation du bouton (120 ms) — elle la défaisait.
 * Le bouton horodate son APPARITION quand il réclame ; une restauration
 * IMPLICITE (« le dernier bouton utilisé ») qui la voit récente lui cède. Une
 * cible NOMMÉE (fermeture d'un panneau, entrée dans la vidéo) ne cède pas :
 * elle a été décidée.
 */
let skipClaimedAt = 0;

export function noteSkipFocusClaim(): void {
  skipClaimedAt = Date.now();
}

/** Le bouton de saut a-t-il réclamé le focus depuis `since` (ms epoch) ? */
export function skipClaimedSince(since: number): boolean {
  return skipClaimedAt >= since;
}

/**
 * Rendre le focus à l'habillage quand le bouton de saut qui le tenait s'en va
 * (passage fini, sauté, refusé). Un bouton démonté ne rend son focus à
 * personne : sur Android, plus rien n'était focalisé, les touches n'arrivaient
 * plus au JS, et la télécommande restait morte jusqu'à l'extinction de
 * l'habillage. Posé par `useOverlayFocusCore`, qui sait quel bouton rejoindre.
 */
let osdFocusReturn: (() => void) | null = null;

/** Rend le désabonnement — qui n'efface que SA fonction : l'épisode suivant
 *  (`navigation.replace`) monte son habillage avant que l'ancien parte. */
export function setOsdFocusReturn(fn: () => void): () => void {
  osdFocusReturn = fn;
  return () => { if (osdFocusReturn === fn) osdFocusReturn = null; };
}

export function returnFocusToOsd(): void {
  osdFocusReturn?.();
}
