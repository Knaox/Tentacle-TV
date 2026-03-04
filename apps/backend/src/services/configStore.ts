import { getPrisma, hasPrisma } from "./db";

export type AppState =
  | "setup_db"       // No database connection
  | "setup_jellyfin" // DB OK but Jellyfin not configured
  | "setup_admin"    // Jellyfin OK but no admin user
  | "running";       // Fully configured

let appState: AppState = "setup_db";
const cache = new Map<string, string>();

/** Detect the current app state by reading DB config. */
export async function detectAppState(): Promise<AppState> {
  if (!hasPrisma()) {
    appState = "setup_db";
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
    // Table doesn't exist yet — need to run migrations
    appState = "setup_db";
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
