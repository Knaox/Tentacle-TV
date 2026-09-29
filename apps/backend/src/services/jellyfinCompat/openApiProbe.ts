import { getJellyfinUrl } from "../configStore";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import type { FeatureProbe } from "./compatReport";

/**
 * Ce que le Jellyfin connecté publie VRAIMENT : son document OpenAPI
 * (`/api-docs/openapi.json`, servi de 10.10 à 12.x) liste ses routes. Chaque
 * fonctionnalité du manifeste déclare celles dont elle a besoin ; on les y
 * cherche. Le manifeste dit ce qu'une version SAIT faire ; la sonde dit ce que
 * CE serveur-là expose.
 *
 * Le document pèse ~2 Mo : il est lu une fois par serveur, par version de
 * Jellyfin et par heure (un plugin y ajoute ses routes), et seul l'index des
 * routes (quelques centaines de chaînes) est gardé — le JSON complet est rendu
 * au ramasse-miettes dès l'index construit.
 */

const TTL_MS = 3600_000;
const FETCH_TIMEOUT_MS = 15_000;
const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head"];

let cached: { key: string; index: Set<string>; at: number } | null = null;

/**
 * « GET /MediaSegments/{itemId} » → « get /mediasegments/{} » : Jellyfin
 * route sans égard à la casse, et le nom d'un paramètre change d'une version à
 * l'autre (`{id}`, `{itemId}`) sans que la route change.
 */
export function normalizeEndpoint(endpoint: string): string {
  const [method, ...rest] = endpoint.trim().split(/\s+/);
  return `${method.toLowerCase()} ${rest.join(" ").toLowerCase().replace(/\{[^}]*\}/g, "{}")}`;
}

/** L'index des routes d'un document OpenAPI ; `null` s'il n'en a pas la forme. */
export function indexOpenApi(doc: unknown): Set<string> | null {
  if (typeof doc !== "object" || doc === null) return null;
  const paths = (doc as { paths?: unknown }).paths;
  if (typeof paths !== "object" || paths === null) return null;
  const index = new Set<string>();
  for (const [path, operations] of Object.entries(paths)) {
    if (typeof operations !== "object" || operations === null) continue;
    for (const method of Object.keys(operations)) {
      if (HTTP_METHODS.includes(method.toLowerCase())) index.add(normalizeEndpoint(`${method} ${path}`));
    }
  }
  return index.size > 0 ? index : null;
}

/** Les routes publiées par le Jellyfin connecté, en `version` ; `null` si le document ne se lit pas. */
export async function readEndpointIndex(jellyfinVersion: string): Promise<Set<string> | null> {
  const key = `${getJellyfinUrl() ?? ""}|${jellyfinVersion}`;
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.index;
  const result = await jellyfinAdminFetch("/api-docs/openapi.json", { timeoutMs: FETCH_TIMEOUT_MS });
  const index = result.ok ? indexOpenApi(result.data) : null;
  if (!index) return null;
  cached = { key, index, at: Date.now() };
  return index;
}

/** Le verdict de la sonde pour une fonctionnalité ; `null` quand elle ne déclare rien à chercher. */
export function probeFeature(endpoints: readonly string[], index: ReadonlySet<string>): FeatureProbe | null {
  if (endpoints.length === 0) return null;
  const missing = endpoints.filter((endpoint) => !index.has(normalizeEndpoint(endpoint)));
  return { state: missing.length === 0 ? "present" : "missing", missing };
}

/** Pour les tests : oublier l'index gardé. */
export function resetEndpointIndexForTests(): void {
  cached = null;
}
