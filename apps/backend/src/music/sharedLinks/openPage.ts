/**
 * Octave — la page d'OUVERTURE d'un lien (`/octave/open/<page>`, capacité `music.sharedLinks`) : celle qu'on
 * envoie à quelqu'un pour une playlist partagée entre comptes du serveur. Servie interface web ouverte ou coupée,
 * SANS script, sous une politique de sécurité stricte, jamais en cache ni indexée. Elle ne dit RIEN de ce qu'elle
 * ouvre (pas de session ici) : l'app, ou le client web, vérifie le droit en ouvrant la page.
 *
 * Liens universels / App Links : impossibles pour un serveur auto-hébergé (domaine propre à chacun) — d'où
 * « Ouvrir dans l'app Tentacle » par le schéma `tentacle://`, que le mobile et le bureau déclarent au système.
 */

import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { invitePageLang } from "../../static/invitePageText";
import { isWebUiEnabled } from "../../static/webUi";
import { CSS, escapeHtml } from "../playlistShare/sharePageHtml";
import { musicSharePageCsp } from "../playlistShare/sharePage";
import { OCTAVE_OPEN_PAGE_TEXT, type OpenPageKind } from "./openPageText";

const PAGE = /^\/(playlist|album|artist|mix)\/([^/?#]{1,200})$/;
const EXTRA_CSS = `.primary{display:flex;margin-top:18px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff}
.app{display:flex}`;

/** La page admise et la route Octave qu'elle ouvre (miroir de `octaveOpenLink.ts`, shared) ; sinon `null`. */
export function openPageTarget(rest: string, q: string | undefined): { kind: OpenPageKind; route: string } | null {
  const page = rest.replace(/\/+$/, "");
  if (page === "/search") {
    const query = (q ?? "").trim().slice(0, 4096);
    return query ? { kind: "search", route: `/octave/search?q=${encodeURIComponent(query)}` } : null;
  }
  const match = PAGE.exec(page);
  if (!match) return null;
  // Rendu tel que reçu (déjà encodé) : jamais décodé puis réécrit dans une adresse.
  return { kind: match[1] as OpenPageKind, route: `/octave/${match[1]}/${match[2]}` };
}

export function octaveOpenPageHtml(input: { lang: "fr" | "en"; kind: OpenPageKind; route: string; path: string; prefix: string; webUi: boolean; nonce: string }): string {
  const t = OCTAVE_OPEN_PAGE_TEXT[input.lang];
  const e = escapeHtml;
  const other = input.lang === "fr" ? "en" : "fr";
  const app = `tentacle://octave${input.route.slice("/octave".length)}`;
  return `<!doctype html>
<html lang="${input.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${e(t.title[input.kind])}</title>
<style nonce="${input.nonce}">${CSS}${EXTRA_CSS}</style></head>
<body>
<div class="top"><img class="brand" src="/tentacle-logo-pirate.svg" alt="" width="40" height="40">
<a class="lang" href="${e(`${input.path}?lang=${other}`)}" hreflang="${other}" lang="${other}">${e(t.otherLang)}</a></div>
<main><section class="state" aria-labelledby="t">
<p class="kicker">${e(t.kicker)}</p>
<h1 id="t">${e(t.title[input.kind])}</h1>
<p>${e(t.lead)}</p>
<a class="app primary" href="${e(app)}">${e(t.openApp)}</a>
${input.webUi ? `<a class="app" href="${e(`${input.prefix}${input.route}`)}">${e(t.openBrowser)}</a>` : ""}
<p>${e(t.phone)}</p>
</section></main>
<p class="foot">${e(t.getApp)} <a href="https://tentacletv.app" target="_blank" rel="noopener noreferrer">${e(t.getAppLink)}</a></p>
</body></html>`;
}

export function sendOctaveOpenPage(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const query = (request.query ?? {}) as Record<string, unknown>;
  const path = request.url.split("?")[0]!;
  const at = path.indexOf("/octave/open/");
  const target = at >= 0 ? openPageTarget(path.slice(at + "/octave/open".length), typeof query.q === "string" ? query.q : undefined) : null;
  const nonce = randomBytes(16).toString("base64");
  reply
    .header("content-security-policy", musicSharePageCsp(nonce))
    .header("cache-control", "no-store")
    .header("x-robots-tag", "noindex, nofollow")
    .header("referrer-policy", "no-referrer");
  if (!target) return reply.status(404).type("text/plain; charset=utf-8").send("Not found");
  const lang = invitePageLang(request.headers["accept-language"], query.lang);
  const html = octaveOpenPageHtml({ lang, kind: target.kind, route: target.route, path, prefix: path.slice(0, at), webUi: isWebUiEnabled(), nonce });
  return reply.status(200).type("text/html; charset=utf-8").send(html);
}
