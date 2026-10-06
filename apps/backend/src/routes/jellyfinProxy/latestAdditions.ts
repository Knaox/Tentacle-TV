import type { FastifyReply, FastifyRequest } from "fastify";
import { fetch as undiciFetch } from "undici";
import { getJellyfinApiKey } from "../../services/configStore";
import { cacheGeneration, getCached, setCached } from "../../services/jellyfinCache";
import { getJellyfinDispatcher } from "../../services/jellyfinHttpAgent";
import {
  LATEST_SCAN_PAGE,
  LATEST_SCAN_PAGES,
  latestDetailsPath,
  latestScanPath,
  type LatestRequest,
} from "../../latestAdditions/latestRequest";
import { latestCardIds, planLatestCards, type LatestCard, type ScannedAddition } from "../../latestAdditions/latestGrouping";
import { assembleLatestItems, latestResponseBody, type JellyfinItem } from "../../latestAdditions/latestAssembly";
import { replyFromCache } from "./bufferedReply";
import { requestSignal } from "./clientAbort";
import { scrubAdminKey } from "./scrubAdminKey";

/**
 * La rangée « Derniers ajouts », regroupée par série ICI, dans le proxy que
 * tous les clients traversent — web, bureau, mobile, téléviseurs, webOS, les
 * applications déjà installées comprises : une seule règle
 * (`latestAdditions/latestGrouping`), et aucun client à mettre à jour pour
 * qu'elle s'applique.
 *
 * Deux requêtes chez Jellyfin au lieu d'une dans le cas courant : l'inventaire
 * des ajouts récents (champs minimaux), puis les cartes elles-mêmes, en un
 * appel, avec ce que le client avait demandé. L'inventaire ne lit une page de
 * plus que s'il manque des cartes, quatre au plus (cf. `LATEST_SCAN_PAGE`). Le
 * client reçoit une vingtaine de cartes au lieu d'une centaine d'épisodes. La réponse est gardée comme
 * celles des autres rangées (30 s, clé par jeton), et les mêmes évènements
 * l'invalident (ajouts, vu, favoris : `Users/{id}/Items`, cf. jellyfinCache).
 *
 * Le moindre accroc chez Jellyfin (refus, délai, réponse illisible) rend la
 * main au relais ordinaire : la requête d'origine part telle quelle, et le
 * client regroupe lui-même comme avant. Rien ne se perd, pas même un 401.
 */

/** Comme `Items/Latest` : de la fraîcheur, les appels simultanés dédoublonnés. */
const LATEST_TTL_MS = 30_000;
const LATEST_TIMEOUT_MS = 30_000;
const JSON_TYPE = "application/json; charset=utf-8";

export interface LatestContext {
  jellyfinUrl: string;
  /** Les en-têtes relayés : l'`Authorization` effective (jeton du client, ou clé d'API). */
  headers: Record<string, string>;
  /** Le jeton du client — la clé du cache, comme pour les autres rangées. */
  token: string | undefined;
  /** Le chemin et la query du CLIENT : la clé du cache, celle que les invalidations visent. */
  path: string;
  queryString: string;
}

/** Les `Items` d'une réponse `/Items`, ou `null` si Jellyfin ne les a pas rendus. */
async function readItems(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<unknown[] | null> {
  const response = await undiciFetch(url, { headers, signal, dispatcher: getJellyfinDispatcher() });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const body = (await response.json()) as { Items?: unknown } | null;
  return Array.isArray(body?.Items) ? body.Items : null;
}

/**
 * Les cartes de la rangée, page d'inventaire après page : on s'arrête dès que
 * la rangée est pleine, ou que la bibliothèque est épuisée, ou à la quatrième
 * page. `null` si la PREMIÈRE page manque ; une page suivante qui manque laisse
 * la rangée à ce qu'elle a trouvé.
 */
async function scanLatest(latest: LatestRequest, ctx: LatestContext, signal: AbortSignal): Promise<LatestCard[] | null> {
  const scanned: ScannedAddition[] = [];
  let plan: LatestCard[] = [];
  for (let page = 0; page < LATEST_SCAN_PAGES; page++) {
    const items = await readItems(`${ctx.jellyfinUrl}/${latestScanPath(latest, page * LATEST_SCAN_PAGE)}`, ctx.headers, signal);
    if (!items) return page === 0 ? null : plan;
    scanned.push(...(items as ScannedAddition[]));
    plan = planLatestCards(scanned, latest.cards);
    if (plan.length >= latest.cards || items.length < LATEST_SCAN_PAGE) break;
  }
  return plan;
}

/**
 * Sert la rangée regroupée. `false` : le relais ordinaire reprend la requête
 * — rien n'a encore été écrit au client.
 */
export async function serveLatestAdditions(
  request: FastifyRequest,
  reply: FastifyReply,
  latest: LatestRequest,
  ctx: LatestContext,
): Promise<boolean> {
  const cached = getCached(ctx.path, ctx.queryString, ctx.token);
  if (cached) {
    replyFromCache(reply, cached);
    return true;
  }

  // Un geste qui passe pendant le parcours périme la rangée (cf. jellyfinCache).
  const since = cacheGeneration();
  const signal = requestSignal(request, reply, LATEST_TIMEOUT_MS);
  try {
    const plan = await scanLatest(latest, ctx, signal);
    if (!plan) return false;
    const ids = latestCardIds(plan);
    const details = ids.length > 0
      ? await readItems(`${ctx.jellyfinUrl}/${latestDetailsPath(latest, ids)}`, ctx.headers, signal)
      : [];
    if (!details) return false;

    // Le filet des réponses gardées en cache (cf. sendBuffered) : aucune carte
    // n'est censée porter la clé admin ; si l'une s'y met, elle part nettoyée.
    const raw = latestResponseBody(assembleLatestItems(plan, details as JellyfinItem[]));
    const { body, replacements } = scrubAdminKey(raw, getJellyfinApiKey(), ctx.token);
    if (replacements > 0) request.log.warn({ path: ctx.path, replacements }, "cle admin retiree des derniers ajouts");
    const buffer = Buffer.from(body, "utf8");
    setCached(ctx.path, ctx.queryString, ctx.token, buffer, JSON_TYPE, 200, LATEST_TTL_MS, since);
    reply.status(200).header("content-type", JSON_TYPE).header("cache-control", "no-store").header("x-tentacle-cache", "MISS");
    reply.send(buffer);
    return true;
  } catch (err) {
    // Le client est parti : personne à servir, ni par ici ni par le relais.
    if (request.raw.destroyed) return true;
    request.log.warn({ path: ctx.path, err: err instanceof Error ? err.message : String(err) }, "derniers ajouts : relais ordinaire");
    return false;
  }
}
