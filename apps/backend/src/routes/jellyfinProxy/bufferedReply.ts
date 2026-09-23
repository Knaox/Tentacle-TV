import type { FastifyReply, FastifyRequest } from "fastify";
import type { Response } from "undici";
import { getJellyfinApiKey } from "../../services/configStore";
import { setCached } from "../../services/jellyfinCache";
import { isLibraryViewsPath, keepSupportedLibraries } from "./libraryViews";
import { scrubAdminKey } from "./scrubAdminKey";

/**
 * Les réponses que le proxy lit EN ENTIER avant de les rendre : celles qu'il
 * met en cache (Latest, Resume, NextUp, Views) — une fois en mémoire, elles
 * sont rangées pour le prochain appel, qui repartira sans toucher Jellyfin —
 * et la liste des bibliothèques, qu'il trie (cf. `libraryViews`).
 */

/**
 * La liste des bibliothèques est lue en entier même si elle sortait un jour
 * du cache : son tri ne doit pas dépendre d'un réglage de performance.
 */
export function readsInFull(path: string, cacheTtl: number | null): boolean {
  return cacheTtl !== null || isLibraryViewsPath(path);
}

export interface BufferedReplyContext {
  path: string;
  queryString: string;
  token: string | undefined;
  /** `null` : la réponse n'est pas mise en cache. */
  ttlMs: number | null;
}

export async function sendBuffered(
  request: FastifyRequest,
  reply: FastifyReply,
  response: Response,
  ctx: BufferedReplyContext,
): Promise<FastifyReply> {
  const arrayBuf = await response.arrayBuffer();
  // FILET. Ces corps sont déjà en mémoire : les relire ne coûte rien, et
  // aucune route de catalogue n'est censée porter la clé admin. Si l'une
  // s'y met un jour, elle est nettoyée ici et la trace le dit — plutôt que
  // de fuir en silence jusqu'au prochain audit. Le cache est clé PAR
  // JETON, donc y ranger un corps portant le jeton du demandeur est
  // cohérent : personne d'autre ne le relira.
  const raw = Buffer.from(arrayBuf).toString("utf8");
  const { body, replacements } = scrubAdminKey(raw, getJellyfinApiKey(), ctx.token);
  if (replacements > 0) {
    request.log.warn(
      { path: ctx.path, replacements },
      "cle admin retiree d'une reponse mise en cache",
    );
  }
  const scrubbed = replacements > 0 ? Buffer.from(body, "utf8") : Buffer.from(arrayBuf);
  // Films et séries seulement, et AVANT le cache : une réponse resservie
  // rendrait sinon la liste complète.
  const buf = isLibraryViewsPath(ctx.path) ? keepSupportedLibraries(scrubbed) : scrubbed;
  if (ctx.ttlMs !== null) {
    const contentType = response.headers.get("content-type") ?? "application/json";
    setCached(ctx.path, ctx.queryString, ctx.token, buf, contentType, response.status, ctx.ttlMs);
    reply.header("x-tentacle-cache", "MISS");
  }
  return reply.send(buf);
}
