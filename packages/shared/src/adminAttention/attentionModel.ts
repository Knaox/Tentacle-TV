import type { DismissibleHint } from "../help/dismissibleHints";
import type { CompatStatus } from "../jellyfinCompat/compatVerdict";
import type { SetupCheckId, SetupLevel, SetupState } from "../jellyfinCompat/setupContract";
import type { LinkCheck, LinkIssue } from "../serverLinks/serverLinksVerdict";
import type { ServerUpdateStatus } from "../serverUpdate/serverUpdateStatus";
import { isJellyfinTodo, SEGMENTS_CHECK } from "./jellyfinAdvice";

/**
 * Ce qui demande l'attention de l'administrateur, en tête de la vue
 * d'ensemble — deux familles, dans cet ordre :
 *
 * - À RÉGLER : ce qui est cassé (Jellyfin pas relié ou injoignable, clé
 *   d'administration absente ou refusée, base en panne, version de Jellyfin
 *   incompatible, mise à jour du serveur obligatoire). Jamais masquable.
 * - RECOMMANDATIONS : ce qui rendrait Tentacle meilleur (lien public et
 *   HTTPS, clé TMDB, réglages conseillés de Jellyfin, détection des
 *   passages, lecture directe).
 *   Chacune se masque par compte (`RECOMMENDATION_HINTS`, rappels de
 *   `/api/preferences/hints`) et se retrouve sous « N masquées ».
 *
 * Tant que Jellyfin n'est pas utilisable, ce qui en dépend se tait : une
 * seule entrée dit le problème, au lieu d'une pile d'avertissements qui
 * répètent la même cause. Logique pure : les lectures entrent déjà
 * résumées — `undefined` tant qu'une source n'a pas répondu, `null` quand
 * elle a échoué ou que le serveur ne la connaît pas.
 */

export type BlockingId =
  | "jellyfinNotConfigured"
  | "jellyfinUnreachable"
  | "jellyfinKeyRejected"
  | "databaseDown"
  | "jellyfinIncompatible"
  | "serverUpdateRequired";

export type RecommendationId = "publicUrl" | "tmdbKey" | "jellyfin" | "segmentPlugins" | "directPlay";

/** Le rappel qui masque chaque recommandation — des clés à elles, distinctes des fenêtres des clients. */
export const RECOMMENDATION_HINTS: Record<RecommendationId, DismissibleHint> = {
  publicUrl: "adminPublicUrl",
  tmdbKey: "adminTmdbKey",
  jellyfin: "adminJellyfin",
  segmentPlugins: "adminSegmentPlugins",
  directPlay: "adminDirectPlay",
};

/** L'ordre de lecture : la sécurité, puis ce que voient tous les comptes, puis le confort. */
const RECOMMENDATION_ORDER: readonly RecommendationId[] = ["publicUrl", "tmdbKey", "jellyfin", "segmentPlugins", "directPlay"];

export type JellyfinLink =
  | { state: "connected" }
  | { state: "not-configured"; missing: ReadonlyArray<"url" | "key"> }
  /** `health` : ce que la surveillance en direct en sait (`server:jellyfin`) — il redémarre, s'arrête, démarre. */
  | { state: "unreachable"; health?: "restarting" | "shutting-down" | "starting" | "down" }
  | { state: "rejected"; reason: "revoked" | "no-rights" };

export type AdminKeyCheck = "ok" | "revoked" | "no-rights" | "missing" | "unreachable";

type Source<T> = T | null | undefined;

export interface AttentionSources {
  jellyfin: Source<JellyfinLink>;
  /** La santé de la clé d'administration, vérifiée à part (droits compris). */
  adminKey: Source<AdminKeyCheck>;
  databaseDown: Source<boolean>;
  tmdbConfigured: Source<boolean>;
  links: Source<readonly LinkCheck[]>;
  jellyfinSetup: Source<{
    restartPending: boolean;
    checks: ReadonlyArray<{ id: SetupCheckId; level: SetupLevel; state: SetupState }>;
  }>;
  /** Le verdict de la version de Jellyfin installée. */
  jellyfinVersion: Source<CompatStatus>;
  serverUpdate: Source<ServerUpdateStatus>;
  /** Masquée par le compte ? `undefined` : pas encore lu — la recommandation attend. */
  dismissed: Partial<Record<RecommendationId, boolean>>;
}

export interface BlockingEntry {
  id: BlockingId;
  /** La cause précise, pour le texte (« key », « revoked »…) ; `null` : une seule cause possible. */
  variant: string | null;
}

export interface RecommendationEntry {
  id: RecommendationId;
  hint: DismissibleHint;
  variant: string | null;
  /** Le détail : les soucis d'une adresse, les points d'une entrée groupée (« setup:trickplay », « restart »…). */
  items: string[];
}

export interface AdminAttention {
  /** Toutes les sources ont répondu (ou échoué) : l'état en une ligne peut se dire. */
  settled: boolean;
  blocking: BlockingEntry[];
  recommendations: RecommendationEntry[];
  /** Les recommandations masquées par le compte, à « Afficher ». */
  hidden: RecommendationEntry[];
}

/** Jellyfin répond, avec une clé qui a ses droits : ce qui en dépend peut parler. */
function jellyfinUsable(s: AttentionSources): boolean {
  return s.jellyfin?.state === "connected" && s.adminKey !== "revoked" && s.adminKey !== "no-rights";
}

function blockingEntries(s: AttentionSources): BlockingEntry[] {
  const entries: BlockingEntry[] = [];
  const jellyfin = s.jellyfin;
  if (jellyfin?.state === "not-configured") {
    const missing = new Set(jellyfin.missing);
    entries.push({ id: "jellyfinNotConfigured", variant: missing.has("url") ? (missing.has("key") ? "both" : "url") : "key" });
  } else if (jellyfin?.state === "unreachable") {
    // Un redémarrage n'est pas une panne à régler : l'entrée le dit (variante),
    // « arrêté » garde la phrase générique.
    const health = jellyfin.health;
    const variant = health === "restarting" || health === "starting" ? health : health === "shutting-down" ? "shuttingDown" : null;
    entries.push({ id: "jellyfinUnreachable", variant });
  } else if (jellyfin?.state === "rejected") {
    entries.push({ id: "jellyfinKeyRejected", variant: jellyfin.reason });
  } else if (s.adminKey === "revoked" || s.adminKey === "no-rights") {
    entries.push({ id: "jellyfinKeyRejected", variant: s.adminKey });
  }
  if (s.databaseDown === true) entries.push({ id: "databaseDown", variant: null });
  if (jellyfinUsable(s) && s.jellyfinVersion === "incompatible") entries.push({ id: "jellyfinIncompatible", variant: null });
  if (s.serverUpdate === "mandatory") entries.push({ id: "serverUpdateRequired", variant: null });
  return entries;
}

/** Le souci qui donne son titre à une adresse — le plus grave d'abord. */
const ISSUE_PRIORITY: readonly LinkIssue[] = [
  "internal-host", "not-public", "mixed-content", "not-https", "cors-missing", "other-server", "unexpected", "http-error", "unverified",
];

function linkEntry(check: LinkCheck | undefined): { variant: string; items: string[] } | null {
  if (!check || (check.state !== "todo" && check.state !== "attention")) return null;
  const issues = check.endpoints.flatMap((endpoint) => endpoint.issues.map((issue) => `${endpoint.role}:${issue}`));
  if (check.state === "todo") return { variant: check.id === "directPlay" ? "off" : "missing", items: issues };
  const main = ISSUE_PRIORITY.find((issue) => check.endpoints.some((endpoint) => endpoint.issues.includes(issue)));
  return { variant: main ?? "unverified", items: issues };
}

function jellyfinItems(s: AttentionSources): { variant: string | null; items: string[] } | null {
  const items: string[] = [];
  let essential = false;
  // Un réglage fait mais pas encore appliqué (greffon installé ou coupé) attend lui
  // aussi le redémarrage de Jellyfin, même quand Jellyfin ne le signale pas encore.
  let restart = s.jellyfinSetup?.restartPending === true;
  for (const check of s.jellyfinSetup?.checks ?? []) {
    // Les greffons de passages ont leur entrée à eux (`segmentPlugins`).
    if (check.level === "optional" || check.id === SEGMENTS_CHECK) continue;
    restart ||= check.state === "pending-restart";
    // La même règle que l'écran « Réglages conseillés » de l'assistant (`jellyfinAdvice.ts`).
    if (!isJellyfinTodo(check)) continue;
    items.push(`setup:${check.id}`);
    essential ||= check.level === "essential";
  }
  if (restart) items.push("restart");
  if (s.jellyfinVersion === "partial") items.push("partial");
  return items.length > 0 ? { variant: essential ? "essential" : null, items } : null;
}

/**
 * Les greffons de passages (Intro Skipper, TheIntroDB, SkipMe.db) : il en
 * manque un — à installer d'un geste —, ou ils attendent le redémarrage.
 */
function segmentPluginsItem(s: AttentionSources): { variant: string | null; items: string[] } | null {
  const state = s.jellyfinSetup?.checks.find((check) => check.id === SEGMENTS_CHECK)?.state;
  if (state === "todo") return { variant: null, items: [] };
  return state === "pending-restart" ? { variant: "restart", items: [] } : null;
}

function candidates(s: AttentionSources): Map<RecommendationId, { variant: string | null; items: string[] }> {
  const found = new Map<RecommendationId, { variant: string | null; items: string[] }>();
  const usable = jellyfinUsable(s);
  const publicUrl = linkEntry(s.links?.find((check) => check.id === "publicUrl"));
  if (publicUrl) found.set("publicUrl", publicUrl);
  if (s.tmdbConfigured === false) found.set("tmdbKey", { variant: null, items: [] });
  const jellyfin = usable ? jellyfinItems(s) : null;
  if (jellyfin) found.set("jellyfin", jellyfin);
  const segments = usable ? segmentPluginsItem(s) : null;
  if (segments) found.set("segmentPlugins", segments);
  const directPlay = usable ? linkEntry(s.links?.find((check) => check.id === "directPlay")) : null;
  if (directPlay) found.set("directPlay", directPlay);
  return found;
}

export function buildAdminAttention(s: AttentionSources): AdminAttention {
  const blocking = blockingEntries(s);
  const found = candidates(s);
  const recommendations: RecommendationEntry[] = [];
  const hidden: RecommendationEntry[] = [];
  let waiting = false;
  for (const id of RECOMMENDATION_ORDER) {
    const entry = found.get(id);
    if (!entry) continue;
    const dismissed = s.dismissed[id];
    if (dismissed === undefined) {
      waiting = true;
      continue;
    }
    (dismissed ? hidden : recommendations).push({ id, hint: RECOMMENDATION_HINTS[id], ...entry });
  }
  const sources = [s.jellyfin, s.adminKey, s.databaseDown, s.tmdbConfigured, s.links, s.jellyfinSetup, s.jellyfinVersion, s.serverUpdate];
  return { settled: !waiting && sources.every((source) => source !== undefined), blocking, recommendations, hidden };
}
