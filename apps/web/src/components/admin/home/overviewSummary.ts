/**
 * Ce que la vue d'ensemble tire des réponses de l'API admin — des résumés
 * chiffrés, calculés côté client sur les routes existantes.
 *
 * Chaque lecteur accepte `unknown` et rend `null` quand la forme n'est pas
 * celle attendue : ces routes appartiennent à leurs pages (Utilisateurs,
 * Invitations, Plugins, Services), qui les font évoluer. Un champ ajouté ne
 * gêne rien ; une forme changée affiche un tiret sur UNE tuile au lieu de
 * faire tomber l'accueil.
 */

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null;
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export type HealthState = "connected" | "error" | "not_configured" | "unknown";

export interface ServicesHealth {
  jellyfin: { state: HealthState; version: string | null };
  database: { state: HealthState; version: string | null };
}

/**
 * Le statut d'un service tel que le serveur le nomme. « disconnected » veut
 * dire « rien de configuré » (pas d'URL, pas de clé) : c'est un réglage à
 * faire, pas une panne.
 */
function healthState(raw: unknown): HealthState {
  switch (raw) {
    case "connected":
      return "connected";
    case "error":
      return "error";
    case "disconnected":
    case "not_configured":
      return "not_configured";
    default:
      return "unknown";
  }
}

/** « 11.4.4-MariaDB-ubu2404 » → « 11.4.4 » ; une version Jellyfin passe telle quelle. */
function shortVersion(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return raw.trim().split("-")[0];
}

export function readServicesHealth(raw: unknown): ServicesHealth | null {
  if (!isRecord(raw) || !isRecord(raw.jellyfin) || !isRecord(raw.database)) return null;
  return {
    jellyfin: { state: healthState(raw.jellyfin.status), version: shortVersion(raw.jellyfin.version) },
    database: { state: healthState(raw.database.status), version: shortVersion(raw.database.version) },
  };
}

export interface AccountsSummary {
  total: number;
  admins: number;
  disabled: number;
}

export function summarizeAccounts(raw: unknown): AccountsSummary | null {
  if (!Array.isArray(raw)) return null;
  const users = raw.filter(isRecord);
  return {
    total: users.length,
    admins: users.filter((user) => user.isAdministrator === true).length,
    disabled: users.filter((user) => user.isDisabled === true).length,
  };
}

export interface InvitesSummary {
  /** Invitations encore utilisables : ni épuisées, ni échues. */
  active: number;
  /** Comptes qui peuvent encore s'ouvrir par elles. */
  seatsLeft: number;
}

/**
 * Une invitation vaut tant qu'il lui reste une utilisation et que son échéance
 * n'est pas passée — le serveur l'accepte encore à l'échéance exacte.
 */
export function summarizeInvites(raw: unknown, now: number): InvitesSummary | null {
  if (!Array.isArray(raw)) return null;
  let active = 0;
  let seatsLeft = 0;
  for (const invite of raw) {
    if (!isRecord(invite)) continue;
    const left = count(invite.maxUses) - count(invite.currentUses);
    const expiresAt = typeof invite.expiresAt === "string" ? Date.parse(invite.expiresAt) : Number.NaN;
    const expired = Number.isFinite(expiresAt) && expiresAt < now;
    if (left > 0 && !expired) {
      active += 1;
      seatsLeft += left;
    }
  }
  return { active, seatsLeft };
}

export interface PluginsSummary {
  installed: number;
  /** `null` : le catalogue n'a pas répondu — on ne sait pas. */
  updates: number | null;
  /** Plugins dont l'activation ou la mise à jour attend un redémarrage du serveur. */
  restartRequired: number;
}

/**
 * Les mises à jour se lisent dans le catalogue (`installed && updateAvailable`),
 * pas dans la liste des installés, qui ne les connaît pas.
 */
export function summarizePlugins(installedRaw: unknown, marketplaceRaw: unknown): PluginsSummary | null {
  if (!Array.isArray(installedRaw)) return null;
  const installed = installedRaw.filter(isRecord);
  return {
    installed: installed.length,
    updates: Array.isArray(marketplaceRaw)
      ? marketplaceRaw.filter((entry) => isRecord(entry) && entry.installed === true && entry.updateAvailable === true).length
      : null,
    restartRequired: installed.filter((plugin) => plugin.restartRequired === true).length,
  };
}

export interface SessionsSummary {
  playing: number;
  paused: number;
  groups: number;
}

export function summarizeSessions(raw: unknown): SessionsSummary | null {
  if (!isRecord(raw) || !Array.isArray(raw.sessions)) return null;
  const playing = raw.sessions.filter((session) => isRecord(session) && session.nowPlaying != null) as Loose[];
  return {
    playing: playing.length,
    paused: playing.filter((session) => session.isPaused === true).length,
    groups: Array.isArray(raw.groups) ? raw.groups.length : 0,
  };
}

export interface DownloadsSummary {
  allowed: number;
  total: number;
}

export function summarizeDownloads(raw: unknown): DownloadsSummary | null {
  if (!Array.isArray(raw)) return null;
  const users = raw.filter(isRecord);
  return { allowed: users.filter((user) => user.enableContentDownloading === true).length, total: users.length };
}

/** Le total d'une page de tickets (`{ total }`) — la liste elle-même ne sert pas. */
export function ticketTotal(raw: unknown): number | null {
  return isRecord(raw) && typeof raw.total === "number" ? raw.total : null;
}
