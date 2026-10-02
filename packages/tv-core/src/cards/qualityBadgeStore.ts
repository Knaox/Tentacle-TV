import { NO_QUALITY_BADGES, qualityBadgesOf, type MediaItem, type QualityBadge } from "@tentacle-tv/shared";

/**
 * La qualité des titres, lue à la demande — pour les badges du focus d'une
 * carte (4K, Dolby Vision, Dolby Atmos) quand sa liste ne porte pas les flux
 * (une grille de mille titres, chargée légère exprès) :
 *
 * - un titre déjà lu, ou dont la fiche est en cache (`peekItem`), se dit sans
 *   requête ;
 * - sinon UNE lecture (`load` : ses flux seuls), quand le focus d'une carte a
 *   tenu — le délai, c'est la vue qui le tient : un focus qui balaie une
 *   rangée ne demande rien. Jamais deux lectures du même titre à la fois ;
 * - ce qui est lu se garde pour la session : une liste partagée par
 *   combinaison, rien ne pèse (`maxKnown` titres au plus, les plus anciens
 *   s'en vont) ;
 * - un échec ne se garde pas, mais suspend les lectures un moment
 *   (`failureCooldownMs`) : un serveur qui ne répond plus n'en reçoit pas une
 *   par carte focalisée.
 *
 * Rien ne s'annule en vol : le client Jellyfin n'emploie aucun signal
 * d'annulation (`fetchWithRetry`). Une réponse arrivée après le départ du
 * focus se garde — elle sert au retour sur la carte.
 */

export interface QualityBadgeStoreOptions {
  /** Lit les flux d'un titre : l'item, ou `undefined` s'il n'existe plus. */
  load: (id: string) => Promise<MediaItem | undefined>;
  /** Un item déjà en cache ailleurs (la fiche ouverte), lu sans requête. */
  peekItem?: (id: string) => MediaItem | undefined;
  maxKnown?: number;
  failureCooldownMs?: number;
  now?: () => number;
}

export interface QualityBadgeStore {
  /** Ce qui est connu du titre, sans rien demander. */
  peek(id: string): readonly QualityBadge[] | undefined;
  /** Lire le titre, s'il n'est ni connu, ni en route, ni en attente après un échec. */
  request(id: string): void;
  /** Être prévenu quand le titre devient connu ; rend de quoi se désabonner. */
  subscribe(id: string, onChange: () => void): () => void;
  /** Ce que le magasin a fait (lectures parties, échecs, titres connus). */
  stats(): { requests: number; failures: number; known: number };
}

const MAX_KNOWN = 5000;
const FAILURE_COOLDOWN_MS = 15_000;

export function createQualityBadgeStore({
  load,
  peekItem,
  maxKnown = MAX_KNOWN,
  failureCooldownMs = FAILURE_COOLDOWN_MS,
  now = Date.now,
}: QualityBadgeStoreOptions): QualityBadgeStore {
  const known = new Map<string, readonly QualityBadge[]>();
  const pending = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  let pausedUntil = 0;
  let requests = 0;
  let failures = 0;

  const remember = (id: string, badges: readonly QualityBadge[]) => {
    known.delete(id);
    if (known.size >= maxKnown) known.delete(known.keys().next().value as string);
    known.set(id, badges);
  };

  const peek = (id: string): readonly QualityBadge[] | undefined => {
    const badges = known.get(id);
    if (badges) return badges;
    const cached = peekItem ? qualityBadgesOf(peekItem(id)) : undefined;
    if (cached) remember(id, cached);
    return cached;
  };

  const request = (id: string) => {
    if (pending.has(id) || peek(id) || now() < pausedUntil) return;
    pending.add(id);
    requests += 1;
    load(id).then(
      (item) => {
        pending.delete(id);
        // Un item sans ses flux (ou disparu) : connu, et sans badge — il ne se redemande pas.
        remember(id, qualityBadgesOf(item) ?? NO_QUALITY_BADGES);
        listeners.get(id)?.forEach((listener) => listener());
      },
      () => {
        pending.delete(id);
        failures += 1;
        pausedUntil = now() + failureCooldownMs;
      },
    );
  };

  const subscribe = (id: string, onChange: () => void) => {
    let set = listeners.get(id);
    if (!set) {
      set = new Set();
      listeners.set(id, set);
    }
    set.add(onChange);
    return () => {
      set.delete(onChange);
      if (set.size === 0) listeners.delete(id);
    };
  };

  return { peek, request, subscribe, stats: () => ({ requests, failures, known: known.size }) };
}
