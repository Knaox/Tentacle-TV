import { resolve } from "path";
import { DATA_ROOT } from "../dataDir";
import { BACKEND_VERSION } from "../version";
import { isValidJellyfinVersion } from "./compatManifest";
import { readJsonFile, writeJsonFile } from "./jsonFile";

/**
 * La dernière version STABLE de Jellyfin, telle que la publie le projet sur
 * GitHub (source officielle : les versions candidates n'y sont pas « latest »).
 *
 * Relue toutes les six heures, par requête conditionnelle (`If-None-Match` : un
 * 304 ne compte pas dans le quota de 60 appels par heure de l'API anonyme), et
 * gardée sur disque : hors ligne, on montre la dernière connue et sa date.
 */

const DEFAULT_URL = "https://api.github.com/repos/jellyfin/jellyfin/releases/latest";
const TTL_MS = 6 * 3600_000;
const FORCED_MIN_GAP_MS = 60_000;
const FETCH_TIMEOUT_MS = 8000;

export interface JellyfinRelease {
  /** « 12.1 » — la version sans le `v` du tag. */
  version: string;
  tag: string;
  publishedAt: string | null;
  /** Les notes de version, construites ici : jamais une adresse reçue telle quelle. */
  url: string;
}

export interface ReleaseState {
  release: JellyfinRelease | null;
  /** Dernière lecture RÉUSSIE. */
  checkedAt: string | null;
  error: "unreachable" | "rate-limited" | "invalid" | null;
}

type Json = Record<string, unknown>;

/** `off` coupe la lecture (installation isolée, tests). */
function releasesUrl(): string | null {
  const configured = process.env.TENTACLE_JELLYFIN_RELEASES_URL?.trim();
  if (configured === "off") return null;
  return configured || DEFAULT_URL;
}

const cachePath = () => resolve(DATA_ROOT, "compat", "jellyfin-latest.json");

/** Une publication stable lisible, ou `null`. */
export function readRelease(raw: unknown): JellyfinRelease | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Json;
  if (r.draft === true || r.prerelease === true || typeof r.tag_name !== "string") return null;
  const version = r.tag_name.trim().replace(/^v/, "");
  if (!isValidJellyfinVersion(version)) return null;
  return {
    version,
    tag: r.tag_name,
    publishedAt: typeof r.published_at === "string" ? r.published_at : null,
    url: `https://github.com/jellyfin/jellyfin/releases/tag/${encodeURIComponent(r.tag_name)}`,
  };
}

let state: ReleaseState | undefined;
let lastAttempt: number | null = null;
let etag: string | null = null;
let inFlight: Promise<void> | null = null;

function held(): ReleaseState {
  if (state) return state;
  const saved = readJsonFile(cachePath()) as Json | undefined;
  const release = saved ? readRelease(saved.raw) : null;
  state = {
    release,
    checkedAt: release && typeof saved?.checkedAt === "string" ? saved.checkedAt : null,
    error: null,
  };
  return state;
}

async function fetchLatest(url: string): Promise<void> {
  const previous = held();
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Tentacle-TV/${BACKEND_VERSION}`,
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const now = new Date().toISOString();
    if (res.status === 304 && previous.release) {
      state = { ...previous, checkedAt: now, error: null };
      return;
    }
    if (res.status === 403 || res.status === 429) {
      state = { ...previous, error: "rate-limited" };
      return;
    }
    if (!res.ok) {
      state = { ...previous, error: "unreachable" };
      return;
    }
    const raw: unknown = await res.json();
    const release = readRelease(raw);
    if (!release) {
      state = { ...previous, error: "invalid" };
      return;
    }
    etag = res.headers.get("etag");
    state = { release, checkedAt: now, error: null };
    // Le brut, relu par `readRelease` au démarrage suivant : une seule lecture.
    writeJsonFile(cachePath(), { checkedAt: now, raw: { tag_name: release.tag, published_at: release.publishedAt } });
  } catch {
    state = { ...previous, error: "unreachable" };
  } finally {
    lastAttempt = Date.now();
  }
}

/** Relit GitHub si la dernière tentative a plus de six heures, ou avec `force` (une fois par minute au plus). */
export function refreshLatestJellyfin(force = false): Promise<void> {
  const url = releasesUrl();
  if (!url) return Promise.resolve();
  const age = lastAttempt === null ? Infinity : Date.now() - lastAttempt;
  if (age < (force ? FORCED_MIN_GAP_MS : TTL_MS)) return Promise.resolve();
  inFlight ??= fetchLatest(url).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function getLatestJellyfin(): ReleaseState {
  return held();
}

/** Pour les tests : oublier tout ce qui a été lu. */
export function resetLatestJellyfinForTests(): void {
  state = undefined;
  lastAttempt = null;
  etag = null;
  inFlight = null;
}
