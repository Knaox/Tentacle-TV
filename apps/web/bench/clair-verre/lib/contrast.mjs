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

import { contrastRatio, decodePng, luminance } from "./png.mjs";

const HIDE_ID = "banc-contraste-masque";

/** Dans la page : relève les textes et pictogrammes visibles du viewport (couleur, boîtes, chemin). */
const COLLECT = () => {
  const parse = (value) => {
    if (!value) return null;
    let m = value.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
    }
    m = value.match(/^color\(srgb ([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]];
    }
    return null;
  };
  const opacityOf = (node) => {
    let opacity = 1;
    for (let el = node; el && el !== document.documentElement; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
    return opacity;
  };
  const pathOf = (node) => {
    const parts = [];
    for (let el = node, depth = 0; el && depth < 4 && el !== document.body; el = el.parentElement, depth++) {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 6).join(".") : "";
      parts.unshift(el.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
    }
    return parts.join(" > ");
  };
  /** Le rectangle visible d'un élément : l'intersection des ancêtres qui rognent (`overflow` ≠ visible). */
  const clipOf = (node) => {
    let box = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let el = node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const r = el.getBoundingClientRect();
      box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
    }
    return box;
  };
  const intersect = (r, box) => {
    const left = Math.max(r.left, box.left);
    const top = Math.max(r.top, box.top);
    const right = Math.min(r.right, box.right);
    const bottom = Math.min(r.bottom, box.bottom);
    return right - left >= 2 && bottom - top >= 2 ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
  };
  /**
   * Ce qui RECOUVRE un point : `layer` — un calque flottant étranger à l'élément (barre fixe, menu, modale, voile :
   * le texte dessous est caché ou hors jeu) ; `other` — un autre élément de la page ; `null` — rien.
   */
  const coverOf = (node, [x, y, w, h]) => {
    const top = document.elementFromPoint(x + w / 2, y + h / 2);
    if (!top || top === node || node.contains(top) || top.contains(node)) return null;
    for (let el = top; el && el !== document.body; el = el.parentElement) {
      const position = getComputedStyle(el).position;
      if (position === "fixed" || position === "sticky" || el.matches('[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]')) {
        return el.contains(node) ? "other" : "layer";
      }
    }
    return "other";
  };
  const vw = innerWidth;
  const vh = innerHeight;
  const inView = (r) => r.width >= 2 && r.height >= 2 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue.replace(/\s+/g, " ").trim();
    const el = node.parentElement;
    if (!text || !el || el.closest("[data-banc-ignore], script, style, noscript")) continue;
    if (/^\d+ i\/s|^DEBUG$/.test(text)) continue; // le compteur d'images et le bouton de débogage du paquet de dev
    // Un contrôle inactif n'a pas à se lire (WCAG 1.4.3) ; un séparateur « · » est un ornement.
    if (el.closest(":disabled, [aria-disabled='true'], [inert]") || /^[·•|/—–-]$/.test(text)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    if (!el.checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true })) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const clip = clipOf(el);
    const rects = [...range.getClientRects()].map((r) => intersect(r, clip)).filter((r) => r && inView(r)).map((r) => [r.left, r.top, r.width, r.height]);
    if (rects.length === 0) continue;
    const opacity = opacityOf(el);
    if (opacity < 0.05) continue;
    const color = parse(style.color);
    const fill = style.webkitTextFillColor ? parse(style.webkitTextFillColor) : null;
    const used = fill ?? color;
    if (!used) continue;
    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    items.push({
      kind: "text",
      cover: coverOf(el, rects[0]),
      text: text.slice(0, 48),
      path: pathOf(el),
      color: used,
      opacity,
      clipped: used[3] === 0 && style.backgroundClip === "text",
      size,
      weight,
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      rects: rects.slice(0, 4),
    });
  }
  // Le texte d'invite d'un champ vide : il se lit, lui aussi.
  for (const field of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
    if (field.value || field.disabled || !field.checkVisibility?.({ checkVisibilityCSS: true })) continue;
    const r = field.getBoundingClientRect();
    if (!inView(r)) continue;
    const style = getComputedStyle(field);
    const color = parse(getComputedStyle(field, "::placeholder").color);
    if (!color) continue;
    const left = r.left + parseFloat(style.paddingLeft) + 2;
    const width = Math.min(r.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4, 160);
    if (width < 8) continue;
    items.push({
      kind: "placeholder", cover: coverOf(field, [left, r.top + r.height / 2 - 6, width, 12]), text: field.getAttribute("placeholder").slice(0, 48), path: pathOf(field), color, opacity: opacityOf(field),
      clipped: false, size: parseFloat(style.fontSize), weight: 400, large: false,
      rects: [[left, r.top + r.height / 2 - 6, width, 12]],
    });
  }
  for (const svg of document.querySelectorAll("svg")) {
    if (svg.closest("[data-banc-ignore], :disabled, [aria-disabled='true'], [inert]")) continue;
    const r = svg.getBoundingClientRect();
    if (!inView(r) || r.width > 64 || r.height > 64 || r.width < 8) continue;
    const style = getComputedStyle(svg);
    if (style.visibility === "hidden" || !svg.checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true })) continue;
    const shape = svg.querySelector("path, circle, rect, polygon, polyline, line, ellipse, use");
    if (!shape) continue;
    const shapeStyle = getComputedStyle(shape);
    const paint = shapeStyle.fill !== "none" ? parse(shapeStyle.fill) : parse(shapeStyle.stroke);
    if (!paint || paint[3] === 0) continue;
    const opacity = opacityOf(svg) * Number(shapeStyle.fillOpacity || 1);
    if (opacity < 0.05) continue;
    items.push({
      kind: "icon",
      cover: coverOf(svg, [r.left, r.top, r.width, r.height]),
      text: svg.closest("[aria-label]")?.getAttribute("aria-label")?.slice(0, 40) ?? "",
      path: pathOf(svg),
      color: paint,
      opacity,
      clipped: false,
      size: Math.round(r.width),
      weight: 0,
      large: true,
      rects: [[r.left, r.top, r.width, r.height]],
    });
  }
  return items;
};

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
 * Mesure le viewport courant de la page.
 * @returns {Promise<Array<object>>} un relevé par texte ou pictogramme, avec son rapport de contraste médian et minimal.
 */
export async function measureViewport(page, dump = null) {
  // Une page qui bouge encore (rangée qui arrive, image qui pousse) fausse tout : on relève les boîtes AVANT et
  // APRÈS les deux captures, on écarte ce qui a bougé, et on recommence si trop de choses bougent.
  let items = [];
  let seen = null;
  let png = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    await settleImages(page);
    const before = await page.evaluate(COLLECT);
    seen = decodePng(await page.screenshot({ type: "png" }));
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
    png = await page.screenshot({ type: "png" });
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
