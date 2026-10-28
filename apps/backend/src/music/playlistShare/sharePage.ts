/**
 * Octave — la page d'un lien de playlist partagée (`/octave/share/<jeton>`), servie par le serveur, interface
 * web ouverte ou coupée : sans script, sous une politique de sécurité stricte, jamais en cache ni indexée.
 * « Importer dans mon Tentacle » envoie l'adresse tapée à CE serveur, qui renvoie (302) vers la page d'import
 * d'Octave de CE Tentacle-là (`/octave/import?share=<lien>`) — un chemin fixe, jamais une adresse choisie
 * par un tiers : rien d'autre que l'origine tapée par le visiteur ne vient de la requête.
 */

import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { invitePageLang } from "../../static/invitePageText";
import { isShareToken } from "../contract/musicShare";
import { loadShareDocument } from "./shareDocument";
import { musicSharePageHtml } from "./sharePageHtml";

/** La page d'import d'Octave d'un serveur Tentacle (route du web, `apps/web/src/music/octave`). */
export const OCTAVE_IMPORT_PATH = "/octave/import";

/**
 * L'adresse tapée par le visiteur → la page d'import de SON Tentacle, avec le lien ; `null` si ce n'est pas
 * l'adresse d'un serveur. « mon-serveur.fr » vaut « https://mon-serveur.fr » ; un préfixe de chemin est gardé.
 */
export function importTargetUrl(typed: string | undefined, link: string): string | null {
  const raw = (typed ?? "").trim();
  if (!raw || raw.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname || url.username || url.password) return null;
  const prefix = url.pathname.replace(/\/+$/, "").replace(/\/octave(?:\/.*)?$/, "");
  return `${url.origin}${prefix}${OCTAVE_IMPORT_PATH}?share=${encodeURIComponent(link)}`;
}

export function musicSharePageCsp(nonce: string): string {
  return ["default-src 'none'", `style-src 'nonce-${nonce}'`, "img-src 'self'", "form-action 'self'", "base-uri 'none'", "frame-ancestors 'none'"].join("; ");
}

function pageParts(request: FastifyRequest, token: string) {
  const path = request.url.split("?")[0]!.replace(/\/import$/, "");
  const query = (request.query ?? {}) as Record<string, unknown>;
  return { path, link: `${request.protocol}://${request.host}${path}`, lang: invitePageLang(request.headers["accept-language"], query.lang), token };
}

async function render(request: FastifyRequest, reply: FastifyReply, token: string, badServer = false) {
  const { path, link, lang } = pageParts(request, token);
  const result = isShareToken(token) ? await loadShareDocument(token).catch(() => null) : null;
  const document = result?.ok ? result.document : null;
  const nonce = randomBytes(16).toString("base64");
  return reply
    .status(document ? (badServer ? 400 : 200) : 404)
    .header("content-security-policy", musicSharePageCsp(nonce))
    .header("cache-control", "no-store")
    .header("x-robots-tag", "noindex, nofollow")
    .header("referrer-policy", "no-referrer")
    .type("text/html; charset=utf-8")
    .send(musicSharePageHtml({ lang, document, path, link, nonce, badServer }));
}

export function sendMusicSharePage(request: FastifyRequest, reply: FastifyReply, token: string) {
  return render(request, reply, token);
}

export async function sendShareImportRedirect(request: FastifyRequest, reply: FastifyReply, token: string, server: string | undefined) {
  if (!isShareToken(token)) return render(request, reply, token);
  const { link } = pageParts(request, token);
  const target = importTargetUrl(server, link);
  if (!target) return render(request, reply, token, true);
  return reply.header("cache-control", "no-store").header("referrer-policy", "no-referrer").redirect(target, 302);
}
