/**
 * Le HTML de la page d'un lien de playlist (`/octave/share/<jeton>`) — rendu par le serveur, AUCUN script :
 * le nom, le compte qui partage, les premiers titres (texte seul), et l'import : l'adresse de SON Tentacle
 * (formulaire vers ce serveur, qui renvoie là-bas), ou l'app mobile par son schéma. Même habit que la page
 * de partage de Ma liste.
 */

import { fill } from "../../static/sharePageText";
import type { SharedMusicPlaylist } from "../contract/musicShare";
import { MUSIC_SHARE_PAGE_TEXT, type MusicSharePageLang } from "./sharePageText";

export const SHOWN_TRACKS = 50;

export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;padding:16px;
background:radial-gradient(80% 60% at 12% 0%,rgba(139,92,246,.22) 0%,rgba(139,92,246,.05) 45%,transparent 72%) no-repeat,
radial-gradient(60% 55% at 100% 100%,rgba(236,72,153,.14) 0%,transparent 70%) no-repeat,#0b0a12;
color:#f4f2fa;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.top{width:100%;max-width:44rem;display:flex;align-items:center;justify-content:space-between}
.brand{display:block;width:40px;height:40px}
.lang{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:10px;color:rgba(244,242,250,.72);font-size:14px;text-decoration:none}
main{width:100%;max-width:44rem;padding:16px 0 24px;flex:1}
.kicker{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#c4b5fd}
h1{margin-top:4px;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-.01em;overflow-wrap:anywhere}
.lead{margin-top:6px;color:rgba(244,242,250,.72);font-size:15px}
.desc{margin-top:10px;color:rgba(244,242,250,.8);font-size:15px;white-space:pre-line}
.box{margin-top:24px;padding:20px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10)}
.box h2{font-size:18px;font-weight:700}
.box p{margin-top:6px;font-size:14px;color:rgba(244,242,250,.72)}
label{display:block;margin-top:16px;font-size:14px;font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
input{flex:1 1 16rem;min-height:48px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#f4f2fa;font-size:16px}
button,.app{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;border:0;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}
button{background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff}
.app{margin-top:14px;background:rgba(255,255,255,.08);color:#f4f2fa;border:1px solid rgba(255,255,255,.16)}
.error{margin-top:10px;color:#fda4af;font-size:14px}
ol{list-style:none;margin-top:24px;border-top:1px solid rgba(255,255,255,.08)}
li{display:flex;gap:12px;align-items:baseline;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,.08)}
.n{min-width:2ch;text-align:right;color:rgba(244,242,250,.45);font-size:13px;font-variant-numeric:tabular-nums}
.t{font-weight:600;overflow-wrap:anywhere}
.a{font-size:14px;color:rgba(244,242,250,.6);overflow-wrap:anywhere}
.more{margin-top:12px;font-size:14px;color:rgba(244,242,250,.6)}
.state{max-width:28rem;margin:12vh auto 0;text-align:center}
.state p{margin-top:10px;color:rgba(244,242,250,.72)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
.foot{margin-top:24px;text-align:center;font-size:14px;color:rgba(244,242,250,.72)}
.foot a{color:#c4b5fd}
`;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface MusicSharePageInput {
  lang: MusicSharePageLang;
  /** `null` : lien révoqué, inconnu, ou partage fermé (un seul état, qui ne trahit rien). */
  document: SharedMusicPlaylist | null;
  /** L'adresse de la page, sans requête. */
  path: string;
  /** Le lien lui-même (adresse complète), donné à l'app. */
  link: string;
  nonce: string;
  /** L'adresse tapée n'était pas celle d'un serveur. */
  badServer?: boolean;
}

function playlistBody(input: MusicSharePageInput, doc: SharedMusicPlaylist): string {
  const t = MUSIC_SHARE_PAGE_TEXT[input.lang];
  const e = escapeHtml;
  const count = doc.total === 1 ? t.countOne : fill(t.countOther, { count: doc.total });
  const by = doc.ownerName ? `${e(fill(t.by, { name: doc.ownerName }))} · ` : "";
  const rows = doc.tracks.slice(0, SHOWN_TRACKS).map((track, index) => {
    const artists = track.artists.join(", ");
    return `<li><span class="n">${index + 1}</span><span><span class="t">${e(track.title)}</span>${artists ? `<br><span class="a">${e(artists)}</span>` : ""}</span></li>`;
  });
  const rest = doc.total - Math.min(doc.tracks.length, SHOWN_TRACKS);
  const app = `tentacle://octave/import?share=${encodeURIComponent(input.link)}`;
  return `<p class="kicker">${e(t.kicker)}</p>
<h1 id="t">${e(doc.name)}</h1>
<p class="lead">${by}${e(count)}</p>
${doc.description ? `<p class="desc">${e(doc.description)}</p>` : ""}
<section class="box" aria-labelledby="i">
<h2 id="i">${e(t.importTitle)}</h2>
<p>${e(t.importLead)}</p>
<form method="get" action="${e(`${input.path}/import`)}">
<label for="server">${e(t.serverLabel)}</label>
<div class="row"><input id="server" name="server" type="url" inputmode="url" autocomplete="url" required placeholder="${e(t.serverPlaceholder)}"${input.badServer ? ' aria-invalid="true" aria-describedby="bad"' : ""}>
<button type="submit">${e(t.importButton)}</button></div>
${input.badServer ? `<p class="error" id="bad">${e(t.badServer)}</p>` : ""}
</form>
<a class="app" href="${e(app)}">${e(t.openApp)}</a>
<p>${e(t.paste)}</p>
</section>
<ol aria-labelledby="t">${rows.join("")}</ol>
${rest > 0 ? `<p class="more">${e(fill(t.more, { count: rest }))}</p>` : ""}`;
}

export function musicSharePageHtml(input: MusicSharePageInput): string {
  const t = MUSIC_SHARE_PAGE_TEXT[input.lang];
  const e = escapeHtml;
  const other: MusicSharePageLang = input.lang === "fr" ? "en" : "fr";
  const doc = input.document;
  const body = doc
    ? playlistBody(input, doc)
    : `<section class="state" aria-labelledby="t"><h1 id="t">${e(t.unavailableTitle)}</h1><p>${e(t.unavailableLead)}</p></section>`;
  return `<!doctype html>
<html lang="${input.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${e(doc ? doc.name : t.unavailableTitle)}</title>
<style nonce="${input.nonce}">${CSS}</style></head>
<body>
<div class="top"><img class="brand" src="/tentacle-logo-pirate.svg" alt="" width="40" height="40">
<a class="lang" href="${e(`${input.path}?lang=${other}`)}" hreflang="${other}" lang="${other}">${e(t.otherLang)}</a></div>
<main>${body}</main>
<p class="foot">${e(t.getApp)} <a href="https://tentacletv.app" target="_blank" rel="noopener noreferrer">${e(t.getAppLink)}</a></p>
</body></html>`;
}
