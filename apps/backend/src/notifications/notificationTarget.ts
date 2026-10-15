/**
 * La CIBLE d'une notification et son ÉTAT — le contrat que l'émetteur pose
 * (le cœur pour ses notifications, une extension pour les siennes) et que
 * chaque client lit. Le cœur n'y met aucune logique propre à une extension :
 * il range, sert et valide ; l'émetteur décide où mène sa notification.
 *
 * Source canonique : ce fichier (shared). Recopié octet pour octet dans
 * `apps/backend/src/notifications/` (verrou : `notificationTargetMirror.test.ts`) :
 *
 *   cp packages/shared/src/notifications/notificationTarget.ts apps/backend/src/notifications/
 *
 * Les deux champs sont ADDITIFS (colonnes `target` et `state` de
 * `notifications`, nulles par défaut) : une notification d'avant, sans cible,
 * garde son comportement d'avant (la route tirée de son type). Les clés et les
 * valeurs traversent le réseau et la base : elles ne se renomment jamais.
 *
 * Forme stockée : `target` = le JSON de l'objet ci-dessous ; `state` = une
 * valeur de `NOTIFICATION_STATES`. Une extension écrit ces deux colonnes par le
 * client Prisma du cœur, SEULEMENT si le contexte d'extension les annonce
 * (`ctx.notificationFields` contient « target », « state ») : un cœur d'avant
 * refuserait le champ inconnu.
 */

/** La fiche d'un titre de la bibliothèque (identifiant Jellyfin). */
export interface NotificationItemTarget {
  kind: "item";
  itemId: string;
}

/**
 * Une page d'extension, avec ses paramètres (transmis à la page tels quels,
 * en query string). `path` est un chemin de navigation que l'extension publie
 * (`navItems`) ; les paramètres sont l'affaire de l'extension seule.
 */
export interface NotificationExtensionTarget {
  kind: "extension";
  pluginId: string;
  path: string;
  params?: Record<string, string>;
}

/**
 * Un titre désigné par son identifiant TMDB : le client le cherche dans la
 * bibliothèque AU CLIC (`/api/tmdb/resolve`) — l'émetteur ne connaît pas
 * toujours l'identifiant Jellyfin, ni même si le titre y est déjà. Absent de
 * la bibliothèque : `fallback` s'il y en a un, sinon le comportement d'avant.
 */
export interface NotificationTitleTarget {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  fallback?: NotificationItemTarget | NotificationExtensionTarget;
}

export type NotificationTarget = NotificationItemTarget | NotificationExtensionTarget | NotificationTitleTarget;

/**
 * L'état de ce dont parle la notification, lisible d'un coup d'œil (une
 * pastille : icône + mot + couleur). Générique : une demande, un envoi, une
 * tâche. Liste FERMÉE ; une valeur inconnue se lit comme une absence.
 */
export const NOTIFICATION_STATES = ["available", "progress", "pending", "blocked", "declined", "failed"] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

/** Les colonnes additives qu'un serveur à jour annonce aux extensions. */
export const NOTIFICATION_EXTRA_FIELDS = ["target", "state"] as const;

const PLUGIN_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MAX_PARAMS = 12;
const MAX_PARAM_LENGTH = 200;
/** Garde de taille de la colonne : au-delà, la cible est refusée, pas tronquée. */
export const MAX_TARGET_JSON_LENGTH = 2_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseParams(raw: unknown): Record<string, string> | undefined | null {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > MAX_PARAMS) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(key)) return null;
    const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
    if (typeof text !== "string" || text.length > MAX_PARAM_LENGTH) return null;
    out[key] = text;
  }
  return out;
}

function parseItem(o: Record<string, unknown>): NotificationItemTarget | null {
  return typeof o.itemId === "string" && /^[A-Za-z0-9-]{1,64}$/.test(o.itemId) ? { kind: "item", itemId: o.itemId } : null;
}

function parseExtension(o: Record<string, unknown>): NotificationExtensionTarget | null {
  if (typeof o.pluginId !== "string" || !PLUGIN_ID.test(o.pluginId)) return null;
  if (typeof o.path !== "string" || !o.path.startsWith("/") || o.path.length > 200 || /[?#\s]/.test(o.path)) return null;
  const params = parseParams(o.params);
  if (params === null) return null;
  return params ? { kind: "extension", pluginId: o.pluginId, path: o.path, params } : { kind: "extension", pluginId: o.pluginId, path: o.path };
}

function parseLeaf(o: Record<string, unknown>): NotificationItemTarget | NotificationExtensionTarget | null {
  if (o.kind === "item") return parseItem(o);
  if (o.kind === "extension") return parseExtension(o);
  return null;
}

/**
 * Lit une cible — objet ou JSON stocké. Tout ce qui n'est pas exactement du
 * contrat rend `null` (la notification garde alors son comportement d'avant).
 */
export function parseNotificationTarget(raw: unknown): NotificationTarget | null {
  let value = raw;
  if (typeof value === "string") {
    if (value.length === 0 || value.length > MAX_TARGET_JSON_LENGTH) return null;
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!isRecord(value)) return null;
  if (value.kind !== "title") return parseLeaf(value);
  const tmdbId = value.tmdbId;
  if (value.mediaType !== "movie" && value.mediaType !== "tv") return null;
  if (typeof tmdbId !== "number" || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  const target: NotificationTitleTarget = { kind: "title", mediaType: value.mediaType, tmdbId };
  if (value.fallback === undefined) return target;
  const fallback = isRecord(value.fallback) ? parseLeaf(value.fallback) : null;
  return fallback ? { ...target, fallback } : null;
}

/** La forme stockée d'une cible ; `null` si elle n'est pas du contrat. */
export function serializeNotificationTarget(target: NotificationTarget): string | null {
  const valid = parseNotificationTarget(target);
  if (!valid) return null;
  const json = JSON.stringify(valid);
  return json.length <= MAX_TARGET_JSON_LENGTH ? json : null;
}

export function parseNotificationState(raw: unknown): NotificationState | null {
  return typeof raw === "string" && (NOTIFICATION_STATES as readonly string[]).includes(raw) ? (raw as NotificationState) : null;
}
