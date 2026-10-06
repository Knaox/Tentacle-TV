import { jellyfinAdminFetch, type JellyfinFailure } from "../jellyfinAdminFetch";
import { normalizeGuid, sameRepositoryUrl, versionAtLeast, type SegmentPluginSpec } from "./catalog";
import type { SegmentPluginOutcome } from "./segmentPluginsContract";

/**
 * Les gestes d'installation, un par un, par l'API de Jellyfin (mesurés sur
 * 10.11.11 et 12.1.0) :
 *
 *  - `POST /Repositories` REMPLACE toute la liste : on relit, on ajoute les
 *    nôtres au bout, on renvoie tout — les dépôts de l'administrateur restent ;
 *  - `GET /Packages` lit chaque manifeste à la volée et ne garde que les
 *    versions compatibles avec ce Jellyfin ; un dépôt muet disparaît en
 *    silence — d'où la sonde du manifeste, pour le dire en mots justes ;
 *  - `POST /Packages/Installed/{nom}` télécharge et pose le greffon (une à deux
 *    secondes), qui attend ensuite un redémarrage (`Status: Restart`).
 */

export type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

export async function readPlugins(): Promise<Loose[] | JellyfinFailure> {
  const res = await jellyfinAdminFetch("/Plugins", { timeoutMs: 8000 });
  if (!res.ok) return res.failure;
  return Array.isArray(res.data) ? res.data.filter(isRecord) : "invalid";
}

export function findPlugin(plugins: readonly Loose[], spec: SegmentPluginSpec): Loose | undefined {
  return plugins.find((plugin) => normalizeGuid(plugin.Id) === spec.guid);
}

export const pluginStatus = (plugin: Loose | undefined): string => text(plugin?.Status).toLowerCase();

/** Ajoute les dépôts qui manquent ; rend ceux qui sont (ou étaient déjà) enregistrés. */
export async function ensureRepositories(specs: readonly SegmentPluginSpec[]): Promise<{ ok: true; registered: Set<string> } | { ok: false; failure: JellyfinFailure }> {
  const current = await jellyfinAdminFetch("/Repositories");
  if (!current.ok) return { ok: false, failure: current.failure };
  const repositories = Array.isArray(current.data) ? current.data.filter(isRecord) : [];
  const missing = new Map<string, { name: string; url: string }>();
  for (const { repository } of specs) {
    const known = repositories.some((entry) => sameRepositoryUrl(entry.Url, repository.url));
    if (!known) missing.set(repository.url, repository);
  }
  if (missing.size > 0) {
    const body = [...repositories, ...[...missing.values()].map(({ name, url }) => ({ Name: name, Url: url, Enabled: true }))];
    const res = await jellyfinAdminFetch("/Repositories", { method: "POST", body, expectEmpty: true });
    if (!res.ok) return { ok: false, failure: res.failure };
  }
  const after = await jellyfinAdminFetch("/Repositories");
  if (!after.ok) return { ok: false, failure: after.failure };
  const saved = Array.isArray(after.data) ? after.data.filter(isRecord) : [];
  const registered = new Set(specs.filter((spec) => saved.some((entry) => sameRepositoryUrl(entry.Url, spec.repository.url) && entry.Enabled !== false)).map((spec) => spec.key));
  return { ok: true, registered };
}

/** Le catalogue vu par CE Jellyfin (manifestes relus) ; `null` s'il n'a pas répondu. */
export async function readPackages(): Promise<Loose[] | null> {
  const res = await jellyfinAdminFetch("/Packages", { timeoutMs: 60_000 });
  return res.ok && Array.isArray(res.data) ? res.data.filter(isRecord) : null;
}

/**
 * Le paquet absent du catalogue : son dépôt est-il muet, ou n'a-t-il rien pour
 * cette version ? On lit le manifeste comme Jellyfin le lit (même agent).
 */
export async function probeManifest(spec: SegmentPluginSpec, jellyfinVersion: string): Promise<"repo-offline" | "unavailable"> {
  try {
    const res = await fetch(spec.repository.url, {
      headers: { "User-Agent": `Jellyfin-Server/${jellyfinVersion}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return "repo-offline";
    const manifest: unknown = await res.json();
    const listed = Array.isArray(manifest) && manifest.some((entry) => isRecord(entry) && normalizeGuid(entry.guid) === spec.guid);
    return listed ? "unavailable" : "repo-offline";
  } catch {
    return "repo-offline";
  }
}

async function enablePlugin(plugin: Loose): Promise<boolean> {
  const id = text(plugin.Id);
  const version = text(plugin.Version);
  if (!id || !version) return false;
  const res = await jellyfinAdminFetch(`/Plugins/${encodeURIComponent(id)}/${encodeURIComponent(version)}/Enable`, { method: "POST", expectEmpty: true });
  return res.ok;
}

export interface InstallContext {
  plugins: readonly Loose[];
  /** `null` : le catalogue n'a pas pu être lu. */
  packages: readonly Loose[] | null;
  registered: ReadonlySet<string>;
  jellyfinVersion: string;
}

/**
 * Un greffon mis en place : déjà actif, rallumé s'il était coupé, installé
 * sinon (ou réinstallé s'il est cassé). Jamais d'exception : un résultat.
 */
export async function installPlugin(spec: SegmentPluginSpec, context: InstallContext): Promise<SegmentPluginOutcome> {
  const existing = findPlugin(context.plugins, spec);
  const status = pluginStatus(existing);
  // « Restart » : déjà posé, il attend le redémarrage — qui viendra.
  if (status === "active" || status === "restart") return "present";
  if (status === "disabled" && existing) return (await enablePlugin(existing)) ? "enabled" : "failed";
  if (spec.minJellyfin && !versionAtLeast(context.jellyfinVersion, spec.minJellyfin)) return "too-old";
  if (!context.registered.has(spec.key)) return "repo-offline";

  const entry = context.packages?.find((candidate) => normalizeGuid(candidate.guid) === spec.guid);
  const versions = Array.isArray(entry?.versions) ? entry.versions.filter(isRecord) : [];
  if (!entry || versions.length === 0) {
    return context.packages === null ? "repo-offline" : probeManifest(spec, context.jellyfinVersion);
  }
  // L'adresse EXACTE sous laquelle Jellyfin connaît ce dépôt ; sans version, il prend la plus récente compatible.
  const repositoryUrl = text(versions[0].repositoryUrl) || spec.repository.url;
  const query = `assemblyGuid=${spec.guid}&repositoryUrl=${encodeURIComponent(repositoryUrl)}`;
  const res = await jellyfinAdminFetch(`/Packages/Installed/${encodeURIComponent(spec.packageName)}?${query}`, {
    method: "POST",
    expectEmpty: true,
    timeoutMs: 120_000,
  });
  if (!res.ok) return "failed";
  const after = await readPlugins();
  return typeof after !== "string" && findPlugin(after, spec) ? "installed" : "failed";
}
