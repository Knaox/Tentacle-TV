import { WAITING_TEXT, type WaitingLang } from "./waitingPageText";

/**
 * La page d'attente MINIMALE du serveur de maintenance : servie à toute
 * navigation pendant la migration — le client web, le bureau qui recharge, et le
 * client des téléviseurs LG sous `/tv` —, même interface web coupée
 * (`TENTACLE_WEB_UI=off`), et seulement pendant la migration. Elle ne montre RIEN
 * de l'interface normale : l'état, la progression, le temps restant ; en échec,
 * une phrase sans détail technique. Elle relit `/api/health` toutes les deux
 * secondes et se recharge quand la base est prête.
 *
 * Tout est dans la page (aucun fichier à servir) et en ES5 + XMLHttpRequest :
 * les téléviseurs LG d'avant 2020 ont un Chromium 53 (d'où une taille de repli
 * avant chaque `clamp()`, qu'il ignore).
 */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:#0b0a12;color:#f4f2fa;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
display:flex;align-items:center;justify-content:center;padding:16px}
main{width:100%;max-width:640px;padding:40px;padding:clamp(24px,5vw,56px);border-radius:28px;
background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);text-align:center}
h1{font-size:30px;font-size:clamp(22px,3.2vw,40px);font-weight:700;line-height:1.2}
p{font-size:19px;font-size:clamp(15px,1.8vw,22px);line-height:1.5;color:rgba(244,242,250,0.78);margin-top:14px}
.bar{height:12px;border-radius:999px;background:rgba(255,255,255,0.10);margin:28px 0 12px;overflow:hidden}
.fill{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#ec4899);transition:width .6s ease}
.row{display:flex;justify-content:space-between;font-size:17px;font-size:clamp(14px,1.6vw,20px);color:rgba(244,242,250,0.85)}
.small{font-size:16px;font-size:clamp(13px,1.4vw,18px);color:rgba(244,242,250,0.55);margin-top:22px}
.failed .bar{display:none}
.hidden{display:none}
`;

const SCRIPT = `
(function(){
var T=window.__TEXT__,box=document.getElementById("m");
function el(id){return document.getElementById(id);}
function fmt(s,o){for(var k in o){s=s.split("{"+k+"}").join(String(o[k]));}return s;}
function eta(p){if(p.etaSeconds===null||p.etaSeconds===undefined)return T.etaUnknown;
if(p.etaSeconds<60)return T.etaSoon;return fmt(T.etaMinutes,{n:Math.ceil(p.etaSeconds/60)});}
function clock(s){if(s<60)return s+" s";var m=Math.floor(s/60),r=s%60;return m+" min"+(r?" "+r+" s":"");}
function show(db){
var p=db.progress||{done:0,total:0,percent:0,etaSeconds:null};
if(db.state==="failed"){box.className="failed";el("t").textContent=T.failedTitle;el("b").textContent=T.failedBody;
var why=T.reasons[db.reason]||T.reasons.other;el("why").textContent=why;el("why").className="";
el("retry").textContent=db.retryInSeconds>0?fmt(T.retryIn,{time:clock(db.retryInSeconds)}):T.retryNow;el("retry").className="";
el("back").className="small";el("row").className="hidden";el("eta").className="hidden";return;}
box.className="";el("t").textContent=T.title;el("b").textContent=T.body;
el("why").className="hidden";el("retry").className="hidden";el("back").className="hidden";el("row").className="row";el("eta").className="small";
el("fill").style.width=Math.max(2,p.percent)+"%";el("pct").textContent=p.percent+" %";
el("tables").textContent=p.total?fmt(T.tables,{done:p.done,total:p.total}):"";el("eta").textContent=eta(p);}
function poll(){var x=new XMLHttpRequest();x.open("GET","/api/health?_="+Date.now(),true);
x.onreadystatechange=function(){if(x.readyState!==4)return;var next=2000;
if(x.status===200){try{var h=JSON.parse(x.responseText);var db=h.database;
if(!db||db.state==="ready"){window.location.reload();return;}show(db);}catch(e){}}
setTimeout(poll,next);};x.send();}
poll();})();
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function waitingPageHtml(lang: WaitingLang): string {
  const t = WAITING_TEXT[lang];
  // Le JSON des mots, sûr dans une balise <script> (aucune fin de balise possible).
  const json = JSON.stringify(t).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Tentacle — ${escapeHtml(t.title)}</title>
<style>${CSS}</style></head>
<body><main id="m" role="status" aria-live="polite">
<h1 id="t">${escapeHtml(t.title)}</h1>
<p id="b">${escapeHtml(t.body)}</p>
<p id="why" class="hidden"></p>
<div class="bar"><div class="fill" id="fill"></div></div>
<div class="row" id="row"><span id="pct">0 %</span><span id="tables"></span></div>
<p class="small" id="eta">${escapeHtml(t.etaUnknown)}</p>
<p id="retry" class="hidden"></p>
<p id="back" class="hidden">${escapeHtml(t.rollback)}</p>
<p class="small">${escapeHtml(t.footer)}</p>
</main>
<script>window.__TEXT__=${json};</script>
<script>${SCRIPT}</script>
</body></html>`;
}
