// Gabarit commun des images de store hors Apple TV (téléphone, tablette,
// bureau) : la direction validée sur l'Apple TV — accroche en haut, un mot au
// dégradé de la marque, l'écran en grand dessous dans un panneau aux coins
// arrondis, éclairé par sa propre lumière, halo de marque discret, grain fin.
// Aucun cadre d'appareil (Apple n'admet que les siens, Play les déconseille).
import { FIT_SCRIPT, fileUrl, interFaces } from "../lib/render.mjs";

// Grain très fin contre les paliers des dégradés sombres en 8 bits.
const GRAIN = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>',
)}`;

/**
 * Les mises en page, en px CSS (rendues à `scale`). `panel` : la place de
 * l'écran, à son propre rapport ; `headline` : boîte de l'accroche (deux
 * lignes au plus) ; `radius` : coins de l'écran.
 */
export const LAYOUTS = {
  // App Store iPhone 6,9" : 1320×2868.
  iphone: { width: 660, height: 1434, scale: 2, headline: { top: 70, size: 54, box: 560 }, panel: { width: 520, top: 268 }, radius: 46 },
  // Google Play téléphone 9:16 : 1080×1920.
  playPhone: { width: 540, height: 960, scale: 2, headline: { top: 44, size: 38, box: 470 }, panel: { width: 340, top: 176 }, radius: 30 },
  // App Store iPad 13" portrait : 2064×2752.
  ipad: { width: 1032, height: 1376, scale: 2, headline: { top: 64, size: 60, box: 900 }, panel: { width: 820, top: 236 }, radius: 28 },
  // App Store iPad 13" paysage : 2752×2064 (variante, l'écran de l'app y est plein).
  ipadLandscape: { width: 1376, height: 1032, scale: 2, headline: { top: 44, size: 56, box: 1240 }, panel: { width: 1120, top: 148 }, radius: 20 },
  // Google Play tablette 16:9 paysage : 2560×1440.
  playTablet: { width: 1280, height: 720, scale: 2, headline: { top: 34, size: 44, box: 1120 }, panel: { width: 1000, top: 116 }, radius: 18 },
  // Mac App Store 16:10 : 2880×1800.
  mac: { width: 1440, height: 900, scale: 2, headline: { top: 40, size: 56, box: 1240 }, panel: { width: 1180, top: 134 }, radius: 16 },
};

/** `capture` : l'écran (PNG) ; `ratio` : sa largeur / hauteur ; `headline` : HTML (<em> = dégradé). */
export function storeHtml({ layout, capture, ratio, headline, lang }) {
  const L = LAYOUTS[layout];
  const shot = fileUrl(capture);
  const panelHeight = Math.round(L.panel.width / ratio);
  const left = Math.round((L.width - L.panel.width) / 2);
  const top = L.panel.top;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${interFaces()}
html,body{margin:0;width:${L.width}px;height:${L.height}px;overflow:hidden;background:#05050a;}
.canvas{position:relative;width:${L.width}px;height:${L.height}px;overflow:hidden;background:#05050a;}
.ambient{position:absolute;left:${left - 80}px;top:${top - 60}px;width:${L.panel.width + 160}px;height:${panelHeight + 120}px;
  background:url("${shot}") center/cover;filter:blur(${Math.round(L.width / 22)}px) saturate(150%);opacity:.55;}
.halo{position:absolute;inset:0;background:
  radial-gradient(${Math.round(L.width * 0.62)}px ${Math.round(L.height * 0.32)}px at 50% 104%, rgba(217,70,239,.30), transparent 72%),
  radial-gradient(${Math.round(L.width * 0.55)}px ${Math.round(L.height * 0.4)}px at 14% 30%, rgba(139,92,246,.28), transparent 70%),
  radial-gradient(${Math.round(L.width * 0.55)}px ${Math.round(L.height * 0.4)}px at 88% 86%, rgba(236,72,153,.24), transparent 70%);}
.shade{position:absolute;inset:0;background:
  linear-gradient(180deg, rgba(5,5,10,.94) 0%, rgba(5,5,10,.6) ${Math.round((top / L.height) * 60)}%, rgba(5,5,10,.12) ${Math.round((top / L.height) * 160)}%, rgba(5,5,10,.12) 80%, rgba(5,5,10,.72) 100%),
  radial-gradient(ellipse 120% 90% at 50% 55%, transparent 55%, rgba(5,5,10,.85) 100%);}
.grain{position:absolute;inset:0;background:url("${GRAIN}");opacity:.07;mix-blend-mode:soft-light;}
.headline{position:absolute;left:0;right:0;top:${L.headline.top}px;margin:0 auto;width:${L.headline.box}px;text-align:center;
  font:800 ${L.headline.size}px/1.1 "Inter";letter-spacing:-0.03em;color:#f6f4ff;text-shadow:0 2px 24px rgba(0,0,0,.45);text-wrap:balance;}
.headline em{font-style:normal;background:linear-gradient(92deg,#a78bfa 0%,#d946ef 52%,#ec4899 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;}
.panel{position:absolute;left:${left}px;top:${top}px;width:${L.panel.width}px;height:${panelHeight}px;
  border-radius:${L.radius}px;overflow:hidden;background:#000;
  box-shadow:0 0 0 1.5px rgba(255,255,255,.14), 0 ${Math.round(L.width / 30)}px ${Math.round(L.width / 12)}px rgba(0,0,0,.72), 0 0 ${Math.round(L.width / 9)}px 4px rgba(139,92,246,.20);}
.panel img{display:block;width:100%;height:100%;}
.panel::after{content:"";position:absolute;inset:0;border-radius:${L.radius}px;pointer-events:none;
  background:linear-gradient(180deg, rgba(255,255,255,.05), transparent 16%);}
</style></head><body><div class="canvas">
<div class="ambient"></div><div class="halo"></div><div class="shade"></div><div class="grain"></div>
<h1 class="headline">${headline}</h1>
<div class="panel"><img src="${shot}" alt=""></div>
</div>${FIT_SCRIPT}</body></html>`;
}
