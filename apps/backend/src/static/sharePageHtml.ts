import { SHARE_PAGE_TEXT, fill, type SharePageLang } from "./sharePageText";

/**
 * Le HTML de la page de partage autonome (`sharePage.ts`) — rendu par le
 * serveur, AUCUN script : la liste arrive écrite, les affiches sont des
 * images du serveur (`/api/jellyfin/…/Images`, sans jeton ni adresse de
 * Jellyfin) ou de TMDB pour un titre hors bibliothèque. Même habit que la
 * page d'invitation : sombre, violet → rose en touches.
 */

export interface SharePageItem {
  name: string;
  year: number | null;
  type: "movie" | "series";
  /** Une adresse déjà sûre (chemin du serveur ou image TMDB), ou rien. */
  poster: string | null;
}

export type SharePageView =
  | { state: "list"; kind: "watchlist" | "likes"; owner: string; items: SharePageItem[] }
  | { state: "not_found" | "unavailable" | "error" | "stats" };

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;padding:16px;
background:radial-gradient(80% 60% at 12% 0%,rgba(139,92,246,.22) 0%,rgba(139,92,246,.05) 45%,transparent 72%) no-repeat,
radial-gradient(60% 55% at 100% 100%,rgba(236,72,153,.14) 0%,transparent 70%) no-repeat,#0b0a12;
color:#f4f2fa;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.top{width:100%;max-width:72rem;display:flex;align-items:center;justify-content:space-between}
.brand{display:block;width:40px;height:40px}
.lang{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:10px;color:rgba(244,242,250,.72);font-size:14px;text-decoration:none}
.lang:hover{color:#f4f2fa}
main{width:100%;max-width:72rem;padding:16px 0 24px;flex:1}
h1{font-size:28px;font-weight:700;line-height:1.2;letter-spacing:-.01em}
.lead{margin-top:6px;color:rgba(244,242,250,.72);font-size:15px}
.count{display:inline-block;margin-top:12px;padding:4px 12px;border-radius:999px;background:rgba(139,92,246,.16);border:1px solid rgba(167,139,250,.4);color:#c4b5fd;font-size:13px;font-weight:600}
ul{list-style:none;margin-top:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:20px 16px}
.poster{position:relative;aspect-ratio:2/3;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}
.poster img{display:block;width:100%;height:100%;object-fit:cover}
.poster span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;color:rgba(244,242,250,.6);font-size:13px}
.name{margin-top:8px;font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.meta{margin-top:2px;font-size:13px;color:rgba(244,242,250,.6)}
.state{max-width:28rem;margin:12vh auto 0;text-align:center}
.state p{margin-top:10px;color:rgba(244,242,250,.72)}
.retry{display:inline-flex;align-items:center;min-height:48px;margin-top:24px;padding:0 24px;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;font-weight:700;text-decoration:none}
a:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
.foot{margin-top:24px;text-align:center;font-size:14px;color:rgba(244,242,250,.72)}
.foot a{color:#c4b5fd}
@media (min-width:640px){ul{grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:24px 20px}h1{font-size:34px}}
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function listBody(lang: SharePageLang, view: Extract<SharePageView, { state: "list" }>): string {
  const t = SHARE_PAGE_TEXT[lang];
  const e = escapeHtml;
  const name = view.owner;
  const title = fill(view.kind === "likes" ? t.likesTitle : t.watchlistTitle, { name });
  if (view.items.length === 0) {
    return `<section class="state" aria-labelledby="t"><h1 id="t">${e(t.emptyTitle)}</h1><p>${e(fill(t.emptyLead, { name }))}</p></section>`;
  }
  const count = view.items.length === 1 ? t.countOne : fill(t.countOther, { count: view.items.length });
  const cards = view.items.map((item) => {
    const kind = item.type === "series" ? t.series : t.movie;
    const meta = item.year ? `${kind} · ${item.year}` : kind;
    const art = item.poster
      ? `<img src="${e(item.poster)}" alt="" loading="lazy" decoding="async" width="300" height="450">`
      : `<span>${e(item.name)}</span>`;
    return `<li><div class="poster">${art}</div><p class="name">${e(item.name)}</p><p class="meta">${e(meta)}</p></li>`;
  });
  return `<h1 id="t">${e(title)}</h1>
<p class="lead">${e(fill(view.kind === "likes" ? t.likesLead : t.watchlistLead, { name }))}</p>
<p class="count">${e(count)}</p>
<ul aria-labelledby="t">${cards.join("")}</ul>`;
}

function stateBody(lang: SharePageLang, state: "not_found" | "unavailable" | "error" | "stats", selfHref: string): string {
  const t = SHARE_PAGE_TEXT[lang];
  const e = escapeHtml;
  const [title, lead] = {
    not_found: [t.notFoundTitle, t.notFoundLead],
    unavailable: [t.unavailableTitle, t.unavailableLead],
    error: [t.errorTitle, t.errorLead],
    stats: [t.statsTitle, t.statsLead],
  }[state];
  const retry = state === "error" || state === "unavailable" ? `<a class="retry" href="${e(selfHref)}">${e(t.retry)}</a>` : "";
  return `<section class="state" aria-labelledby="t"><h1 id="t">${e(title)}</h1><p>${e(lead)}</p>${retry}</section>`;
}

/** La page entière. `path` : son adresse, sans requête (le lien de langue et « Réessayer » y mènent). */
export function sharePageHtml({ lang, view, path, nonce }: { lang: SharePageLang; view: SharePageView; path: string; nonce: string }): string {
  const t = SHARE_PAGE_TEXT[lang];
  const e = escapeHtml;
  const other: SharePageLang = lang === "fr" ? "en" : "fr";
  const selfHref = `${path}?lang=${lang}`;
  const title = view.state === "list"
    ? fill(view.kind === "likes" ? t.likesTitle : t.watchlistTitle, { name: view.owner })
    : stateTitle(lang, view.state);
  const body = view.state === "list" ? listBody(lang, view) : stateBody(lang, view.state, selfHref);
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${e(title)}</title>
<style nonce="${nonce}">${CSS}</style></head>
<body>
<div class="top"><img class="brand" src="/tentacle-logo-pirate.svg" alt="" width="40" height="40">
<a class="lang" href="${e(`${path}?lang=${other}`)}" hreflang="${other}" lang="${other}">${e(t.otherLang)}</a></div>
<main>${body}</main>
<p class="foot">${e(t.getApp)} <a href="https://tentacletv.app" target="_blank" rel="noopener noreferrer">${e(t.getAppLink)}</a></p>
</body></html>`;
}

function stateTitle(lang: SharePageLang, state: "not_found" | "unavailable" | "error" | "stats"): string {
  const t = SHARE_PAGE_TEXT[lang];
  return { not_found: t.notFoundTitle, unavailable: t.unavailableTitle, error: t.errorTitle, stats: t.statsTitle }[state];
}
