import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../services/db";
import { mayShareInPublic } from "../services/share/publicSharingRight";
import { sharedListEntries, type SharedListEntry } from "../services/shareLists";
import { normalizeShareToken } from "../services/shareToken";
import { invitePageLang } from "./invitePageText";
import { sharePageHtml, type SharePageItem, type SharePageView } from "./sharePageHtml";

/**
 * La page de partage AUTONOME du serveur : là où mène un lien de Ma liste ou
 * des favoris (`/share/<jeton>`) quand l'interface web est coupée
 * (`TENTACLE_WEB_UI=off`). Sans elle, ce lien — créé depuis le bureau ou le
 * web d'un autre jour — tombait sur un 404. Interface web allumée, rien ne
 * change : le client web garde sa page de partage, plus riche.
 *
 * Mêmes règles que `GET /api/share/:token` (routes/share.ts) : titres lus au
 * nom du PROPRIÉTAIRE, dans ses restrictions ; sans son droit « Partage
 * public », « lien indisponible » (statistiques comprises). Rendue par le serveur, sans script, sous
 * une politique de sécurité stricte ; jamais en cache ni indexée.
 */
export const SHARE_PAGE_PREFIX = "/share/";

/** `/share/<jeton>` ou `/share/<jeton>/<titre>` (la fiche du web) → le jeton ; sinon rien. */
export function sharePageToken(path: string): string | null {
  if (!path.startsWith(SHARE_PAGE_PREFIX)) return null;
  const [token, item, ...rest] = path.slice(SHARE_PAGE_PREFIX.length).split("/");
  if (rest.length > 0 || (item !== undefined && !/^[0-9a-fA-F-]{1,64}$/.test(item))) return null;
  return token && /^[A-Za-z0-9_-]{1,128}$/.test(token) ? normalizeShareToken(token) : null;
}

const TMDB_POSTER = /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/[A-Za-z0-9_.-]+$/;

/** L'affiche d'un titre : celle du serveur (sans jeton), ou celle de TMDB si l'adresse en a la forme exacte. */
export function posterOf(entry: SharedListEntry): string | null {
  if (entry.Id) {
    if (!/^[0-9a-fA-F-]{32,36}$/.test(entry.Id)) return null;
    const tag = entry.ImageTags?.Primary;
    const tagParam = tag && /^[A-Za-z0-9]+$/.test(tag) ? `&tag=${tag}` : "";
    return `/api/jellyfin/Items/${entry.Id}/Images/Primary?fillHeight=450&quality=90${tagParam}`;
  }
  return entry.PosterUrl && TMDB_POSTER.test(entry.PosterUrl) ? entry.PosterUrl : null;
}

function toItem(entry: SharedListEntry): SharePageItem {
  return {
    name: entry.Name,
    year: typeof entry.ProductionYear === "number" ? entry.ProductionYear : null,
    type: entry.Type === "Series" ? "series" : "movie",
    poster: posterOf(entry),
  };
}

/** Ce que la page montre pour ce jeton — jamais une exception. */
export async function loadSharePage(token: string): Promise<SharePageView> {
  let link: { kind: string; ownerUserId: string; ownerUsername: string } | null;
  try {
    link = await getPrisma().shareLink.findUnique({ where: { token }, select: { kind: true, ownerUserId: true, ownerUsername: true } });
  } catch {
    return { state: "error" };
  }
  if (!link) return { state: "not_found" };
  if (!(await mayShareInPublic(link.ownerUserId))) return { state: "unavailable" };
  if (link.kind === "stats") return { state: "stats" };
  if (link.kind !== "watchlist" && link.kind !== "likes") return { state: "not_found" };
  try {
    const entries = await sharedListEntries(link.kind, link.ownerUserId);
    return { state: "list", kind: link.kind, owner: link.ownerUsername, items: entries.map(toItem) };
  } catch {
    return { state: "error" };
  }
}

/** Aucun script : un style (nonce), le logo et les affiches du serveur, les affiches de TMDB. */
export function sharePageCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    "img-src 'self' https://image.tmdb.org",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const STATUS: Record<SharePageView["state"], number> = { list: 200, stats: 200, not_found: 404, unavailable: 403, error: 502 };

/** La réponse entière, dans la langue du navigateur (ou `?lang=`). */
export async function sendSharePage(request: FastifyRequest, reply: FastifyReply, token: string) {
  const query = (request.query ?? {}) as Record<string, unknown>;
  const path = request.url.split("?")[0];
  const view = await loadSharePage(token);
  const nonce = randomBytes(16).toString("base64");
  return reply
    .status(STATUS[view.state])
    .header("content-security-policy", sharePageCsp(nonce))
    .header("cache-control", "no-store")
    .header("x-robots-tag", "noindex, nofollow")
    .header("referrer-policy", "no-referrer")
    .type("text/html; charset=utf-8")
    .send(sharePageHtml({ lang: invitePageLang(request.headers["accept-language"], query.lang), view, path, nonce }));
}
