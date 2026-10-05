import type { AdminKeyCheck, JellyfinLink } from "@tentacle-tv/shared";
import type { AdminKeyState } from "../../../lib/adminKeyHealth";

/**
 * Les réponses de l'administration, résumées pour le modèle « À régler /
 * Recommandations » (`buildAdminAttention`, shared). Chaque lecteur accepte
 * `unknown` et rend `null` quand la forme n'est pas celle attendue : le
 * bureau parle à des serveurs de toutes versions. Module pur.
 */

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

export interface ServicesAttention {
  jellyfin: JellyfinLink | null;
  /** L'adresse essayée, pour le détail de « Jellyfin ne répond pas ». */
  jellyfinUrl: string | null;
  databaseDown: boolean;
}

/**
 * `GET /api/admin/services`. « disconnected » veut dire « il manque l'adresse
 * ou la clé » : avec une adresse, c'est la clé ; sans, l'adresse — et la clé
 * aussi quand le serveur le dit (`apiKeyConfigured`, absent avant la clé
 * facultative). Un 403 sur `/System/Info` : une clé sans droits ; tout autre
 * refus : une clé que Jellyfin ne reconnaît plus.
 */
export function readServicesAttention(raw: unknown): ServicesAttention | null {
  if (!isRecord(raw) || !isRecord(raw.jellyfin) || !isRecord(raw.database)) return null;
  const jf = raw.jellyfin;
  const url = typeof jf.url === "string" && jf.url.trim() !== "" ? jf.url.trim() : null;
  let jellyfin: JellyfinLink | null;
  switch (jf.status) {
    case "connected":
      jellyfin = { state: "connected" };
      break;
    case "disconnected": {
      const missing: Array<"url" | "key"> = [];
      if (!url) missing.push("url");
      if (url || jf.apiKeyConfigured === false) missing.push("key");
      jellyfin = { state: "not-configured", missing };
      break;
    }
    case "error":
      jellyfin = jf.error === "jellyfin-rejected"
        ? { state: "rejected", reason: jf.httpStatus === 403 ? "no-rights" : "revoked" }
        : { state: "unreachable", ...healthOf(jf.health) };
      break;
    default:
      jellyfin = null;
  }
  return { jellyfin, jellyfinUrl: url, databaseDown: raw.database.status === "error" };
}

const HEALTH_STATES = new Set(["restarting", "shutting-down", "starting", "down"]);

/** L'état en direct de Jellyfin (`health` de `/api/admin/services`, serveur ≥ 1.24) — absent sinon. */
function healthOf(raw: unknown): { health?: "restarting" | "shutting-down" | "starting" | "down" } {
  const state = isRecord(raw) ? raw.state : undefined;
  return typeof state === "string" && HEALTH_STATES.has(state) ? { health: state as "restarting" | "shutting-down" | "starting" | "down" } : {};
}

const KEY_CHECK: Record<AdminKeyState, AdminKeyCheck> = {
  ok: "ok",
  revoquee: "revoked",
  sansDroits: "no-rights",
  absente: "missing",
  injoignable: "unreachable",
};

/** L'état de la clé, tel que `/api/admin/jellyfin-key` le dit (en français : c'est le contrat). */
export function readAdminKeyCheck(state: AdminKeyState | null | undefined): AdminKeyCheck | null {
  return state ? KEY_CHECK[state] : null;
}
