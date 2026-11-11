/**
 * La mesure de contraste du banc, AU PIXEL : le texte et les pictogrammes sont rendus invisibles,
 * la page est capturée (son FOND seul : aplats, dégradés, images, verre, voiles), puis chaque
 * texte est comparé aux pixels qu'il recouvre. Aucune hypothèse sur l'empilement : ce que l'œil
 * voit derrière la lettre, c'est ce que la capture rend.
 *
 * Seuils WCAG : 4,5:1 pour le texte ; 3:1 pour un grand texte (≥ 24 px, ou ≥ 18,66 px en gras)
 * et pour un pictogramme.
 */

import { writeFileSync } from "node:fs";

import { COLLECT } from "./collect.mjs";
import { contrastRatio, decodePng, luminance } from "./png.mjs";

const HIDE_ID = "banc-contraste-masque";

const HIDE_CSS = `
 @layer banc-masque {
  *, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important;
    text-shadow: none !important; caret-color: transparent !important; transition: none !important; }
  *::placeholder { color: transparent !important; }
  svg[data-banc-icon] { visibility: hidden !important; }
 }
`;

/** Attend que les images visibles soient décodées (plafond : 4 s) — une affiche qui arrive change le fond. */
async function settleImages(page) {
  await page.evaluate(async () => {
    const pending = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      return !img.complete && r.bottom > 0 && r.top < innerHeight && r.width > 0;
    });
    await Promise.race([
      Promise.all(pending.map((img) => new Promise((done) => { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }))),
      new Promise((done) => setTimeout(done, 4000)),
    ]);
  });
  await page.waitForTimeout(350); // le fondu d'arrivée (220 ms)
}

/**
 * Les outils du paquet de développement (compteur d'images, bouton DEBUG) flottent sur la page sans
 * capter le pointeur : ils ne sont pas l'interface, et faussent ce qui passe dessous. Masqués.
 */
async function hideDevTools(page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!/^\d+ i\/s|^DEBUG$/.test(node.nodeValue.trim())) continue;
      for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
        if (getComputedStyle(el).position === "fixed") { el.style.visibility = "hidden"; break; }
      }
    }
  });
}

/**
 * Mesure le viewport courant de la page.
 * @returns {Promise<Array<object>>} un relevé par texte ou pictogramme, avec son rapport de contraste médian et minimal.
 */
export async function measureViewport(page, dump = null) {
  // Une page qui bouge encore (rangée qui arrive, image qui pousse) fausse tout : on relève les boîtes AVANT et
  // APRÈS les deux captures, on écarte ce qui a bougé, et on recommence si trop de choses bougent.
  let items = [];
  let seen = null;
  let png = null;
  await hideDevTools(page);
  for (let attempt = 0; attempt < 4; attempt++) {
    await settleImages(page);
    const before = await page.evaluate(COLLECT);
    seen = decodePng(await page.screenshot({ type: "png", scale: "css" }));
    await page.evaluate(({ id, css }) => {
      for (const svg of document.querySelectorAll("svg")) {
        const r = svg.getBoundingClientRect();
        if (r.width <= 64 && r.height <= 64) svg.setAttribute("data-banc-icon", "");
      }
      const style = document.createElement("style");
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }, { id: HIDE_ID, css: HIDE_CSS });
    await page.waitForTimeout(60);
    png = await page.screenshot({ type: "png", scale: "css" });
    await page.evaluate((id) => {
      document.getElementById(id)?.remove();
      for (const svg of document.querySelectorAll("svg[data-banc-icon]")) svg.removeAttribute("data-banc-icon");
    }, HIDE_ID);
    const after = await page.evaluate(COLLECT);
    const key = (item) => `${item.kind}|${item.path}|${item.text}|${item.rects[0].map(Math.round).join(",")}`;
    const still = new Set(after.map(key));
    items = before.filter((item) => still.has(key(item)));
    if (items.length >= before.length * 0.85) break;
    await page.waitForTimeout(1200);
  }
  if (dump) writeFileSync(dump, png); // le FOND seul, pour comprendre une mesure
  const { data, width, height } = decodePng(png);
  const results = [];
  for (const item of items) {
    if (item.clipped || item.cover === "layer") continue;
    const ratios = [];
    let sample = null;
    let painted = 0;
    for (const [x, y, w, h] of item.rects) {
      for (let py = Math.max(0, Math.floor(y)); py < Math.min(height, y + h); py++) {
        for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, x + w); px++) {
          const o = (py * width + px) * 4;
          if (Math.abs(seen.data[o] - data[o]) + Math.abs(seen.data[o + 1] - data[o + 1]) + Math.abs(seen.data[o + 2] - data[o + 2]) > 6) painted++;
        }
      }
    }
    for (const [x, y, w, h] of item.rects) {
      for (let iy = 0; iy < 3; iy++) {
        for (let ix = 0; ix < 7; ix++) {
          const px = Math.round(x + ((ix + 0.5) * w) / 7);
          const py = Math.round(y + ((iy + 0.5) * h) / 3);
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const o = (py * width + px) * 4;
          const bg = [data[o], data[o + 1], data[o + 2]];
          const alpha = item.color[3] * item.opacity;
          const fg = [0, 1, 2].map((i) => item.color[i] * alpha + bg[i] * (1 - alpha));
          ratios.push(contrastRatio(luminance(...fg), luminance(...bg)));
          sample ??= { bg, fg: fg.map(Math.round) };
        }
      }
    }
    if (ratios.length === 0) continue;
    ratios.sort((a, b) => a - b);
    // Aucun pixel du texte dans la capture alors qu'il devrait trancher : il est recouvert (voile, feuille, calque).
    if (painted === 0 && (item.cover === "other" || ratios[ratios.length >> 1] > 1.25)) continue;
    if (item.kind === "icon" && painted === 0) continue;
    const threshold = item.large ? 3 : 4.5;
    results.push({
      kind: item.kind,
      text: item.text,
      path: item.path,
      size: item.size,
      weight: item.weight,
      threshold,
      median: Number(ratios[ratios.length >> 1].toFixed(2)),
      min: Number(ratios[0].toFixed(2)),
      fg: sample.fg,
      bg: sample.bg,
      rect: item.rects[0].map(Math.round),
    });
  }
  return results;
}

/** Les relevés sous leur seuil (à la MÉDIANE des points : un aplat ; `min` dit le pire point sur une image). */
export function failures(results) {
  return results.filter((r) => r.median < r.threshold);
}

const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Regroupe les défauts par couple (texte, fond) et par chemin — le tableau du rapport. */
export function summarize(fails) {
  const groups = new Map();
  for (const f of fails) {
    const key = `${f.kind}|${hex(f.fg)}|${hex(f.bg)}|${f.path.split(" > ").slice(-2).join(" > ")}`;
    const group = groups.get(key) ?? { kind: f.kind, fg: hex(f.fg), bg: hex(f.bg), ratio: f.median, threshold: f.threshold, path: f.path, count: 0, samples: [] };
    group.count++;
    group.ratio = Math.min(group.ratio, f.median);
    if (group.samples.length < 3 && f.text) group.samples.push(f.text);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.ratio - b.ratio);
}
