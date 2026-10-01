// Les visuels de MARQUE des stores, tirés des sources de `brand/` (jamais
// redessinés) : la « Super hero art » 16:9 du Microsoft Store — ni texte, ni
// interface, ni appareil, l'essentiel au centre et rien d'important dans le
// tiers bas (consignes de Microsoft) — et l'icône 1:1 300×300 qu'il recommande.
import path from "node:path";
import { BRAND, STORE_OUT } from "../lib/paths.mjs";
import { describe, fileUrl, renderPng } from "../lib/render.mjs";

const LOGO = fileUrl(path.join(BRAND, "logo-color.svg"));
const ICON = fileUrl(path.join(BRAND, "app-icon-color.svg"));

/** La mascotte au centre du haut, sur le fond de marque et son halo. */
function heroArtHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#07040f;}
.canvas{position:relative;width:1920px;height:1080px;overflow:hidden;
  background:radial-gradient(1500px 900px at 50% 38%, #2a0f4d 0%, #14072a 46%, #07040f 78%);}
.halo{position:absolute;inset:0;background:
  radial-gradient(760px 520px at 50% 36%, rgba(168,85,247,.55), transparent 70%),
  radial-gradient(900px 420px at 64% 52%, rgba(236,72,153,.30), transparent 72%),
  radial-gradient(900px 420px at 36% 30%, rgba(139,92,246,.30), transparent 72%);filter:blur(30px);}
.rays{position:absolute;inset:0;background:conic-gradient(from 180deg at 50% -8%, transparent 0deg, rgba(255,255,255,.05) 8deg, transparent 16deg, rgba(255,255,255,.04) 26deg, transparent 34deg, rgba(255,255,255,.05) 330deg, transparent 338deg);
  -webkit-mask-image:linear-gradient(180deg, #000 0%, transparent 70%);}
.floor{position:absolute;left:0;right:0;top:720px;bottom:0;background:linear-gradient(180deg, rgba(7,4,15,0), #07040f 80%);}
.logo{position:absolute;left:50%;top:70px;width:600px;height:600px;transform:translateX(-50%);
  filter:drop-shadow(0 40px 80px rgba(0,0,0,.55)) drop-shadow(0 0 70px rgba(217,70,239,.35));}
</style></head><body><div class="canvas">
<div class="halo"></div><div class="rays"></div><div class="floor"></div>
<img class="logo" src="${LOGO}" alt="">
</div></body></html>`;
}

const iconHtml = () => `<!doctype html><html><body style="margin:0;width:300px;height:300px;background:#07040f">
<img src="${ICON}" style="display:block;width:300px;height:300px" alt=""></body></html>`;

/** Rend les visuels de marque et contrôle leur format (RVB sans alpha). */
export async function composeBrandArt() {
  const out = STORE_OUT.microsoft;
  const jobs = [
    { file: path.join(out, "super-hero-art-3840x2160.png"), html: heroArtHtml(), size: { width: 1920, height: 1080, scale: 2 }, want: "3840x2160 srgb" },
    { file: path.join(out, "app-tile-icon-300x300.png"), html: iconHtml(), size: { width: 300, height: 300, scale: 1 }, want: "300x300 srgb" },
  ];
  for (const job of jobs) {
    await renderPng(job.html, job.file, { ...job.size, background: "#07040f" });
    const info = describe(job.file);
    if (info !== job.want) throw new Error(`format refusé pour ${job.file} : ${info} (attendu ${job.want})`);
    console.log(`marque ${path.basename(job.file)} — ${info}`);
  }
}
