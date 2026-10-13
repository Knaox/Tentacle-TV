/**
 * L'état de SÉANCE du retrait des recommandations (cf. recoRetirement.ts) —
 * trois ensembles, sans dépendance : `useRecoPage` le lit dans son `select`
 * sans créer de cycle d'import.
 *
 *   • les cartes TENUES : survolées (leur rangée, sur le web) ou dont la
 *     feuille d'actions est ouverte (mobile, miroir, TV) — un compteur par
 *     carte, la rangée et la feuille peuvent la tenir ensemble ;
 *   • les titres RETIRÉS : jugés (Ma liste, cœur, vu, note) puis lâchés —
 *     aucune page servie ensuite ne les remontre ;
 *   • les titres ÉCARTÉS (« Ne plus me proposer ») : eux partent TOUT DE
 *     SUITE, même d'une rangée tenue ;
 *   • les titres EN PARTANCE : jugés et lâchés, leur carte s'efface le temps
 *     d'un fondu avant le retrait — une carte reprise entre-temps reste.
 *
 * S'y ajoute un signal : le titre qui QUITTE les pages en cache, quelle que
 * soit la raison — la page d'une visite (useRecoPageVisit) l'écoute.
 *
 * Une carte se désigne par la clé du titre (« movie:603 ») ou par son item
 * Jellyfin — la carte d'une télévision ne connaît que lui.
 */

const holds = new Map<string, number>();
const retired = new Set<string>();
const dismissed = new Set<string>();
const leaving = new Map<string, ReturnType<typeof setTimeout> | null>();
const leavingListeners = new Set<() => void>();
const droppedListeners = new Set<(key: string) => void>();

function emitLeaving(): void {
  for (const listener of leavingListeners) listener();
}

/**
 * Un titre QUITTE les pages en cache (refusé, jugé puis lâché, noté, demandé) :
 * toutes ces sorties passent par `dropRecoItemEverywhere`, qui le dit ici. La
 * page d'une visite (cf. useRecoPageVisit) en garde la liste : c'est le seul
 * changement qu'elle laisse passer sous les yeux.
 */
export function emitRecoDropped(key: string): void {
  for (const listener of droppedListeners) listener(key);
}

export function subscribeRecoDropped(listener: (key: string) => void): () => void {
  droppedListeners.add(listener);
  return () => {
    droppedListeners.delete(listener);
  };
}

/** Une page À L'ÉCRAN (forme minimale : ce module ne dépend d'aucun type). */
export interface ShownRecoPage {
  rows: ReadonlyArray<{ items: ReadonlyArray<{ key: string; jellyfinItemId: string | null }> }>;
  featured?: { item: { key: string; jellyfinItemId: string | null } };
}

const shownPages = new Set<ShownRecoPage>();

/**
 * Les pages que les visites MONTRENT (useRecoPageVisit). Le lâcher d'une carte
 * y cherche aussi son titre : le serveur l'écarte de la page qu'il ressert
 * dès qu'il est jugé (vu, aimé, noté), le cache peut donc ne plus le contenir
 * alors que l'écran le montre encore — sans elles, la carte jugée ne partait
 * jamais (2026-10-13).
 */
export function registerShownRecoPage(page: ShownRecoPage): () => void {
  shownPages.add(page);
  return () => {
    shownPages.delete(page);
  };
}

export function shownRecoPages(): ReadonlySet<ShownRecoPage> {
  return shownPages;
}

export function holdRecoCard(id: string): void {
  holds.set(id, (holds.get(id) ?? 0) + 1);
  // Reprise pendant le fondu : la carte reste, le lâcher suivant jugera.
  const timer = leaving.get(id);
  if (timer) {
    clearTimeout(timer);
    leaving.delete(id);
    emitLeaving();
  }
}

/** Relâche une prise ; vrai quand la carte n'est plus tenue du tout. */
export function unholdRecoCard(id: string): boolean {
  const left = (holds.get(id) ?? 0) - 1;
  if (left > 0) {
    holds.set(id, left);
    return false;
  }
  holds.delete(id);
  return true;
}

/** Le titre est-il tenu, par sa clé ou par son item Jellyfin ? */
export function isRecoItemHeld(item: { key: string; jellyfinItemId?: string | null }): boolean {
  return holds.has(item.key) || (!!item.jellyfinItemId && holds.has(item.jellyfinItemId));
}

export function markRecoRetired(key: string): void {
  retired.add(key);
}

export function isRecoRetired(key: string): boolean {
  return retired.has(key);
}

export function hasRetiredReco(): boolean {
  return retired.size > 0;
}

export function markRecoDismissed(key: string): void {
  dismissed.add(key);
}

export function isRecoDismissed(key: string): boolean {
  return dismissed.has(key);
}

/**
 * La carte s'efface pendant `ms`, puis `done` retire le titre. Elle reste
 * marquée en partance jusqu'au bout : se ré-afficher une image avant que le
 * cache ne la retire ferait un éclair.
 */
export function startRecoLeave(key: string, ms: number, done: () => void): void {
  if (leaving.has(key)) return;
  leaving.set(
    key,
    setTimeout(() => {
      leaving.set(key, null);
      done();
    }, ms)
  );
  emitLeaving();
}

export function isRecoLeaving(key: string): boolean {
  return leaving.has(key);
}

export function subscribeRecoLeaving(listener: () => void): () => void {
  leavingListeners.add(listener);
  return () => {
    leavingListeners.delete(listener);
  };
}

/** Isolation des tests. */
export function resetRecoRetirementForTests(): void {
  holds.clear();
  retired.clear();
  dismissed.clear();
  for (const timer of leaving.values()) if (timer) clearTimeout(timer);
  leaving.clear();
}
