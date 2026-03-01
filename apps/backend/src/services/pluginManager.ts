import { createHash } from "crypto";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, createWriteStream } from "fs";
import { resolve, join } from "path";
import { pipeline } from "stream/promises";

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
  installedVersion?: string;
  updateAvailable: boolean;
}

interface RegistryCache {
  data: RegistryPlugin[];
  fetchedAt: number;
  error?: string;
}

interface RawRegistryVersion {
  version: string; downloadUrl?: string; checksum?: string; minTentacleVersion?: string;
}
interface RawRegistryEntry {
  id?: string; pluginId?: string; name: string; description?: string; author?: string;
  latestVersion?: string; versions?: RawRegistryVersion[];
  icon?: string; tags?: string[]; category?: string; repo?: string; platforms?: string[];
  version?: string; downloadUrl?: string; checksum?: string;
}

// ── Constants ──

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
export const DATA_DIR = resolve(__dirname, "../../data/plugins");
const SOURCES_FILE = "sources.json";
const INSTALLED_FILE = "installed.json";
const SEER_CONFIG_FILE = "seer-config.json";

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

// ── Seer config ──

export function getSeerConfig(): Record<string, unknown> {
  return readJson<Record<string, unknown>>(SEER_CONFIG_FILE, {});
}

export function saveSeerConfig(config: Record<string, unknown>): void {
  writeJson(SEER_CONFIG_FILE, config);
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
    const latest = hasVersions ? entry.versions![0] : undefined;
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
    };
  });
}

export async function fetchRegistryCached(
  sourceId: string,
  url: string,
  forceRefresh = false,
): Promise<RegistryPlugin[]> {
  const cached = registryCache.get(sourceId);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      const errMsg = `Registry returned ${res.status}`;
      if (cached) { registryCache.set(sourceId, { ...cached, error: errMsg }); return cached.data; }
      registryCache.set(sourceId, { data: [], fetchedAt: Date.now(), error: errMsg });
      return [];
    }

    const body = await res.json() as { plugins?: RawRegistryEntry[] } | RawRegistryEntry[];
    const rawPlugins = Array.isArray(body) ? body : (body.plugins ?? []);
    const plugins = normalizePlugins(rawPlugins as RawRegistryEntry[]);

    registryCache.set(sourceId, { data: plugins, fetchedAt: Date.now() });
    return plugins;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Fetch failed";
    if (cached) { registryCache.set(sourceId, { ...cached, error: errMsg }); return cached.data; }
    registryCache.set(sourceId, { data: [], fetchedAt: Date.now(), error: errMsg });
    return [];
  }
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
      installedVersion: inst?.version,
      updateAvailable: !!inst && inst.version !== p.version,
    };
  });
}

// ── Download & Extract ──

export async function downloadPlugin(
  pluginId: string,
  downloadUrl: string,
  expectedChecksum?: string,
): Promise<string> {
  const tmpDir = resolve(DATA_DIR, ".tmp");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const tmpFile = join(tmpDir, `${pluginId}-${Date.now()}.tgz`);
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  if (!res.body) throw new Error("Download failed: empty response body");

  const fileStream = createWriteStream(tmpFile);
  // @ts-expect-error Node.js ReadableStream compatibility
  await pipeline(res.body, fileStream);

  if (expectedChecksum) {
    const valid = await verifyChecksum(tmpFile, expectedChecksum);
    if (!valid) {
      rmSync(tmpFile, { force: true });
      throw new Error("Checksum verification failed: file may be corrupted or tampered");
    }
  }

  return tmpFile;
}

async function verifyChecksum(filePath: string, expected: string): Promise<boolean> {
  const { readFile } = await import("fs/promises");
  const data = await readFile(filePath);
  const hash = createHash("sha256").update(data).digest("hex");
  return hash === expected.replace(/^sha256:/i, "").toLowerCase();
}

export async function extractPlugin(archivePath: string, pluginId: string): Promise<string> {
  const destDir = resolve(DATA_DIR, pluginId);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const { execSync } = await import("child_process");
  execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, {
    stdio: "pipe", timeout: 30_000,
  });
  rmSync(archivePath, { force: true });
  return destDir;
}

export function removePluginFiles(pluginId: string): void {
  const dir = resolve(DATA_DIR, pluginId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
