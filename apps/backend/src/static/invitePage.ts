import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { INVITE_PAGE_TEXT, invitePageLang, type InvitePageLang } from "./invitePageText";

/**
 * La page d'invitation AUTONOME du serveur : là où mène le lien d'invitation
 * (`/register?invite=…`) quand l'interface web est coupée (`TENTACLE_WEB_UI=off`).
 * Sans elle, ce lien — créé depuis le bureau ou le mobile — tombait sur un 404 :
 * l'invité ne pouvait pas créer son compte. Interface web allumée, rien ne
 * change : le client web garde sa page d'inscription.
 *
 * Elle ne montre RIEN du client web : un formulaire (clé, nom, mot de passe)
 * qui parle à `POST /api/auth/register`, chaque refus dit par son `code`, puis
 * « connectez-vous dans l'application », avec l'adresse de ce serveur. Tout est
 * dans la page (aucun fichier à servir hors le logo public), en ES5 ; scripts et
 * styles portent un nonce, sous une politique de sécurité stricte.
 */
export const INVITE_PAGE_PATH = "/register";

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;padding:16px;
background:radial-gradient(80% 60% at 12% 0%,rgba(139,92,246,.22) 0%,rgba(139,92,246,.05) 45%,transparent 72%) no-repeat,
radial-gradient(60% 55% at 100% 100%,rgba(236,72,153,.14) 0%,transparent 70%) no-repeat,#0b0a12;
color:#f4f2fa;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.top{width:100%;max-width:26rem;display:flex;justify-content:flex-end}
.lang{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:10px;color:rgba(244,242,250,.72);font-size:14px;text-decoration:none}
.lang:hover{color:#f4f2fa}
main{width:100%;max-width:26rem;margin:auto 0;padding:8px 0 24px}
.brand{display:block;width:56px;height:56px;margin:0 auto 16px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:24px;padding:28px 24px}
h1{font-size:24px;font-weight:700;line-height:1.25;text-align:center}
h1:focus{outline:none}
.sub{margin-top:6px;text-align:center;color:rgba(244,242,250,.72);font-size:15px}
form{margin-top:24px}
.field+.field{margin-top:16px}
label,.lbl{display:block;margin-bottom:6px;font-size:14px;font-weight:600}
.pw{position:relative}
input{width:100%;height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(11,10,18,.6);color:#f4f2fa;font:inherit;font-size:16px}
.key{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.03em}
input:focus{outline:none;border-color:#a78bfa;box-shadow:0 0 0 3px rgba(167,139,250,.35)}
input[aria-invalid=true]{border-color:#fca5a5}
.pw input{padding-right:52px}
.eye{position:absolute;top:2px;right:2px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:0;border-radius:10px;background:transparent;color:rgba(244,242,250,.72);cursor:pointer}
.eye:hover{color:#f4f2fa}
.hint{margin-top:6px;font-size:13px;color:rgba(244,242,250,.62)}
.err{margin-top:6px;font-size:14px;color:#fca5a5}
.alert{margin-top:16px;padding:12px 14px;border:1px solid rgba(252,165,165,.35);border-radius:12px;background:rgba(239,68,68,.12);color:#fecaca;font-size:14px}
.go{width:100%;height:52px;margin-top:24px;border:0;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.go:disabled{opacity:.6;cursor:default}
button:focus-visible,.lang:focus-visible,a:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
.done{margin-top:12px;text-align:center;color:rgba(244,242,250,.8)}
.addr{display:flex;gap:8px;align-items:flex-start}
.addr output{flex:1;min-width:0;padding:12px 14px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(11,10,18,.6);font:15px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;-webkit-user-select:all;user-select:all}
.addr button{min-width:88px;height:48px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.08);color:#f4f2fa;font:inherit;font-weight:600;cursor:pointer}
.foot{margin-top:20px;text-align:center;font-size:14px;color:rgba(244,242,250,.72)}
.foot a{color:#c4b5fd}
@media (prefers-reduced-motion:no-preference){input,button,.lang{transition:border-color .15s,box-shadow .15s,color .15s,opacity .15s}}
`;

/**
 * Les refus qui tiennent à un champ : leur phrase se pose sous lui, et il prend le focus.
 * Le premier champ à remplir prend le focus SANS faire défiler la page, et seulement
 * sous une souris : au doigt, le clavier couvrirait la page avant qu'on l'ait lue.
 */
const SCRIPT = `
(function(){
var T=window.__TEXT__,FIELD={invite_invalid:"k",invite_exhausted:"k",invite_expired:"k",username_taken:"u",username_invalid:"u"};
function $(id){return document.getElementById(id);}
var form=$("f"),go=$("go"),err=$("err");
go.disabled=false;
var first=$($("k").value?"u":"k");
if(window.matchMedia&&window.matchMedia("(pointer:fine)").matches){try{first.focus({preventScroll:true});}catch(_){first.focus();}}
function clear(){err.hidden=true;var ids=["k","u","c"];for(var i=0;i<ids.length;i++){$(ids[i]).removeAttribute("aria-invalid");$(ids[i]+"-err").hidden=true;}}
function fail(message,field){
if(!field){err.textContent=message;err.hidden=false;return;}
var box=$(field+"-err");box.textContent=message;box.hidden=false;$(field).setAttribute("aria-invalid","true");$(field).focus();}
$("eye").onclick=function(){var on=this.getAttribute("aria-pressed")!=="true";
this.setAttribute("aria-pressed",on?"true":"false");this.setAttribute("aria-label",on?T.hidePasswords:T.showPasswords);
$("p").type=on?"text":"password";$("c").type=on?"text":"password";$("eye-on").hidden=on;$("eye-off").hidden=!on;};
function done(){
$("a").textContent=location.protocol+"//"+location.host;$("p").value="";$("c").value="";
$("form-view").hidden=true;$("done-view").hidden=false;$("d").focus();}
form.onsubmit=function(e){
if(e&&e.preventDefault)e.preventDefault();
clear();
if($("p").value!==$("c").value){fail(T.mismatch,"c");return false;}
go.disabled=true;go.textContent=T.creating;
var x=new XMLHttpRequest();x.open("POST","/api/auth/register",true);x.setRequestHeader("Content-Type","application/json");
x.onreadystatechange=function(){if(x.readyState!==4)return;
go.disabled=false;go.textContent=T.submit;
if(x.status===201||x.status===200){done();return;}
var code=null;try{code=JSON.parse(x.responseText).code;}catch(_){}
if(code&&T.errors[code]){fail(T.errors[code],FIELD[code]);return;}
if(x.status===0){fail(T.errors.offline);return;}
if(x.status===429){fail(T.errors.too_many);return;}
fail(x.status===400?T.errors.invalid_fields:T.errors.other);};
x.send(JSON.stringify({inviteKey:$("k").value,username:$("u").value,password:$("p").value}));
return false;};
function pick(a){var r=document.createRange();r.selectNodeContents(a);var s=window.getSelection();s.removeAllRanges();s.addRange(r);}
$("cp").onclick=function(){var a=$("a"),label=$("cp-t");
function ok(){label.textContent=T.copied;setTimeout(function(){label.textContent=T.copy;},2000);}
if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(a.textContent).then(ok,function(){pick(a);});return;}
pick(a);try{if(document.execCommand("copy"))ok();}catch(_){}};
})();
`;

const EYE_ON = `<svg id="eye-on" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg id="eye-off" hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/></svg>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** La clé venue de l'URL, si elle en a la forme ; sinon rien à préremplir (jamais un texte arbitraire). */
export function inviteKeyFromQuery(raw: unknown): string {
  const key = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(key) ? key : "";
}

export function invitePageHtml({ lang, inviteKey, nonce }: { lang: InvitePageLang; inviteKey: string; nonce: string }): string {
  const t = INVITE_PAGE_TEXT[lang];
  const other: InvitePageLang = lang === "fr" ? "en" : "fr";
  const otherHref = `${INVITE_PAGE_PATH}?${inviteKey ? `invite=${encodeURIComponent(inviteKey)}&` : ""}lang=${other}`;
  // Les mots dont le script a besoin, sûrs dans une balise <script> (aucune fin de balise possible).
  const words = { submit: t.submit, creating: t.creating, mismatch: t.mismatch, showPasswords: t.showPasswords, hidePasswords: t.hidePasswords, copy: t.copy, copied: t.copied, errors: t.errors };
  const json = JSON.stringify(words).replace(/</g, "\\u003c");
  const e = escapeHtml;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>${e(t.title)}</title>
<style nonce="${nonce}">${CSS}</style></head>
<body>
<div class="top"><a class="lang" href="${e(otherHref)}" hreflang="${other}" lang="${other}">${e(t.otherLang)}</a></div>
<main>
<img class="brand" src="/tentacle-logo-pirate.svg" alt="" width="56" height="56">
<div class="card">
<section id="form-view" aria-labelledby="t">
<h1 id="t">${e(t.title)}</h1>
<p class="sub">${e(t.subtitle)}</p>
<noscript><p class="alert">${e(t.noScript)}</p></noscript>
<form id="f" method="post" action="/api/auth/register">
<div class="field"><label for="k">${e(t.inviteKey)}</label>
<input id="k" class="key" name="inviteKey" value="${e(inviteKey)}" required maxlength="64" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="k-hint k-err">
<p class="hint" id="k-hint">${e(t.inviteKeyHint)}</p><p class="err" id="k-err" role="alert" hidden></p></div>
<div class="field"><label for="u">${e(t.username)}</label>
<input id="u" name="username" required minlength="3" maxlength="50" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="u-hint u-err">
<p class="hint" id="u-hint">${e(t.usernameHint)}</p><p class="err" id="u-err" role="alert" hidden></p></div>
<div class="field"><label for="p">${e(t.password)}</label>
<div class="pw"><input id="p" name="password" type="password" required minlength="6" autocomplete="new-password" aria-describedby="p-hint">
<button type="button" class="eye" id="eye" aria-controls="p c" aria-pressed="false" aria-label="${e(t.showPasswords)}">${EYE_ON}${EYE_OFF}</button></div>
<p class="hint" id="p-hint">${e(t.passwordHint)}</p></div>
<div class="field"><label for="c">${e(t.confirmPassword)}</label>
<input id="c" type="password" required minlength="6" autocomplete="new-password" aria-describedby="c-err">
<p class="err" id="c-err" role="alert" hidden></p></div>
<p class="alert" id="err" role="alert" hidden></p>
<button class="go" id="go" type="submit" disabled>${e(t.submit)}</button>
</form>
</section>
<section id="done-view" aria-labelledby="d" hidden>
<h1 id="d" tabindex="-1">${e(t.doneTitle)}</h1>
<p class="done">${e(t.doneBody)}</p>
<div class="field"><p class="lbl" id="a-lbl">${e(t.serverAddress)}</p>
<div class="addr"><output id="a" aria-labelledby="a-lbl"></output><button type="button" id="cp"><span id="cp-t" aria-live="polite">${e(t.copy)}</span></button></div></div>
</section>
</div>
<p class="foot">${e(t.getApp)} <a href="https://tentacletv.app" target="_blank" rel="noopener noreferrer">${e(t.getAppLink)}</a></p>
</main>
<script nonce="${nonce}">window.__TEXT__=${json};</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`;
}

/** Rien d'autre que ce que la page porte : ses deux scripts et son style (nonce), le logo, l'API du serveur. */
export function invitePageCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    "img-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** La réponse entière : langue du navigateur (ou `?lang=`), clé préremplie, jamais en cache ni indexée. */
export function sendInvitePage(request: FastifyRequest, reply: FastifyReply) {
  const query = (request.query ?? {}) as Record<string, unknown>;
  const nonce = randomBytes(16).toString("base64");
  return reply
    .header("content-security-policy", invitePageCsp(nonce))
    .header("cache-control", "no-store")
    .header("x-robots-tag", "noindex, nofollow")
    .type("text/html; charset=utf-8")
    .send(invitePageHtml({ lang: invitePageLang(request.headers["accept-language"], query.lang), inviteKey: inviteKeyFromQuery(query.invite), nonce }));
}
