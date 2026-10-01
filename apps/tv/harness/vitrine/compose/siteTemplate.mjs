// Gabarits des visuels du site tentacletv.app. Fond noir (#000, la surface
// du site) pour se fondre dans la page ; cadres TV dans le style de ceux du
// site (`shot-tv` : dalle fine, coins doux, pied discret).
import { fileUrl, interFaces } from "../lib/render.mjs";

export const STAGE_SIZE = { width: 1600, height: 900, scale: 1.5 };

const tv = (cls, capture) => `<figure class="tv ${cls}"><div class="screen"><img src="${fileUrl(capture)}" alt=""></div></figure>`;

/** Un plan produit : la TV de l'accueil, de biais, posée sur un sol qui la
 *  reflète ; derrière, en retrait, deux autres écrans de la refonte. */
export function stageHtml({ front, left, right, lang }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${interFaces()}
html,body{margin:0;width:1600px;height:900px;overflow:hidden;background:#000;}
.canvas{position:relative;width:1600px;height:900px;overflow:hidden;background:#000;perspective:2400px;perspective-origin:50% 38%;}
.glow{position:absolute;inset:0;background:
  radial-gradient(780px 430px at 50% 42%, rgba(139,92,246,.50), transparent 70%),
  radial-gradient(560px 320px at 76% 62%, rgba(236,72,153,.30), transparent 72%),
  radial-gradient(560px 320px at 22% 58%, rgba(167,139,250,.22), transparent 72%);filter:blur(36px);}
.stage{position:absolute;inset:0;transform-style:preserve-3d;}
.tv{position:absolute;margin:0;padding:8px;border-radius:14px;border:1px solid rgba(255,255,255,.16);
  background:linear-gradient(180deg,#1d1d21,#0b0b0d);box-shadow:0 50px 110px rgba(0,0,0,.8);}
.tv .screen{overflow:hidden;border-radius:6px;line-height:0;background:#000;}
.tv img{display:block;width:100%;}
.front{left:275px;top:96px;width:1050px;transform:rotateY(-9deg) rotateX(1.5deg);
  -webkit-box-reflect:below 22px linear-gradient(transparent 62%, rgba(255,255,255,.16));}
.back{width:720px;top:66px;filter:brightness(.5) saturate(.9);}
.back.left{left:40px;transform:translateZ(-420px) rotateY(22deg);}
.back.right{right:40px;transform:translateZ(-420px) rotateY(-22deg);}
.floor{position:absolute;left:0;right:0;top:700px;bottom:0;background:linear-gradient(180deg, rgba(0,0,0,0), #000 70%);}
</style></head><body><div class="canvas">
<div class="glow"></div>
<div class="stage">${tv("back left", left)}${tv("back right", right)}${tv("front", front)}</div>
<div class="floor"></div>
</div></body></html>`;
}
