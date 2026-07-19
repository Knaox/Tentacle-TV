/**
 * Accès JS au cache de session hors ligne (SQLite côté Rust, desktop only).
 * Profil + droits par utilisateur, AUCUN token. TTL 30 jours glissants géré
 * côté Rust — ici, de simples wrappers typés et silencieux hors Tauri.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../hooks/mpvRuntime";

export interface CachedSession {
  profileJson: string;
  policyJson: string | null;
  cachedAt: number;
  expiresAt: number;
  expired: boolean;
}

export async function getCachedSession(userId: string): Promise<CachedSession | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<CachedSession | null>("session_cache_get", { userId });
  } catch {
    return null;
  }
}

export async function saveCachedSession(
  userId: string,
  profileJson: string,
  policyJson?: string | null,
): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("session_cache_set", {
      userId,
      profileJson,
      policyJson: policyJson ?? null,
    });
  } catch {
    /* Cache best-effort : un échec d'écriture ne doit jamais casser l'app. */
  }
}

export async function clearCachedSession(userId: string): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("session_cache_clear", { userId });
  } catch {
    /* idem */
  }
}
