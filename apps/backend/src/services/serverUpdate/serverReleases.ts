import { resolve } from "path";
import { DATA_ROOT } from "../dataDir";
import { BACKEND_VERSION } from "../version";
import { readJsonFile, writeJsonFile } from "../jellyfinCompat/jsonFile";
import { releaseHighlights } from "./releaseNotes";
import {
  compareServerVersions,
  parseServerVersion,
  type ServerRelease,
  type ServerUpdateCheckError,
} from "./serverUpdateContract";

/**
 * La dernière version PUBLIÉE du serveur, lue sur GitHub — jamais un appel par
 * affichage : relue toutes les six heures (« Revérifier » : une fois par
 * minute au plus), par requêtes conditionnelles (un 304 ne compte pas dans le
 * quota de 60 appels par heure de l'API anonyme), et gardée sur disque : hors
 * ligne, on montre la dernière connue et sa date.
 *
 * Par les TAGS `server-v*` plutôt que par la liste des Releases : le dépôt
 * publie toutes ses plateformes (`releases/latest` est souvent le bureau), et
 * la liste des tags du serveur pèse quelques kilo-octets contre plusieurs
 * centaines pour cent publications et leurs notes. Puis la publication du plus
 * haut tag — un tag posé par la CI avant la sortie de sa publication rend 404 :
 * on regarde le précédent.
 *
 * À côté, `minServer` du `versions.json` du dépôt : ce que les clients publiés
 * exigent du serveur (la règle de la carte ne le retient qu'une fois la
 * version exigée publiée).
 *
 * `TENTACLE_SERVER_UPDATE_REPO=off` coupe tout (installation isolée) ; une
 * autre valeur désigne l'API d'un autre dépôt. `TENTACLE_SERVER_UPDATE_VERSIONS_URL`
 * fait de même pour `versions.json`.
 */

const DEFAULT_REPO_API = "https://api.github.com/repos/Knaox/Tentacle-TV";
const DEFAULT_VERSIONS_URL = "https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/versions.json";
const TTL_MS = 6 * 3600_000;
const FORCED_MIN_GAP_MS = 60_000;
const FETCH_TIMEOUT_MS = 8000;
/** Les plus hauts tags essayés quand leur publication manque (CI en cours, brouillon). */
const MAX_CANDIDATES = 3;
const TAG_RE = /^(?:refs\/tags\/)?server-v(\d+\.\d+\.\d+)$/;

type CheckError = Exclude<ServerUpdateCheckError, "off">;

export interface ServerReleaseState {
  latest: ServerRelease | null;
  /** Les versions des tags `server-vX.Y.Z`, de la plus récente à la plus ancienne. */
  versions: string[];
  minServer: string | null;
  /** Dernière lecture RÉUSSIE. */
  checkedAt: string | null;
  error: CheckError | null;
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function repoApi(): string | null {
  const configured = process.env.TENTACLE_SERVER_UPDATE_REPO?.trim();
  if (configured === "off") return null;
  return (configured || DEFAULT_REPO_API).replace(/\/+$/, "");
}

function versionsUrl(): string | null {
  const configured = process.env.TENTACLE_SERVER_UPDATE_VERSIONS_URL?.trim();
  if (configured === "off") return null;
  return configured || DEFAULT_VERSIONS_URL;
}

export const serverUpdateCheckEnabled = (): boolean => repoApi() !== null;

/** La page des notes, construite ici : jamais une adresse reçue telle quelle. */
function releasePage(api: string, tag: string): string {
  const repo = /^https:\/\/api\.github\.com\/repos\/([\w.-]+\/[\w.-]+)$/.exec(api)?.[1] ?? "Knaox/Tentacle-TV";
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

/** Les versions des tags du serveur — ni les reconstructions webOS (`-webos-`), ni rien d'illisible. */
export function readTagVersions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const versions = new Set<string>();
  for (const entry of raw) {
    const ref = isRecord(entry) && typeof entry.ref === "string" ? entry.ref : "";
    const version = TAG_RE.exec(ref)?.[1];
    if (version && parseServerVersion(version)) versions.add(version);
  }
  return [...versions].sort((a, b) => compareServerVersions(b, a));
}

/** Une publication stable du tag attendu, ou `null` (brouillon, version candidate, autre tag). */
export function readServerRelease(raw: unknown, version: string, page: string): ServerRelease | null {
  const tag = `server-v${version}`;
  if (!isRecord(raw) || raw.draft === true || raw.prerelease === true || raw.tag_name !== tag) return null;
  return {
    version,
    tag,
    publishedAt: typeof raw.published_at === "string" ? raw.published_at : null,
    url: page,
    highlights: releaseHighlights(raw.body),
  };
}

const cachePath = () => resolve(DATA_ROOT, "update", "server-latest.json");

function readSaved(raw: unknown): ServerReleaseState | null {
  if (!isRecord(raw) || !isRecord(raw.latest)) return null;
  const latest = raw.latest;
  const highlights = isRecord(latest.highlights) ? latest.highlights : {};
  const texts = (value: unknown) => (Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : []);
  if (typeof latest.version !== "string" || !parseServerVersion(latest.version) || typeof latest.url !== "string") return null;
  return {
    latest: {
      version: latest.version,
      tag: `server-v${latest.version}`,
      publishedAt: typeof latest.publishedAt === "string" ? latest.publishedAt : null,
      url: latest.url,
      highlights: { fr: texts(highlights.fr), en: texts(highlights.en) },
    },
    versions: texts(raw.versions).filter((v) => parseServerVersion(v)),
    minServer: parseServerVersion(raw.minServer) ? (raw.minServer as string) : null,
    checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : null,
    error: null,
  };
}

let state: ServerReleaseState | undefined;
let lastAttempt: number | null = null;
let tagsEtag: string | null = null;
let versionsEtag: string | null = null;
let inFlight: Promise<void> | null = null;

function held(): ServerReleaseState {
  state ??= readSaved(readJsonFile(cachePath())) ?? { latest: null, versions: [], minServer: null, checkedAt: null, error: null };
  return state;
}

async function getJson(url: string, etag: string | null): Promise<{ status: number; etag: string | null; body: unknown }> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Tentacle-TV/${BACKEND_VERSION}`,
      ...(etag ? { "If-None-Match": etag } : {}),
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body: unknown = res.status === 200 ? await res.json().catch(() => undefined) : undefined;
  return { status: res.status, etag: res.headers.get("etag"), body };
}

const failureOf = (status: number): CheckError => (status === 403 || status === 429 ? "rate-limited" : "unreachable");

/** `minServer` publié ; l'ancien s'il ne se relit pas — une panne de lecture n'efface pas une exigence. */
async function readMinServer(previous: string | null): Promise<string | null> {
  const url = versionsUrl();
  if (!url) return null;
  try {
    const res = await getJson(url, previous !== null ? versionsEtag : null);
    if (res.status !== 200) return previous;
    versionsEtag = res.etag;
    const value = isRecord(res.body) ? res.body.minServer : undefined;
    return parseServerVersion(value) ? (value as string).trim().replace(/^v/, "") : null;
  } catch {
    return previous;
  }
}

/** La publication du plus haut tag qui en a une, parmi les premiers. */
async function latestPublished(api: string, versions: string[]): Promise<ServerRelease | CheckError | null> {
  for (const version of versions.slice(0, MAX_CANDIDATES)) {
    const tag = `server-v${version}`;
    const res = await getJson(`${api}/releases/tags/${encodeURIComponent(tag)}`, null);
    if (res.status === 404) continue;
    if (res.status !== 200) return failureOf(res.status);
    const release = readServerRelease(res.body, version, releasePage(api, tag));
    if (release) return release;
  }
  return null;
}

async function check(api: string): Promise<void> {
  const previous = held();
  try {
    const tags = await getJson(`${api}/git/matching-refs/tags/server-v`, previous.latest ? tagsEtag : null);
    const now = new Date().toISOString();
    if (tags.status === 304 && previous.latest) {
      state = { ...previous, minServer: await readMinServer(previous.minServer), checkedAt: now, error: null };
    } else if (tags.status !== 200) {
      state = { ...previous, error: failureOf(tags.status) };
      return;
    } else {
      const versions = readTagVersions(tags.body);
      const latest = versions ? await latestPublished(api, versions) : null;
      if (typeof latest === "string") {
        state = { ...previous, error: latest };
        return;
      }
      if (!versions || !latest) {
        state = { ...previous, error: "invalid" };
        return;
      }
      tagsEtag = tags.etag;
      state = { latest, versions, minServer: await readMinServer(previous.minServer), checkedAt: now, error: null };
    }
    writeJsonFile(cachePath(), { checkedAt: state.checkedAt, latest: state.latest, versions: state.versions, minServer: state.minServer });
  } catch {
    state = { ...previous, error: "unreachable" };
  } finally {
    lastAttempt = Date.now();
  }
}

/** Relit GitHub si la dernière tentative a plus de six heures, ou avec `force` (une fois par minute au plus). */
export function refreshServerRelease(force = false): Promise<void> {
  const api = repoApi();
  if (!api) return Promise.resolve();
  const age = lastAttempt === null ? Infinity : Date.now() - lastAttempt;
  if (age < (force ? FORCED_MIN_GAP_MS : TTL_MS)) return Promise.resolve();
  inFlight ??= check(api).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function getServerReleaseState(): ServerReleaseState {
  return held();
}

/** Pour les tests : oublier tout ce qui a été lu. */
export function resetServerReleaseForTests(): void {
  state = undefined;
  lastAttempt = null;
  tagsEtag = null;
  versionsEtag = null;
  inFlight = null;
}
