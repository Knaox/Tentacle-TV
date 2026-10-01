// Gabarit d'une image App Store Apple TV (3840×2160) : l'accroche en haut,
// l'écran de la refonte en grand dessous, éclairé par sa propre lumière
// (l'image floutée déborde dans la pièce) et un halo de marque discret.
import { FIT_SCRIPT, fileUrl, interFaces } from "../lib/render.mjs";

export const APPSTORE_SIZE = { width: 1920, height: 1080, scale: 2 };

const PANEL = { left: 176, top: 162, width: 1568, height: 882 };

// Grain très fin contre les paliers des dégradés sombres en 8 bits.
const GRAIN = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>',
)}`;

/** `capture` : la capture 3840×2160 de l'écran ; `headline` : HTML (<em> = dégradé). */
export function appstoreHtml({ capture, headline, lang }) {
  const shot = fileUrl(capture);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${interFaces()}
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#05050a;}
.canvas{position:relative;width:1920px;height:1080px;overflow:hidden;background:#05050a;}
.ambient{position:absolute;left:${PANEL.left - 160}px;top:${PANEL.top - 120}px;width:${PANEL.width + 320}px;height:${PANEL.height + 240}px;
  background:url("${shot}") center/cover;filter:blur(90px) saturate(150%);opacity:.55;}
.halo{position:absolute;inset:0;background:
  radial-gradient(1100px 420px at 50% 104%, rgba(217,70,239,.34), transparent 72%),
  radial-gradient(900px 560px at 18% 34%, rgba(139,92,246,.30), transparent 70%),
  radial-gradient(900px 560px at 86% 88%, rgba(236,72,153,.26), transparent 70%);}
.shade{position:absolute;inset:0;background:
  linear-gradient(180deg, rgba(5,5,10,.94) 0%, rgba(5,5,10,.62) 14%, rgba(5,5,10,.10) 34%, rgba(5,5,10,.10) 78%, rgba(5,5,10,.70) 100%),
  radial-gradient(ellipse 120% 90% at 50% 55%, transparent 55%, rgba(5,5,10,.85) 100%);}
.grain{position:absolute;inset:0;background:url("${GRAIN}");opacity:.07;mix-blend-mode:soft-light;}
.headline{position:absolute;left:${PANEL.left}px;top:38px;margin:0;white-space:nowrap;
  font:800 72px/1.12 "Inter";letter-spacing:-0.03em;color:#f6f4ff;text-shadow:0 2px 24px rgba(0,0,0,.45);}
.headline em{font-style:normal;background:linear-gradient(92deg,#a78bfa 0%,#d946ef 52%,#ec4899 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;}
.panel{position:absolute;left:${PANEL.left}px;top:${PANEL.top}px;width:${PANEL.width}px;height:${PANEL.height}px;
  border-radius:22px;overflow:hidden;background:#000;
  box-shadow:0 0 0 1.5px rgba(255,255,255,.13), 0 46px 110px rgba(0,0,0,.72), 0 0 160px 6px rgba(139,92,246,.20);}
.panel img{display:block;width:100%;height:100%;}
.panel::after{content:"";position:absolute;inset:0;border-radius:22px;pointer-events:none;
  background:linear-gradient(180deg, rgba(255,255,255,.05), transparent 18%);}
</style></head><body><div class="canvas">
<div class="ambient"></div><div class="halo"></div><div class="shade"></div><div class="grain"></div>
<h1 class="headline" data-fit="${PANEL.width}">${headline}</h1>
<div class="panel"><img src="${shot}" alt=""></div>
</div>${FIT_SCRIPT}</body></html>`;
}
