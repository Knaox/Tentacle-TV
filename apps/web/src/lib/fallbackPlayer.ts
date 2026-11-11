import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * La bascule vers le lecteur de secours (web), mémorisée pour la SESSION.
 *
 * Elle vivait dans un `useState` local de `Watch` : chaque navigation vers un
 * autre film remontait la page, oubliait l'échec, et repayait l'init mpv — ou
 * ses huit secondes d'attente — avant de rebasculer. Store module (modèle :
 * `watchTogether/chat/chatUiStore.ts`) : la mémoire survit à la navigation et
 * repart à zéro au relancement de l'application, ce qui redonne sa chance au
 * lecteur natif après une mise à jour ou un correctif.
 *
 * `cancelFallbackSwitch` sert l'outil de debug : retenter mpv sans relancer.
 *
 * Le RELAIS : quand mpv lâche en pleine lecture, la bascule emporte le titre
 * et la position de l'arrêt — le lecteur web reprend LÀ, pas au point de
 * reprise de la fiche (que le serveur n'a connu, au mieux, que dix secondes
 * plus tôt). Il ne vaut que pour l'ouverture qui suit, de ce titre-là.
 */

/** Où le lecteur web doit reprendre : le titre que mpv lisait, et sa position à l'arrêt. */
export interface FallbackHandover {
  itemId: string;
  positionSeconds: number;
}

let fallback = false;
let handover: FallbackHandover | null = null;
const subscribers = new Set<() => void>();

function publish(valeur: boolean): void {
  if (fallback === valeur) return;
  fallback = valeur;
  for (const subscriber of subscribers) subscriber();
}

/**
 * À brancher sur `onFallbackToWeb` : la session passe au lecteur web. `at` :
 * la lecture avait commencé — le lecteur web la reprend à cette position.
 */
export function reportFallbackSwitch(at?: FallbackHandover): void {
  handover = at && at.itemId && at.positionSeconds > 0 ? { ...at } : null;
  publish(true);
}

/** La position du relais pour ce titre (secondes) ; rien pour un autre titre, ni sans relais. */
export function fallbackHandoverFor(itemId: string | undefined): number | undefined {
  return handover !== null && handover.itemId === itemId ? handover.positionSeconds : undefined;
}

/** Le relais de ce titre est passé (son lecteur se ferme) : la prochaine ouverture reprend comme toujours. */
export function settleFallbackHandover(itemId: string | undefined): void {
  if (handover !== null && handover.itemId === itemId) handover = null;
}

/**
 * La position du relais pour le lecteur web de `itemId`, FIGÉE pour cette
 * ouverture du titre et oubliée dès qu'il se ferme ou change de titre :
 * rouvrir le film plus tard reprend au point de reprise de la fiche.
 */
export function useFallbackHandover(itemId: string | undefined): number | undefined {
  const at = useMemo(() => fallbackHandoverFor(itemId), [itemId]);
  useEffect(() => () => settleFallbackHandover(itemId), [itemId]);
  return at;
}

/** Redonne sa chance au lecteur natif (debug, ou action « réessayer »). */
export function cancelFallbackSwitch(): void {
  publish(false);
}

/** Lecture ponctuelle, hors React. */
export function isFallbackActive(): boolean {
  return fallback;
}

/** La bascule, réactive — pour `Watch` et le bandeau. */
export function useFallbackPlayer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => fallback,
  );
}
