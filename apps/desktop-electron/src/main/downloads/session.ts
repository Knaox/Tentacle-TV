/**
 * Cache de session hors ligne — profil et droits PAR utilisateur, SANS aucun
 * secret.
 *
 * TTL de 30 jours GLISSANTS : chaque écriture, faite à chaque contact serveur
 * réussi côté web, repousse l'expiration. À échéance l'entrée est CONSERVÉE —
 * on ne détruit pas des données — mais signalée `expired`, et l'interface exige
 * alors une reconnexion en ligne.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/session.rs`. Les noms de
 * champs rendus à la page sont ceux de `#[serde(rename_all = "camelCase")]` :
 * la page ne doit voir aucune différence entre les deux coquilles.
 */

import type { DatabaseSync } from "node:sqlite";
import { integer, text, textOrNull } from "./rows";

/** 30 jours en millisecondes. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CachedSession {
  profileJson: string;
  policyJson: string | null;
  cachedAt: number;
  expiresAt: number;
  expired: boolean;
}

export function get(db: DatabaseSync, userId: string, nowMs: number): CachedSession | null {
  const row = db
    .prepare(
      `SELECT profile_json, policy_json, cached_at, expires_at
       FROM session_cache WHERE jellyfin_user_id = ?`,
    )
    .get(userId);
  if (row === undefined) return null;

  const expiresAt = integer(row, "expires_at");
  return {
    profileJson: text(row, "profile_json"),
    policyJson: textOrNull(row, "policy_json"),
    cachedAt: integer(row, "cached_at"),
    expiresAt,
    expired: nowMs > expiresAt,
  };
}

/**
 * Écriture glissante.
 *
 * `policyJson = null` CONSERVE la policy déjà en cache : le profil et les
 * droits sont rafraîchis par des chemins différents côté web, et une écriture
 * de profil ne doit pas effacer des droits connus.
 */
export function set(
  db: DatabaseSync,
  userId: string,
  profileJson: string,
  policyJson: string | null,
  nowMs: number,
): void {
  db.prepare(
    `INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(jellyfin_user_id) DO UPDATE SET
       profile_json = excluded.profile_json,
       policy_json  = COALESCE(excluded.policy_json, session_cache.policy_json),
       cached_at    = excluded.cached_at,
       expires_at   = excluded.expires_at`,
  ).run(userId, profileJson, policyJson, nowMs, nowMs + SESSION_TTL_MS);
}

export function clear(db: DatabaseSync, userId: string): void {
  db.prepare("DELETE FROM session_cache WHERE jellyfin_user_id = ?").run(userId);
}
