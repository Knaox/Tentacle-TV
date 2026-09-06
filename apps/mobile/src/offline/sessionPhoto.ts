/**
 * La photo de session hors ligne : profil et droits PAR compte, sans aucun
 * secret, dans la base locale (TTL de 30 jours glissants, géré par le cœur).
 * Chaque passage en ligne la repousse ; hors ligne, elle dit si le compte
 * peut encore être tenu pour valide, et quels droits de mise de côté il a.
 */

import type { StorageAdapter } from "@tentacle-tv/api-client";
import {
  NO_CAPABILITIES,
  parseCapabilities,
  session,
  type CachedSession,
  type DownloadCapabilities,
} from "@tentacle-tv/offline-core";
import { localDb } from "./database";

/** Écrit (ou repousse) la photo ; `policyJson = null` conserve les droits connus. */
export function photographSession(userId: string, storage: StorageAdapter, policyJson: string | null): void {
  const profile = storage.getItem("tentacle_user");
  if (!profile) return;
  try {
    session.set(localDb(), userId, profile, policyJson, Date.now());
  } catch {
    // Cache best-effort : un échec d'écriture ne doit jamais casser l'application.
  }
}

export function cachedSession(userId: string): CachedSession | null {
  try {
    return session.get(localDb(), userId, Date.now());
  } catch {
    return null;
  }
}

/** Les droits photographiés, ou aucun si la photo manque ou a expiré. */
export function cachedCapabilities(userId: string): DownloadCapabilities {
  const entry = cachedSession(userId);
  if (entry === null || entry.expired || entry.policyJson === null) return NO_CAPABILITIES;
  try {
    return parseCapabilities(JSON.parse(entry.policyJson));
  } catch {
    return NO_CAPABILITIES;
  }
}

/**
 * Lecture LIVE des droits (`GET /api/downloads/capabilities`, Bearer) — le
 * backend relit la policy Jellyfin — puis photo pour le hors ligne.
 */
export async function fetchCapabilities(
  serverUrl: string,
  token: string,
  userId: string,
  storage: StorageAdapter,
): Promise<DownloadCapabilities> {
  const res = await fetch(`${serverUrl}/api/downloads/capabilities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return NO_CAPABILITIES;
  const caps = parseCapabilities(await res.json());
  photographSession(userId, storage, JSON.stringify(caps));
  return caps;
}
