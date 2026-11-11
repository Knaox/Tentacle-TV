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
    || el.matches("[data-lg-tone], [data-lg-scale], .lg-surface, .lgc-capsule, .lg-menu, .lg-sheet, .lg-pane, .lg-chip, .lg-pill, .lg-field, .lg-content-control, .lg-glass-btn, .lg-seg, .lg-segmented, .lg-panel, .lg-notice, .lg-bar, .lg-tray, .lg-disc, .lg-btn, .lg-toast");
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
