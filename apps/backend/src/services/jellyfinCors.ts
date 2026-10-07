import { jellyfinAuthHeaders } from "./jellyfinAuth";

/**
 * Les `CorsHosts` de Jellyfin : les origines dont il accepte les appels venus
 * d'un navigateur (la lecture directe du web et du bureau). Règle de Jellyfin
 * (`CorsPolicyProvider`, 10.8 → 12) : une liste VIDE ou qui contient `*`
 * autorise toutes les origines ; sinon, seules celles de la liste. Tentacle
 * n'ajoute donc ses origines qu'à une liste explicite — les poser dans une
 * liste ouverte la fermerait à tous les autres.
 */

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

/**
 * Les origines des coquilles de bureau (`tentacle://app` : Electron, schéma
 * déclaré par `apps/desktop-electron/src/main/appProtocol.ts` ; les trois
 * autres : l'ancienne coquille Tauri). Émises par l'application native
 * seulement, jamais par un navigateur tiers.
 */
export const DESKTOP_APP_ORIGINS = ["tentacle://app", "tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"] as const;

/** Plafond de la liste : une protection contre une liste qui grossirait sans fin, pas une limite de Jellyfin. */
const MAX_CORS_HOSTS = 32;

/** L'origine d'une adresse (`https://tv.example.com/jellyfin` → `https://tv.example.com`), ou `null`. */
export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  if ((DESKTOP_APP_ORIGINS as readonly string[]).includes(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Les origines à autoriser : celle de la page qui enregistre ET celle du lien
 * public. Jellyfin (mesuré en 10.11) ne répond au CORS que pour les origines
 * listées, `*` compris dans la liste. Enregistré depuis la maison, le lien
 * public manquait, et la lecture directe échouait dans tout navigateur venu
 * d'Internet. Une origine, pas une adresse : ni chemin, ni barre finale.
 */
export function corsOriginsToInject(requestOrigin: string | undefined, publicUrl: string | null): string[] {
  const origins = [requestOrigin, publicUrl].map(originOf);
  return [...new Set(origins.filter((origin): origin is string => origin !== null))];
}

/** La liste autorise déjà tout le monde (vide, ou `*`). */
export function corsAllowsAll(hosts: readonly string[]): boolean {
  return hosts.length === 0 || hosts.some((host) => host.trim() === "*");
}

const normalize = (u: string) => u.trim().replace(/\/$/, "").toLowerCase();

export interface CorsInjection {
  added: string[];
  alreadyPresent: string[];
  /** Jellyfin autorise déjà toutes les origines : rien n'a été écrit. */
  open: boolean;
}

/**
 * Ajoute aux `CorsHosts` de Jellyfin les origines de Tentacle qui y manquent.
 * Une liste ouverte (vide ou `*`) n'est jamais touchée. Rien n'est retiré :
 * ce que l'administrateur y a mis reste.
 */
export async function injectCorsHosts(
  jellyfinUrl: string,
  apiKey: string,
  tentacleUrls: string[],
  logger?: Logger,
): Promise<CorsInjection> {
  const headers = { ...jellyfinAuthHeaders(apiKey), "Content-Type": "application/json" };

  const res = await fetch(`${jellyfinUrl}/System/Configuration`, { headers, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Jellyfin GET config responded ${res.status}`);
  const config = await res.json();

  const existing: string[] = Array.isArray(config.CorsHosts) ? config.CorsHosts.filter((h: unknown): h is string => typeof h === "string") : [];
  if (corsAllowsAll(existing)) return { added: [], alreadyPresent: [], open: true };
  const existingNorm = new Set(existing.map(normalize));

  const added: string[] = [];
  const alreadyPresent: string[] = [];
  for (const raw of tentacleUrls) {
    const origin = originOf(raw.trim());
    if (!origin) continue;
    if (existingNorm.has(normalize(origin))) alreadyPresent.push(origin);
    else if (!added.includes(origin)) added.push(origin);
  }

  const toAdd = added.slice(0, Math.max(0, MAX_CORS_HOSTS - existing.length));
  if (toAdd.length === 0) return { added: [], alreadyPresent, open: false };

  config.CorsHosts = [...existing, ...toAdd];
  const postRes = await fetch(`${jellyfinUrl}/System/Configuration`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(5000),
  });
  if (!postRes.ok) throw new Error(`Jellyfin POST config responded ${postRes.status}`);

  logger?.info({ added: toAdd }, "CORS hosts injected into Jellyfin");
  return { added: toAdd, alreadyPresent, open: false };
}
