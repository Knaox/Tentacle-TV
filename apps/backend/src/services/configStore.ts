import { getPrisma, hasPrisma } from "./db";
import {
  DOWNLOAD_BANDWIDTH_KEYS,
  INTERNAL_IPS_KEY,
  parseCap,
  parseInternalIps,
  type BandwidthCaps,
} from "./downloadBandwidth/caps";

export type AppState =
  // La base ne s'ouvre pas, ou une MariaDB attend sa migration vers SQLite.
  // Rien à saisir : plus d'étape « base de données » depuis SQLite.
  | "database_unavailable"
  | "setup_jellyfin" // DB OK but Jellyfin not configured
  | "setup_admin"    // Jellyfin OK but no admin user
  | "running";       // Fully configured

let appState: AppState = "database_unavailable";
const cache = new Map<string, string>();

/** Detect the current app state by reading DB config. */
export async function detectAppState(): Promise<AppState> {
  if (!hasPrisma()) {
    appState = "database_unavailable";
    return appState;
  }

  try {
    const prisma = getPrisma();
    const configs = await prisma.serverConfig.findMany();
    cache.clear();
    for (const c of configs) cache.set(c.key, c.value);

    if (cache.get("setup_completed") === "true") {
      appState = "running";
      return appState;
    }

    if (!cache.has("jellyfin_url")) {
      appState = "setup_jellyfin";
      return appState;
    }

    appState = "setup_admin";
    return appState;
  } catch {
    // La base répond mal (disque, fichier abîmé) : rien n'est servi.
    appState = "database_unavailable";
    return appState;
  }
}

export function getAppState(): AppState {
  return appState;
}

export function setAppState(state: AppState): void {
  appState = state;
}

export function getConfigValue(key: string): string | undefined {
  return cache.get(key);
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.serverConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache.set(key, value);
}

export async function deleteConfigValue(key: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.serverConfig.deleteMany({ where: { key } });
  cache.delete(key);
}

/** Shortcuts for common config values. */
export function getJellyfinUrl(): string | undefined {
  return cache.get("jellyfin_url");
}

export function getJellyfinApiKey(): string | undefined {
  return cache.get("jellyfin_api_key");
}

export function isSetupComplete(): boolean {
  return cache.get("setup_completed") === "true";
}

/**
 * L'analyse audio des passages (voisins de saison, `services/audioAnalysis.ts`,
 * et l'écoute de la fin de média, `tailAnalysis/`) : COUPÉE tant que
 * l'administrateur ne l'a pas rallumée — la clé absente vaut « non » (décision
 * du 2026-10-06 : les greffons et les bases en ligne suffisent, l'écoute fait
 * transcoder Jellyfin). Les serveurs d'avant sont coupés une fois au démarrage
 * (`audioAnalysisDefault.ts`).
 */
export const AUDIO_ANALYSIS_KEY = "audio_analysis_enabled";

export function isAudioAnalysisEnabled(): boolean {
  return cache.get(AUDIO_ANALYSIS_KEY) === "true";
}

export interface DirectStreamingConfig {
  enabled: boolean;
  publicUrl: string | null;
  privateUrl: string | null;
}

export function getDirectStreamingConfig(): DirectStreamingConfig {
  return {
    enabled: cache.get("direct_streaming_enabled") === "true",
    publicUrl: cache.get("jellyfin_public_url") ?? null,
    privateUrl: cache.get("jellyfin_private_url") ?? null,
  };
}

/**
 * URL publique canonique du serveur Tentacle (domaine fronté par Cloudflare),
 * gravée dans la TV au jumelage. Source de vérité : config DB `public_url`
 * (éditable depuis l'admin) ; repli sur la variable d'env TENTACLE_PUBLIC_URL.
 * Slash final retiré. Renvoie null si aucune des deux n'est définie.
 */
export function getPublicUrl(): string | null {
  return (cache.get("public_url") || process.env.TENTACLE_PUBLIC_URL || "").replace(/\/$/, "") || null;
}

/**
 * Plafonds de débit des téléchargements. Lu à CHAQUE tick de l'arbitre de
 * débit : synchrone, depuis le cache — c'est ce qui rend un changement de
 * réglage effectif sur les transferts en cours, sans redémarrage.
 */
export function getDownloadBandwidthConfig(): BandwidthCaps {
  return {
    internal: parseCap(cache.get(DOWNLOAD_BANDWIDTH_KEYS.internal)),
    external: parseCap(cache.get(DOWNLOAD_BANDWIDTH_KEYS.external)),
  };
}

/** Les adresses traitées comme le réseau local par le plafond de débit. */
export function getDownloadInternalIps(): string[] {
  return parseInternalIps(cache.get(INTERNAL_IPS_KEY));
}
