import type { FastifyCorsOptions } from "@fastify/cors";
import type { FastifyRequest } from "fastify";
import { getConfigValue, getPublicUrl } from "./configStore";
import { DESKTOP_APP_ORIGINS, originOf } from "./jellyfinCors";

/**
 * Le CORS de Tentacle lui-même : qui peut appeler son API depuis une page.
 *
 * Sans `CORS_ORIGINS`, tout le monde (le comportement de toujours). Avec, la
 * liste — et, sans qu'on ait à les y recopier, les applications de bureau,
 * le lien public réglé, l'adresse de ce serveur sur le réseau réglée, et la
 * page servie par Tentacle lui-même (même origine que la requête). Une
 * origine refusée n'est plus une erreur 500 : la réponse part sans en-tête
 * CORS, et c'est le navigateur qui la retient.
 */

const LOCAL_URL_KEY = "remote_access_local_url";

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface CorsContext {
  /** `CORS_ORIGINS`, lu une fois. */
  listed: readonly string[];
  /** Ce que la requête dit d'elle-même : `http(s)://hôte[:port]` (derrière un mandataire voisin, l'hôte public). */
  self: string | null;
  publicUrl: string | null;
  localUrl: string | null;
}

/** L'origine d'une page est-elle acceptée ? (Sans `CORS_ORIGINS`, toujours.) */
export function isAllowedOrigin(origin: string | undefined, ctx: CorsContext): boolean {
  if (!origin || ctx.listed.length === 0) return true;
  if (ctx.listed.includes(origin) || (DESKTOP_APP_ORIGINS as readonly string[]).includes(origin)) return true;
  const normalized = originOf(origin);
  if (!normalized) return false;
  return [ctx.self, ctx.publicUrl, ctx.localUrl].some((url) => originOf(url) === normalized);
}

/** Les options de `@fastify/cors`, décidées requête par requête. */
export function tentacleCorsDelegator(listed: readonly string[]) {
  return (request: FastifyRequest, callback: (error: Error | null, options?: FastifyCorsOptions) => void): void => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    const allowed = isAllowedOrigin(origin, {
      listed,
      self: request.host ? `${request.protocol}://${request.host}` : null,
      publicUrl: getPublicUrl(),
      localUrl: getConfigValue(LOCAL_URL_KEY) ?? null,
    });
    callback(null, { origin: allowed, credentials: true });
  };
}
