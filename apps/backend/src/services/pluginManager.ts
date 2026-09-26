import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, sep } from "path";
import { DATA_ROOT } from "./dataDir";
import { isNewerVersion } from "./semver";

// ── Types ──

export interface RegistryPlugin {
  pluginId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloadUrl?: string;
  checksum?: string;
  icon?: string;
  tags?: string[];
  category?: string;
  repo?: string;
  platforms?: string[];
  minAppVersion?: string;
  /** Notes de la dernière version, telles que le registre les publie (Markdown, blocs `### FR` / `### EN`). */
  changelog?: string;
  releaseDate?: string;
}

export interface PluginSource {
  id: string;
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
}

export interface InstalledPlugin {
  id: string;
  pluginId: string;
  sourceId: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
}

export interface EnrichedEntry extends RegistryPlugin {
  sourceId: string;
  sourceName: string;
  official: boolean;
  installed: boolean;
  installedId?: string;
  installedVersion?: string;
  updateAvailable: boolean;
}

interface RegistryCache {
  data: RegistryPlugin[];
  /** Dernière lecture RÉUSSIE (0 : jamais). */
  fetchedAt: number;
  /** Dernière tentative, réussie ou non. */
  checkedAt: number;
  error?: string;
}

/** Ce qu'on sait de la lecture d'un registre — rendu avec chaque source. */
export interface RegistryStatus {
  checkedAt: string;
  fetchedAt?: string;
  pluginCount: number;
  error?: string;
}

interface RawRegistryVersion {
  version: string; downloadUrl?: string; checksum?: string; minTentacleVersion?: string;
  changelog?: string; releaseDate?: string;
}
interface RawRegistryEntry {
  id?: string; pluginId?: string; name: string; description?: string; author?: string;
  latestVersion?: string; versions?: RawRegistryVersion[];
  icon?: string; tags?: string[]; category?: string; repo?: string; platforms?: string[];
  version?: string; downloadUrl?: string; checksum?: string;
}

// ── Constants ──

const PLUGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function isValidPluginId(id: string): boolean {
  return PLUGIN_ID_REGEX.test(id);
}

/** Verify a resolved path is safely under DATA_DIR (no path traversal). */
export function assertPathUnderDataDir(resolvedPath: string): void {
  const normalized = resolve(resolvedPath);
  const base = resolve(DATA_DIR);
  if (!normalized.startsWith(base + sep) && normalized !== base) {
    throw new Error("Invalid plugin path: outside data directory");
  }
}

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
/**
 * Une lecture en échec se retente bien plus tôt : un registre injoignable au
 * démarrage (réseau pas encore prêt, GitHub qui hoquette) vidait le catalogue
 * de cette source pendant six heures.
 */
const FAILURE_TTL = 5 * 60 * 1000;
export const DATA_DIR = resolve(DATA_ROOT, "plugins");
const SOURCES_FILE = "sources.json";
const INSTALLED_FILE = "installed.json";

const OFFICIAL_SOURCE: PluginSource = {
  id: "official",
  name: "Tentacle TV Official",
  url: "https://raw.githubusercontent.com/knaox/tentacle-plugins-registry/main/registry.json",
  official: true,
  enabled: true,
};

// ── JSON file helpers ──

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return fallback; }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  writeFileSync(resolve(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

// ── Sources ──

export function getSources(): PluginSource[] {
  const custom = readJson<PluginSource[]>(SOURCES_FILE, []);
  const override = custom.find((s) => s.id === "official");
  const official: PluginSource = override
    ? { ...OFFICIAL_SOURCE, enabled: override.enabled }
    : OFFICIAL_SOURCE;
  return [official, ...custom.filter((s) => s.id !== "official")];
}

export function getCustomSources(): PluginSource[] {
  return readJson<PluginSource[]>(SOURCES_FILE, []);
}

export function saveCustomSources(sources: PluginSource[]): void {
  writeJson(SOURCES_FILE, sources);
}

// ── Installed plugins ──

export function getInstalled(): InstalledPlugin[] {
  return readJson<InstalledPlugin[]>(INSTALLED_FILE, []);
}

export function saveInstalled(p: InstalledPlugin[]): void {
  writeJson(INSTALLED_FILE, p);
}

// ── Registry cache ──

const registryCache = new Map<string, RegistryCache>();

export function clearCache(sourceId?: string): void {
  if (sourceId) registryCache.delete(sourceId);
  else registryCache.clear();
}

function normalizePlugins(raw: RawRegistryEntry[]): RegistryPlugin[] {
  return raw.map((entry) => {
    const hasVersions = entry.versions && entry.versions.length > 0;
    // La version annoncée (`latestVersion`) porte SON archive et SON empreinte :
    // prendre la première de la liste les désaccordait dès que l'ordre différait.
    const latest = hasVersions
      ? entry.versions!.find((v) => v.version === entry.latestVersion) ?? entry.versions![0]
      : undefined;
    return {
      pluginId: entry.pluginId || entry.id || entry.name,
      name: entry.name,
      description: entry.description || "",
      version: (hasVersions ? entry.latestVersion || latest!.version : entry.version) || "0.0.0",
      author: entry.author || "",
      downloadUrl: (latest?.downloadUrl || entry.downloadUrl) || undefined,
      checksum: (latest?.checksum || entry.checksum) || undefined,
      icon: entry.icon || undefined,
      tags: entry.tags, category: entry.category, repo: entry.repo,
      platforms: entry.platforms,
      minAppVersion: latest?.minTentacleVersion,
      changelog: typeof latest?.changelog === "string" ? latest.changelog : undefined,
      releaseDate: typeof latest?.releaseDate === "string" ? latest.releaseDate : undefined,
    };
  });
}

export async function fetchRegistryCached(
  sourceId: string,
  url: string,
  forceRefresh = false,
): Promise<RegistryPlugin[]> {
  const cached = registryCache.get(sourceId);
  const ttl = cached?.error ? FAILURE_TTL : CACHE_TTL;
  if (!forceRefresh && cached && Date.now() - cached.checkedAt < ttl) {
    return cached.data;
  }

  // Un échec garde la dernière lecture réussie : une source qui hoquette ne
  // retire pas ses plugins du catalogue.
  const fail = (error: string): RegistryPlugin[] => {
    const data = cached?.data ?? [];
    registryCache.set(sourceId, { data, fetchedAt: cached?.fetchedAt ?? 0, checkedAt: Date.now(), error });
    return data;
  };

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return fail(`Registry returned ${res.status}`);

    const body = await res.json() as { plugins?: RawRegistryEntry[] } | RawRegistryEntry[];
    const rawPlugins = Array.isArray(body) ? body : (body.plugins ?? []);
    if (!Array.isArray(rawPlugins)) return fail("Registry format not recognized");
    const plugins = normalizePlugins(rawPlugins as RawRegistryEntry[]);

    const now = Date.now();
    registryCache.set(sourceId, { data: plugins, fetchedAt: now, checkedAt: now });
    return plugins;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Fetch failed");
  }
}

/** L'état de lecture du registre d'une source ; `undefined` s'il n'a pas encore été lu. */
export function registryStatus(sourceId: string): RegistryStatus | undefined {
  const cached = registryCache.get(sourceId);
  if (!cached) return undefined;
  return {
    checkedAt: new Date(cached.checkedAt).toISOString(),
    ...(cached.fetchedAt ? { fetchedAt: new Date(cached.fetchedAt).toISOString() } : {}),
    pluginCount: cached.data.length,
    ...(cached.error ? { error: cached.error } : {}),
  };
}

// ── Enrichment ──

export function enrichPlugins(
  plugins: RegistryPlugin[],
  source: PluginSource,
  installed: InstalledPlugin[],
): EnrichedEntry[] {
  return plugins.map((p) => {
    const inst = installed.find((i) => i.pluginId === p.pluginId);
    return {
      ...p,
      sourceId: source.id,
      sourceName: source.name,
      official: source.official,
      installed: !!inst,
      installedId: inst?.id,
      installedVersion: inst?.version,
      updateAvailable: !!inst && isNewerVersion(p.version, inst.version),
    };
  });
}
