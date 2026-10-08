import type { DismissibleHint } from "../help/dismissibleHints";
import type { CompatStatus } from "../jellyfinCompat/compatVerdict";
import type { SetupCheckId, SetupLevel, SetupState } from "../jellyfinCompat/setupContract";
import type { LinkCheck, LinkIssue } from "../serverLinks/serverLinksVerdict";
import type { ServerUpdateStatus } from "../serverUpdate/serverUpdateStatus";
import { isJellyfinTodo, SEGMENTS_CHECK } from "./jellyfinAdvice";
import type { ServerCapability } from "../serverCapabilities/serverCapabilities";

/**
 * Ce qui demande l'attention de l'administrateur, en tête de la vue
 * d'ensemble — deux familles, dans cet ordre :
 *
 * - À RÉGLER : ce qui est cassé (Jellyfin pas relié ou injoignable, clé
 *   d'administration absente ou refusée, base en panne, version de Jellyfin
 *   incompatible, mise à jour du serveur obligatoire, extension que ce
 *   serveur refuse de charger). Jamais masquable.
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
  | "serverUpdateRequired"
  | "extensionsRefused"
  | "databaseSourceChanged"
  | "databaseNeverMigrated";

export type RecommendationId = "publicUrl" | "tmdbKey" | "jellyfin" | "segmentPlugins" | "directPlay" | "removeMariadb";

/** Le rappel qui masque chaque recommandation — des clés à elles, distinctes des fenêtres des clients. */
export const RECOMMENDATION_HINTS: Record<RecommendationId, DismissibleHint> = {
  publicUrl: "adminPublicUrl",
  tmdbKey: "adminTmdbKey",
  jellyfin: "adminJellyfin",
  segmentPlugins: "adminSegmentPlugins",
  directPlay: "adminDirectPlay",
  removeMariadb: "adminRemoveMariadb",
};

/** L'ordre de lecture : la sécurité, puis ce que voient tous les comptes, puis le confort. */
const RECOMMENDATION_ORDER: readonly RecommendationId[] = ["publicUrl", "tmdbKey", "jellyfin", "segmentPlugins", "directPlay", "removeMariadb"];

/**
 * La migration MariaDB → SQLite (serveur 1.25), vue du tableau de bord : un
 * résumé de `GET /api/admin/database/migration`. « À régler » : une ancienne base
 * qui a CHANGÉ depuis la migration (§ 3.10), ou une base installée sans jamais
 * avoir été migrée face à une MariaDB configurée. Recommandation (masquable) :
 * retirer MariaDB — seulement une fois la migration ET la copie du cache finies,
 * et tant que l'ancienne base est encore configurée.
 */
export interface DatabaseMigrationAttention {
  legacy: "none" | "pending" | "migrated" | "never_migrated";
  sourceConfigured: boolean;
  /** Le contrôle de l'ancienne base : `null` tant qu'il n'a rien trouvé (ou pas encore eu lieu). */
  sourceChanged: "identity" | "data" | "was_empty" | null;
  /** Rien n'est plus copié en fond depuis MariaDB (cache TMDB fini, ou rien à copier). */
  cacheDone: boolean;
  /** L'installation détectée, pour la marche à suivre (`official-stack`, `compose-service`, `external`, `unknown`). */
  removal: string;
}

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
  /**
   * Les extensions activées que ce serveur refuse de charger (« Vigie 1.24.1 ») :
   * sur SQLite, une extension qui ne s'y déclare pas compatible. `null` : un
   * serveur d'avant, qui n'en refuse aucune.
   */
  refusedExtensions: Source<readonly string[]>;
  /**
   * Ce que le serveur sait faire (`serverCapabilities.ts`). Sans
   * `admin.segmentPlugins` (serveur d'avant 1.24.0), les greffons de passages
   * restent un point de l'entrée « Jellyfin », comme alors : aucune entrée ne
   * renvoie vers un geste que le serveur n'a pas.
   */
  capabilities: ReadonlySet<ServerCapability>;
  /** La migration de la base ; absent ou `null` : serveur d'avant 1.25 (capacité `server.databaseMigration`). */
  databaseMigration?: Source<DatabaseMigrationAttention>;
  /** Masquée par le compte ? `undefined` : pas encore lu — la recommandation attend. */
  dismissed: Partial<Record<RecommendationId, boolean>>;
}

export interface BlockingEntry {
  id: BlockingId;
  /** La cause précise, pour le texte (« key », « revoked »…) ; `null` : une seule cause possible. */
  variant: string | null;
  /** Ce que l'entrée nomme (les extensions refusées) ; vide le plus souvent. */
  items: string[];
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
  const entries: Array<Omit<BlockingEntry, "items"> & { items?: string[] }> = [];
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
  const refused = s.refusedExtensions ?? [];
  if (refused.length > 0) entries.push({ id: "extensionsRefused", variant: null, items: [...refused] });
  const migration = s.databaseMigration;
  if (migration?.legacy === "never_migrated") entries.push({ id: "databaseNeverMigrated", variant: null });
  if (migration?.sourceChanged) entries.push({ id: "databaseSourceChanged", variant: migration.sourceChanged });
  return entries.map((entry) => ({ ...entry, items: entry.items ?? [] }));
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
  const segmentsApart = s.capabilities.has("admin.segmentPlugins");
  let essential = false;
  // Un réglage fait mais pas encore appliqué (greffon installé ou coupé) attend lui
  // aussi le redémarrage de Jellyfin, même quand Jellyfin ne le signale pas encore.
  let restart = s.jellyfinSetup?.restartPending === true;
  for (const check of s.jellyfinSetup?.checks ?? []) {
    // Les greffons de passages ont leur entrée à eux (`segmentPlugins`).
    if (check.level === "optional" || (segmentsApart && check.id === SEGMENTS_CHECK)) continue;
    restart ||= check.state === "pending-restart";
    // La même règle que l'écran « Réglages conseillés » de l'assistant (`jellyfinAdvice.ts`) ;
    // sans entrée à part (serveur d'avant 1.24.0), les greffons restent un point d'ici.
    const segmentsHere = !segmentsApart && check.id === SEGMENTS_CHECK && check.state === "todo";
    if (!isJellyfinTodo(check) && !segmentsHere) continue;
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
  const segments = usable && s.capabilities.has("admin.segmentPlugins") ? segmentPluginsItem(s) : null;
  if (segments) found.set("segmentPlugins", segments);
  const directPlay = usable ? linkEntry(s.links?.find((check) => check.id === "directPlay")) : null;
  if (directPlay) found.set("directPlay", directPlay);
  const m = s.databaseMigration;
  if (m && m.legacy === "migrated" && m.sourceConfigured && m.cacheDone && !m.sourceChanged) {
    found.set("removeMariadb", { variant: m.removal, items: [] });
  }
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
  const sources = [
    s.jellyfin, s.adminKey, s.databaseDown, s.tmdbConfigured, s.links, s.jellyfinSetup, s.jellyfinVersion, s.serverUpdate,
    s.refusedExtensions,
    // Absente d'un appelant d'avant la migration : rien à attendre.
    ...("databaseMigration" in s ? [s.databaseMigration] : []),
  ];
  return { settled: !waiting && sources.every((source) => source !== undefined), blocking, recommendations, hidden };
}
