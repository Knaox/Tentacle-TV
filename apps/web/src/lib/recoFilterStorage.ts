import { normalizeProviderFilter } from "@tentacle-tv/api-client";

/** Clé traversée par une chaîne (localStorage) : ne JAMAIS la renommer. */
export const RECO_FILTER_STORAGE_KEY = "tentacle_reco_providers";

interface RecoFilterMirror {
  /** Le compte à qui ce filtre appartient (tentacle_user.Id) — un appareil
   *  partagé ne rend pas le filtre d'un autre compte (même règle que le
   *  persister du cache et que l'accusé de démarrage à froid). */
  owner: string | null;
  ids: number[];
}

/**
 * Le miroir LOCAL du filtre de plateformes : lu de façon synchrone au
 * premier rendu (zéro requête avant d'afficher la bonne page), écrit à
 * chaque changement ; les réglages serveur corrigent ensuite.
 */
export function parseRecoFilterMirror(raw: string | null, owner: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<RecoFilterMirror> | null;
    if (!parsed || typeof parsed !== "object") return [];
    if ((parsed.owner ?? null) !== owner) return [];
    return normalizeProviderFilter(Array.isArray(parsed.ids) ? parsed.ids : []);
  } catch {
    return [];
  }
}

export function serializeRecoFilterMirror(ids: readonly number[], owner: string | null): string {
  const mirror: RecoFilterMirror = { owner, ids: normalizeProviderFilter(ids) };
  return JSON.stringify(mirror);
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readRecoFilterMirror(
  owner: string | null,
  storage: Pick<Storage, "getItem"> | null = defaultStorage()
): number[] {
  if (!storage) return [];
  try {
    return parseRecoFilterMirror(storage.getItem(RECO_FILTER_STORAGE_KEY), owner);
  } catch {
    return [];
  }
}

export function writeRecoFilterMirror(
  ids: readonly number[],
  owner: string | null,
  storage: Pick<Storage, "setItem"> | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(RECO_FILTER_STORAGE_KEY, serializeRecoFilterMirror(ids, owner));
  } catch {
    // Stockage refusé (navigation privée…) : le serveur garde le choix.
  }
}
