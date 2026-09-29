import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { DATA_ROOT } from "../dataDir";
import { parseCompatManifest, type CompatManifest } from "./compatManifest";
import { readJsonFile, writeJsonFile } from "./jsonFile";

/**
 * Le manifeste de compatibilité Jellyfin que ce serveur tient pour vrai.
 *
 * Trois sources, la révision la plus haute l'emporte :
 * - celui de l'image (`compat/jellyfin.json`, copié par le Dockerfile) — le
 *   verdict est donc connu même sans Internet ;
 * - la dernière révision lue sur GitHub, gardée sur disque
 *   (`data/compat/jellyfin.json`) pour survivre à un redémarrage hors ligne ;
 * - le fichier publié sur `main`, relu toutes les six heures : un verdict
 *   nouveau arrive sans nouvelle version du serveur.
 *
 * Un manifeste distant qui ne se lit pas (une seule faute), ou dont la révision
 * n'est pas plus haute, ne remplace RIEN.
 */

const DEFAULT_REMOTE_URL = "https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/compat/jellyfin.json";
const REFRESH_EVERY_MS = 6 * 3600_000;
/** « Revérifier » à la chaîne ne relit pas GitHub plus d'une fois par demi-minute. */
const FORCED_MIN_GAP_MS = 30_000;
const FETCH_TIMEOUT_MS = 8000;

export type ManifestSource = "embedded" | "remote";

export interface ManifestState {
  manifest: CompatManifest | null;
  source: ManifestSource | null;
  remoteCheckedAt: string | null;
  remoteError: string | null;
}

interface Held {
  manifest: CompatManifest;
  source: ManifestSource;
}

/** `off` coupe la lecture distante (installation isolée, tests). */
function remoteUrl(): string | null {
  const configured = process.env.TENTACLE_COMPAT_MANIFEST_URL?.trim();
  if (configured === "off") return null;
  return configured || DEFAULT_REMOTE_URL;
}

const cachePath = () => resolve(DATA_ROOT, "compat", "jellyfin.json");

/**
 * `compat/jellyfin.json` en remontant depuis ce fichier : `src/services/…` en
 * développement, `dist/services/…` dans l'image — la racine n'est pas à la
 * même profondeur de `apps/backend` dans les deux, mais elle est au-dessus.
 */
function embeddedPath(): string | null {
  let folder = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(folder, "compat", "jellyfin.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  return null;
}

function parseOrWarn(raw: unknown, origin: string): CompatManifest | null {
  const parsed = parseCompatManifest(raw);
  if (parsed.ok) return parsed.manifest;
  console.warn(`[compat] manifeste ${origin} refusé : ${parsed.errors.slice(0, 3).join(" ; ")}`);
  return null;
}

function loadLocal(): Held | null {
  const path = embeddedPath();
  let embedded: CompatManifest | null = null;
  if (path) {
    try {
      embedded = parseOrWarn(JSON.parse(readFileSync(path, "utf-8")), "embarqué");
    } catch (err) {
      console.warn(`[compat] manifeste embarqué illisible : ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.warn("[compat] aucun compat/jellyfin.json au-dessus du serveur : verdicts « non testée »");
  }
  const cachedRaw = readJsonFile(cachePath());
  const cached = cachedRaw === undefined ? null : parseOrWarn(cachedRaw, "gardé sur disque");
  if (cached && (!embedded || cached.revision > embedded.revision)) return { manifest: cached, source: "remote" };
  return embedded ? { manifest: embedded, source: "embedded" } : null;
}

let held: Held | null | undefined;
let remoteCheckedAt: number | null = null;
let remoteError: string | null = null;
let etag: string | null = null;
let inFlight: Promise<void> | null = null;

function current(): Held | null {
  if (held === undefined) held = loadLocal();
  return held;
}

async function fetchRemote(url: string): Promise<void> {
  try {
    const res = await fetch(url, {
      headers: etag ? { "If-None-Match": etag } : {},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 304) {
      remoteError = null;
      return;
    }
    if (!res.ok) {
      remoteError = `HTTP ${String(res.status)}`;
      return;
    }
    const manifest = parseOrWarn(await res.json(), "publié");
    if (!manifest) {
      remoteError = "invalid";
      return;
    }
    remoteError = null;
    etag = res.headers.get("etag");
    const mine = current();
    if (mine && manifest.revision <= mine.manifest.revision) return;
    held = { manifest, source: "remote" };
    writeJsonFile(cachePath(), manifest);
    console.info(`[compat] manifeste révision ${String(manifest.revision)} adopté (publié sur GitHub)`);
  } catch (err) {
    remoteError = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "unreachable";
  } finally {
    remoteCheckedAt = Date.now();
  }
}

/**
 * Relit le manifeste publié s'il date de plus de six heures — ou tout de suite
 * avec `force` (au plus une fois par demi-minute). Ne lève jamais.
 */
export function refreshCompatManifest(force = false): Promise<void> {
  const url = remoteUrl();
  if (!url) return Promise.resolve();
  const age = remoteCheckedAt === null ? Infinity : Date.now() - remoteCheckedAt;
  if (age < (force ? FORCED_MIN_GAP_MS : REFRESH_EVERY_MS)) return Promise.resolve();
  inFlight ??= fetchRemote(url).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function getCompatManifestState(): ManifestState {
  const mine = current();
  return {
    manifest: mine?.manifest ?? null,
    source: mine?.source ?? null,
    remoteCheckedAt: remoteCheckedAt === null ? null : new Date(remoteCheckedAt).toISOString(),
    remoteError,
  };
}

/** Pour les tests : oublier tout ce qui a été lu. */
export function resetCompatManifestForTests(): void {
  held = undefined;
  remoteCheckedAt = null;
  remoteError = null;
  etag = null;
  inFlight = null;
}
