import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import {
  ACCESS_SCHEDULE_DAYS,
  UNRATED_ITEM_TYPES,
  type AccessScheduleDto,
  type UnratedItemType,
} from "../../userRights/userRightsContract";
import { normalizeJellyfinId } from "../../userRights/userRightsPatch";

/**
 * La politique de CONTENU d'un compte — ce que sa `UserPolicy` Jellyfin dit de ce
 * qu'il peut voir (docs/DROITS-UTILISATEURS.md § 5). Jellyfin fait foi : relue
 * par la clé d'administration (`GET /Users/{id}`), gardée 30 s au plus, vidée à
 * chaque écriture faite par Tentacle (`invalidateContentPolicy`).
 *
 * FERMÉE À L'ÉCHEC : une politique illisible (Jellyfin muet, compte inconnu,
 * réponse sans `Policy`) vaut la plus restreinte possible — rien d'extérieur,
 * aucune bibliothèque. Jamais « libre ».
 */

export interface ContentPolicy {
  userId: string;
  /** Faux : Jellyfin n'a pas répondu — politique FERMÉE, gardée 5 s seulement. */
  readable: boolean;
  /** Vrai dès qu'une note maximale, une étiquette bloquée ou permise, ou un type non classé est posé. */
  restricted: boolean;
  maxParentalRating: number | null;
  maxParentalSubRating: number | null;
  blockUnratedItems: UnratedItemType[];
  blockedTags: string[];
  allowedTags: string[];
  enableAllFolders: boolean;
  /** Identifiants normalisés (minuscules, sans tirets). */
  enabledFolders: string[];
  blockedMediaFolders: string[];
  accessSchedules: AccessScheduleDto[];
  /** L'ACCÈS du compte (§ 9.1) — `IsDisabled` ; illisible : faux (une panne ne bloque personne). */
  isDisabled: boolean;
  /** `MaxActiveSessions` : 0 = sans limite. */
  maxActiveSessions: number;
  /** `InvalidLoginAttemptCount` et `LoginAttemptsBeforeLockout` (-1 = jamais). */
  invalidLoginAttemptCount: number;
  loginAttemptsBeforeLockout: number;
}

const TTL_MS = 30_000;
const CLOSED_TTL_MS = 5_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { policy: ContentPolicy; expiresAt: number }>();
/** Une lecture en cours par compte : dix requêtes simultanées n'en font qu'une. */
const inflight = new Map<string, Promise<ContentPolicy>>();

/** La politique la plus restreinte : ce que vaut un compte dont on ne sait rien. */
export function closedContentPolicy(userId: string): ContentPolicy {
  return {
    userId,
    readable: false,
    restricted: true,
    maxParentalRating: 0,
    maxParentalSubRating: null,
    blockUnratedItems: [...UNRATED_ITEM_TYPES],
    blockedTags: [],
    allowedTags: [],
    enableAllFolders: false,
    enabledFolders: [],
    blockedMediaFolders: [],
    accessSchedules: [],
    isDisabled: false,
    maxActiveSessions: 0,
    invalidLoginAttemptCount: 0,
    loginAttemptsBeforeLockout: -1,
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function schedules(value: unknown): AccessScheduleDto[] {
  if (!Array.isArray(value)) return [];
  const days = ACCESS_SCHEDULE_DAYS as readonly string[];
  return value.flatMap((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const { DayOfWeek, StartHour, EndHour } = raw;
    if (typeof DayOfWeek !== "string" || !days.includes(DayOfWeek)) return [];
    if (typeof StartHour !== "number" || typeof EndHour !== "number") return [];
    return [{ dayOfWeek: DayOfWeek as AccessScheduleDto["dayOfWeek"], startHour: StartHour, endHour: EndHour }];
  });
}

/** La politique de contenu tirée d'une `UserPolicy` Jellyfin (règle pure). */
export function contentPolicyFromJellyfin(userId: string, policy: Record<string, unknown>): ContentPolicy {
  const unrated = strings(policy.BlockUnratedItems).filter((item): item is UnratedItemType =>
    (UNRATED_ITEM_TYPES as readonly string[]).includes(item),
  );
  const result: Omit<ContentPolicy, "restricted"> = {
    userId,
    readable: true,
    maxParentalRating: integerOrNull(policy.MaxParentalRating),
    maxParentalSubRating: integerOrNull(policy.MaxParentalSubRating),
    blockUnratedItems: unrated,
    blockedTags: strings(policy.BlockedTags),
    allowedTags: strings(policy.AllowedTags),
    enableAllFolders: policy.EnableAllFolders === true,
    enabledFolders: strings(policy.EnabledFolders).map(normalizeJellyfinId),
    blockedMediaFolders: strings(policy.BlockedMediaFolders).map(normalizeJellyfinId),
    accessSchedules: schedules(policy.AccessSchedules),
    isDisabled: policy.IsDisabled === true,
    maxActiveSessions: integerOrNull(policy.MaxActiveSessions) ?? 0,
    invalidLoginAttemptCount: integerOrNull(policy.InvalidLoginAttemptCount) ?? 0,
    loginAttemptsBeforeLockout: integerOrNull(policy.LoginAttemptsBeforeLockout) ?? -1,
  };
  return { ...result, restricted: isPolicyRestricted(result) };
}

/** La règle de « restreint » (§ 5) : une note maximale, une étiquette, un type non classé. */
export function isPolicyRestricted(policy: Pick<ContentPolicy, "readable" | "maxParentalRating" | "blockedTags" | "allowedTags" | "blockUnratedItems">): boolean {
  if (!policy.readable) return true;
  return (
    policy.maxParentalRating !== null ||
    policy.blockedTags.length > 0 ||
    policy.allowedTags.length > 0 ||
    policy.blockUnratedItems.length > 0
  );
}

async function readContentPolicy(userId: string): Promise<ContentPolicy> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) return closedContentPolicy(userId);
  const result = await jellyfinAdminFetch<{ Id?: string; Policy?: Record<string, unknown> }>(`/Users/${encodeURIComponent(userId)}`);
  if (!result.ok || !result.data?.Policy || typeof result.data.Policy !== "object") return closedContentPolicy(userId);
  return contentPolicyFromJellyfin(userId, result.data.Policy);
}

/** La politique de contenu d'un compte (Jellyfin `userId`) — jamais une exception. */
export async function getContentPolicy(userId: string): Promise<ContentPolicy> {
  const key = normalizeJellyfinId(userId);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.policy;
  const running = inflight.get(key);
  if (running) return running;
  const pending = readContentPolicy(userId).catch(() => closedContentPolicy(userId));
  inflight.set(key, pending);
  const policy = await pending;
  // Une invalidation pendant la lecture a retiré la lecture en cours : on ne garde pas une valeur périmée.
  if (inflight.get(key) === pending) {
    inflight.delete(key);
    cache.set(key, { policy, expiresAt: Date.now() + (policy.readable ? TTL_MS : CLOSED_TTL_MS) });
    if (cache.size > MAX_ENTRIES) pruneExpired();
  }
  return policy;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) if (now >= entry.expiresAt) cache.delete(key);
}

type InvalidationListener = (userId: string | null) => void;
const invalidationListeners = new Set<InvalidationListener>();

/**
 * Être prévenu qu'une politique de contenu n'est plus sûre : `userId` (normalisé,
 * sans tirets) pour un compte, `null` pour tous. Appelé de façon SYNCHRONE par
 * l'invalidation ; ce qui en dépend (caches de listes filtrées) s'y vide. La valeur
 * rendue désabonne.
 */
export function onContentPolicyInvalidated(listener: InvalidationListener): () => void {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

function notifyInvalidated(userId: string | null): void {
  for (const listener of [...invalidationListeners]) {
    try {
      listener(userId);
    } catch (error) {
      // Un écouteur fautif n'empêche pas les autres de vider leurs caches.
      console.log(`[content-policy] un écouteur d'invalidation a échoué : ${(error as Error)?.message ?? error}`);
    }
  }
}

/** À appeler après TOUTE écriture de politique faite par Tentacle. */
export function invalidateContentPolicy(userId: string): void {
  const key = normalizeJellyfinId(userId);
  cache.delete(key);
  inflight.delete(key);
  notifyInvalidated(key);
}

/** Vide le cache de TOUS les comptes (tests, changement de Jellyfin) ; les écouteurs reçoivent `null`. */
export function clearContentPolicyCache(): void {
  cache.clear();
  inflight.clear();
  notifyInvalidated(null);
}

/** Le compte est-il restreint ? Illisible : oui. */
export async function isRestricted(userId: string): Promise<boolean> {
  return (await getContentPolicy(userId)).restricted;
}

/**
 * Les bibliothèques du compte sont-elles bornées (toutes non permises, ou une
 * bloquée) ? Politique illisible : oui. Jellyfin ne les applique qu'aux listes
 * parcourues depuis la racine du compte (cf. `routes/jellyfinProxy/libraryListGuard.ts`).
 */
export function limitsLibraries(policy: Pick<ContentPolicy, "readable" | "enableAllFolders" | "blockedMediaFolders">): boolean {
  return !policy.readable || !policy.enableAllFolders || policy.blockedMediaFolders.length > 0;
}
