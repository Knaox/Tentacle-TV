import { BOOT_ID } from "../pluginRestart";
import type { LinkProbe, LinkProbeResult } from "./serverLinksContract";

/**
 * Les sondes des liens du serveur : une requête légère par adresse, sans
 * clé ni jeton — `/api/health` pour Tentacle, `/System/Info/Public` pour
 * Jellyfin, deux routes publiques.
 *
 * On ne se contente pas d'une réponse : on vérifie QUI répond. Tentacle se
 * reconnaît à l'identifiant de son processus (`BOOT_ID`, que `/api/health`
 * rend) ; Jellyfin à l'identifiant de son serveur, comparé à celui du
 * Jellyfin connecté. Un lien qui mène à un autre serveur est pire qu'un lien
 * absent : les appareils le suivraient sans rien dire.
 */

const TIMEOUT_MS = 4000;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function probe(result: LinkProbeResult, extra: Partial<LinkProbe> = {}): LinkProbe {
  return { result, httpStatus: null, version: null, cors: null, detail: null, ...extra };
}

/** Un échec réseau en une cause lisible : le code système s'il y en a un (« ECONNREFUSED »). */
function failure(error: unknown): LinkProbe {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return probe("timeout");
  const cause = error instanceof Error && isRecord(error.cause) ? error.cause : null;
  const detail = text(cause?.code) || text(cause?.message) || (error instanceof Error ? error.message : "");
  return probe("unreachable", { detail: detail || null });
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<{ res: Response; body: unknown }> {
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body: unknown = res.ok ? await res.json().catch(() => null) : null;
  return { res, body };
}

/** Le lien public de Tentacle mène-t-il à CE serveur ? */
export async function probeTentacle(url: string): Promise<LinkProbe> {
  try {
    const { res, body } = await getJson(`${url}/api/health`);
    if (!res.ok) return probe("http-error", { httpStatus: res.status });
    const bootId = isRecord(body) ? text(body.bootId) : "";
    if (!bootId) return probe("unexpected", { httpStatus: res.status });
    return probe(bootId === BOOT_ID ? "ok" : "other-server", { httpStatus: res.status });
  } catch (error) {
    return failure(error);
  }
}

/** « 4b3c…-… » et « 4b3c… » désignent le même serveur. */
const sameId = (a: string, b: string) => a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();

/**
 * Une adresse de Jellyfin : répond-elle, est-ce le Jellyfin connecté
 * (`expectedId`, `null` : on ne le sait pas ; une promesse, pour sonder en
 * même temps qu'on le lit), et autorise-t-elle l'origine
 * `origin` (CORS) — sans quoi un navigateur ne peut pas y lire en direct.
 */
export async function probeJellyfin(
  url: string,
  options: { expectedId: string | null | Promise<string | null>; origin: string | null },
): Promise<LinkProbe> {
  try {
    const { res, body } = await getJson(`${url}/System/Info/Public`, options.origin ? { Origin: options.origin } : {});
    if (!res.ok) return probe("http-error", { httpStatus: res.status });
    const id = isRecord(body) ? text(body.Id) : "";
    if (!id) return probe("unexpected", { httpStatus: res.status });
    const acao = res.headers.get("access-control-allow-origin");
    const cors = options.origin ? acao === "*" || acao === options.origin : null;
    const expectedId = await options.expectedId;
    const result: LinkProbeResult = expectedId && !sameId(id, expectedId) ? "other-server" : "ok";
    return probe(result, { httpStatus: res.status, version: text((body as Json).Version) || null, cors });
  } catch (error) {
    return failure(error);
  }
}

/** L'identifiant du Jellyfin connecté, par l'adresse que joint le serveur ; `null` s'il ne répond pas. */
export async function connectedJellyfinId(jellyfinUrl: string | undefined): Promise<string | null> {
  if (!jellyfinUrl) return null;
  try {
    const { body } = await getJson(`${jellyfinUrl.replace(/\/+$/, "")}/System/Info/Public`);
    return isRecord(body) ? text(body.Id) || null : null;
  } catch {
    return null;
  }
}
