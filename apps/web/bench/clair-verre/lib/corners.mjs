/**
 * Le détecteur de COINS du banc : sous le Liquid Glass, tout ce qui peint une forme de verre —
 * l'élément, ses pseudo-éléments (liseré, reflet, ombre), ses calques plein cadre, le filtre de
 * sa lentille — doit suivre le MÊME rayon. Un calque resté carré sur une forme arrondie, c'est
 * « un coin non arrondi dans le verre ».
 *
 * Trois défauts relevés :
 *  - `layer`  : un pseudo-élément ou un calque plein cadre peint, dont le rayon diffère de son porteur ;
 *  - `clip`   : un porteur arrondi dont un descendant peint déborde par un coin (pas d'`overflow` qui rogne,
 *               descendant collé au coin, peint, moins arrondi) ;
 *  - `lens`   : une lentille (filtre SVG du `backdrop-filter`) calculée pour une autre taille que l'élément.
 */

/** Dans la page. */
export const CORNERS = () => {
  const px = (v) => parseFloat(v) || 0;
  const radii = (s, w, h) => [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
    .map((v) => Math.min(v.includes("%") ? (px(v) / 100) * Math.min(w, h) : px(v), Math.min(w, h) / 2));
  const paints = (s) => (s.backgroundImage && s.backgroundImage !== "none")
    || (s.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor))
    || (s.boxShadow && s.boxShadow !== "none")
    || (s.backdropFilter && s.backdropFilter !== "none")
    || px(s.borderTopWidth) > 0;
  const label = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 5).join(".") : "";
    return el.tagName.toLowerCase() + (cls ? `.${cls}` : "");
  };
  const visible = (r) => r.width >= 12 && r.height >= 12 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const isGlass = (el, s) => (s.backdropFilter && s.backdropFilter !== "none")
    || /(^|\s)lgc?-/.test(typeof el.className === "string" ? el.className : "")
    || [...el.attributes].some((a) => a.name.startsWith("data-lg-"))
    || el.matches(".nav-capsule-glass, .ctl-switch, .ctl-segment, .season-tab, .ui-tile");
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (!visible(r) || !isGlass(el, s)) continue;
    const own = radii(s, r.width, r.height);
    const clips = s.overflowX !== "visible" || s.overflowY !== "visible" || (s.clipPath && s.clipPath !== "none");

    // 1. Les pseudo-éléments peints de la forme.
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.display === "none" || !paints(ps) || Number(ps.opacity) === 0) continue;
      const inset = [ps.top, ps.right, ps.bottom, ps.left].map(px);
      if (ps.position !== "absolute" || inset.some((v) => Math.abs(v) > 12)) continue;
      const w = r.width - inset[1] - inset[3];
      const h = r.height - inset[0] - inset[2];
      const pr = radii(ps, w, h);
      // Un calque en débord (inset négatif) est concentrique : son rayon vaut celui du porteur + le débord.
      const expected = own.map((v, i) => Math.max(0, v - [Math.max(inset[0], inset[3]), Math.max(inset[0], inset[1]), Math.max(inset[2], inset[1]), Math.max(inset[2], inset[3])][i]));
      if (clips && inset.every((v) => v >= 0)) continue; // rogné par le porteur : son coin ne dépasse pas
      if (pr.some((v, i) => Math.abs(v - expected[i]) > 1.5 && Math.max(v, expected[i]) > 2)) {
        out.push({ kind: "layer", who: `${label(el)}${pseudo}`, own, got: pr, rect: [r.left, r.top, r.width, r.height].map(Math.round) });
      }
    }

    // 2. Les descendants peints collés à un coin, moins arrondis, que rien ne rogne.
    if (!clips && Math.max(...own) > 2) {
      for (const child of el.querySelectorAll(":scope > *, :scope > * > *")) {
        const cs = getComputedStyle(child);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0 || !paints(cs)) continue;
        const cr = child.getBoundingClientRect();
        if (cr.width < 8 || cr.height < 8) continue;
        const crad = radii(cs, cr.width, cr.height);
        const corners = [
          [cr.left - r.left, cr.top - r.top, 0], [r.right - cr.right, cr.top - r.top, 1],
          [r.right - cr.right, r.bottom - cr.bottom, 2], [cr.left - r.left, r.bottom - cr.bottom, 3],
        ];
        for (const [dx, dy, i] of corners) {
          const gap = Math.max(dx, dy);
          if (dx < -0.5 || dy < -0.5 || gap > own[i] * 0.29) continue; // hors de la zone du coin (r·(1 − 1/√2))
          if (crad[i] + gap + 1.5 < own[i]) {
            out.push({ kind: "clip", who: `${label(el)} ⊃ ${label(child)}`, corner: ["haut-gauche", "haut-droit", "bas-droit", "bas-gauche"][i], own: own[i], got: crad[i], gap: Math.round(gap * 10) / 10, rect: [cr.left, cr.top, cr.width, cr.height].map(Math.round) });
            break;
          }
        }
      }
    }

    // 3. La lentille : son filtre est calculé pour une boîte ; elle doit être celle de l'élément.
    const lens = /url\("?#([^")]+)"?\)/.exec(s.backdropFilter ?? "");
    if (lens) {
      const filter = document.getElementById(lens[1]);
      const image = filter?.querySelector("feImage");
      if (image) {
        const fw = px(image.getAttribute("width"));
        const fh = px(image.getAttribute("height"));
        if (fw && fh && (Math.abs(fw - r.width) > 1.5 || Math.abs(fh - r.height) > 1.5)) {
          out.push({ kind: "lens", who: label(el), own, got: [fw, fh], rect: [r.left, r.top, r.width, r.height].map(Math.round) });
        }
      }
    }
  }
  return out;
};

/**
 * Dans la page : toutes les formes ARRONDIES et peintes du viewport (verre ou non) — leur boîte et leurs quatre
 * rayons. Le banc regarde ensuite leurs angles AU PIXEL : sous un coin arrondi, on doit voir le dessous.
 */
export const SHAPES = () => {
  const px = (v) => parseFloat(v) || 0;
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 20 || r.left < 4 || r.top < 4 || r.right > innerWidth - 4 || r.bottom > innerHeight - 4) continue;
    const radii = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
      .map((v) => Math.min(v.includes("%") ? (px(v) / 100) * Math.min(r.width, r.height) : px(v), Math.min(r.width, r.height) / 2));
    const before = getComputedStyle(el, "::before");
    const after = getComputedStyle(el, "::after");
    const paints = (st) => (st.backgroundImage && st.backgroundImage !== "none") || (st.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(st.backgroundColor))
      || (st.backdropFilter && st.backdropFilter !== "none") || (st.boxShadow && st.boxShadow !== "none");
    const glass = (s.backdropFilter && s.backdropFilter !== "none") || /(^|\s)lgc?-/.test(typeof el.className === "string" ? el.className : "") || el.hasAttribute("data-lg-tone") || el.hasAttribute("data-lg-scale");
    if (!glass) continue;
    if (!paints(s) && !(before.content !== "none" && paints(before)) && !(after.content !== "none" && paints(after))) continue;
    // Une forme rognée par un ancêtre n'a pas ses propres angles à l'écran.
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === "visible" && ps.overflowY === "visible") continue;
      const pr = p.getBoundingClientRect();
      if (r.left < pr.left + 1 || r.top < pr.top + 1 || r.right > pr.right - 1 || r.bottom > pr.bottom - 1) { clipped = true; break; }
    }
    if (clipped) continue;
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 6).join(".") : "";
    out.push({ who: el.tagName.toLowerCase() + (cls ? `.${cls}` : ""), rect: [r.left, r.top, r.width, r.height], radii });
  }
  return out;
};

/**
 * Les angles d'une forme, au pixel. Juste DANS l'angle (1,5 px en diagonale), une forme arrondie de rayon ≥ 6 px
 * laisse voir le dessous : ce pixel doit ressembler à celui d'à côté, HORS de la boîte, plus qu'au corps de la forme.
 * @returns les angles qui paraissent carrés.
 */
export function squareCorners(shape, image, ratio = 1) {
  const [x, y, w, h] = shape.rect;
  const at = (px, py) => {
    const ix = Math.round(px * ratio);
    const iy = Math.round(py * ratio);
    if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return null;
    const o = (iy * image.width + ix) * 4;
    return [image.data[o], image.data[o + 1], image.data[o + 2]];
  };
  const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const corners = [[x, y, 1, 1, "haut-gauche"], [x + w, y, -1, 1, "haut-droit"], [x + w, y + h, -1, -1, "bas-droit"], [x, y + h, 1, -1, "bas-gauche"]];
  const found = [];
  corners.forEach(([cx, cy, dx, dy, name], i) => {
    const radius = shape.radii[i];
    // Dans l'angle, HORS de l'arc : à moins de r·(1 − 1/√2) du coin sur la diagonale (0,2 r par axe).
    const inset = Math.min(2, radius * 0.14);
    const inside = at(cx + dx * inset, cy + dy * inset);
    const outside = at(cx - dx * 2.5, cy - dy * 2.5);
    const body = at(cx + dx * Math.max(radius, 8) * 0.75, cy + dy * Math.max(radius, 8) * 0.75);
    if (!inside || !outside || !body) return;
    const toOutside = dist(inside, outside);
    const toBody = dist(inside, body);
    // Rayon nul sur une forme dont les autres angles sont arrondis, ou angle peint comme le corps.
    const siblings = Math.max(...shape.radii);
    if (radius < 2 && siblings >= 6 && dist(body, outside) > 14) found.push({ corner: name, why: `rayon ${radius} px (les autres : ${siblings})`, inside, outside, body });
    else if (radius >= 10 && toOutside > 22 && toBody < toOutside) found.push({ corner: name, why: `angle peint (écart au dessous ${toOutside}, au corps ${toBody})`, inside, outside, body });
  });
  return found;
}
