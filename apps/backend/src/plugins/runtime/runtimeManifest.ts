import { resolve, sep } from "path";
import type { HostApiFamily, PluginRuntimeManifest, ToolName } from "./pluginServerRuntime";
import { readClientFetchManifest } from "./pluginClientFetch";

/**
 * `plugin.json` → `runtime`, VALIDÉ : la seule forme que l'hôte croit. Un champ
 * mal formé rend le manifeste entier invalide (`null`) — on ne lance jamais un
 * invité à moitié décrit. Tout ce qui sort d'ici est déjà borné : module DANS le
 * dossier de l'extension, outils et familles de la liste fermée, noms de
 * variables d'environnement simples, routes publiques sous la racine.
 */

export const KNOWN_TOOLS: readonly ToolName[] = ["yt-dlp"];
export const KNOWN_FAMILIES: readonly HostApiFamily[] = ["jellyfin.music", "users", "events", "tools", "client"];

const SAFE_ROUTE = /^\/[A-Za-z0-9_\-/]{1,100}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
/** Ce que l'invité ne peut jamais réclamer, même déclaré : le cœur et Node s'en servent. */
const RESERVED_ENV = /^(TENTACLE_|NODE_|JELLYFIN_|DATABASE_|DB_|npm_)|^(PATH|HOME|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_INSERT_LIBRARIES|PRISMA_QUERY_ENGINE_LIBRARY)$/;
const ENTRY = /^[A-Za-z0-9_\-./]{1,120}\.(mjs|js)$/;

function stringList(value: unknown, max: number): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  return value.every((v) => typeof v === "string") ? (value as string[]) : null;
}

function closedList<T extends string>(value: unknown, known: readonly T[]): T[] | null {
  const list = stringList(value, known.length * 2);
  if (!list) return null;
  if (!list.every((v) => (known as readonly string[]).includes(v))) return null;
  return [...new Set(list)] as T[];
}

/** Le module, résolu DANS le dossier de l'extension ; `null` s'il en sortirait. */
export function runtimeEntryPath(pluginDir: string, entry: string): string | null {
  const base = resolve(pluginDir);
  const full = resolve(base, entry);
  return full.startsWith(base + sep) ? full : null;
}

export function readRuntimeManifest(manifest: unknown): PluginRuntimeManifest | null {
  if (!manifest || typeof manifest !== "object") return null;
  const raw = (manifest as { runtime?: unknown }).runtime;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "isolated") return null;
  if (typeof r.entry !== "string" || !ENTRY.test(r.entry) || r.entry.startsWith("/") || r.entry.split("/").includes("..")) return null;

  const tools = closedList(r.tools, KNOWN_TOOLS);
  const hostApi = closedList(r.hostApi, KNOWN_FAMILIES);
  const env = stringList(r.env, 32);
  const publicRoutes = stringList(r.publicRoutes, 16);
  if (!tools || !hostApi || !env || !publicRoutes) return null;
  if (!env.every((name) => ENV_NAME.test(name) && !RESERVED_ENV.test(name))) return null;
  if (!publicRoutes.every((route) => SAFE_ROUTE.test(route) && !route.includes("//"))) return null;

  // Les requêtes déléguées : déclarées, elles doivent être valides (sinon rien ne se lance).
  const clientFetch = r.clientFetch === undefined ? undefined : readClientFetchManifest(r.clientFetch);
  if (clientFetch === null) return null;

  return { kind: "isolated", entry: r.entry, tools, env: [...new Set(env)], publicRoutes, hostApi, ...(clientFetch ? { clientFetch } : {}) };
}

/** La route relayée (`/webhooks/lidarr`) est-elle publique pour ce manifeste ? Égalité stricte, jamais un préfixe. */
export function isPublicRoute(manifest: PluginRuntimeManifest, route: string): boolean {
  return (manifest.publicRoutes ?? []).includes(route);
}
