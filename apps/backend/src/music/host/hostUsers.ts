/**
 * Octave — les comptes Jellyfin, pour l'API d'hôte (`usageOf`) : identifiants
 * et rôle d'administrateur, relus au plus toutes les minutes.
 */

import { jfAdmin, normalizeId } from "../jellyfin/musicJellyfin";

interface JfUser {
  Id?: string;
  Policy?: { IsAdministrator?: boolean };
}

const TTL_MS = 60_000;
let cached: { at: number; users: { id: string; admin: boolean }[] } | null = null;

async function users(): Promise<{ id: string; admin: boolean }[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.users;
  const result = await jfAdmin<JfUser[]>("/Users");
  if (!result.ok || !Array.isArray(result.data)) return cached?.users ?? [];
  const list = result.data.filter((u) => u.Id).map((u) => ({ id: normalizeId(u.Id!), admin: u.Policy?.IsAdministrator === true }));
  cached = { at: Date.now(), users: list };
  return list;
}

export async function listUserIds(): Promise<string[]> {
  return (await users()).map((u) => u.id);
}

export async function isAdminUser(userId: string): Promise<boolean> {
  return (await users()).some((u) => u.id === normalizeId(userId) && u.admin);
}
