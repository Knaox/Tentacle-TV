/**
 * Ce que le banc relève DANS la page (`page.evaluate`) : chaque texte, chaque texte d'invite et chaque
 * pictogramme visible du viewport — sa couleur, ses boîtes, son chemin, et ce qui le recouvre. Une fonction
 * autonome : elle est sérialisée telle quelle vers la page, rien d'extérieur n'y est lu.
 *
 * Écartés ici : un texte rogné par un ancêtre, recouvert par un calque flottant (barre fixe, menu, modale,
 * voile qui ne prend pas le pointeur, calque positionné translucide), posé sous une image, un contrôle
 * inactif, un séparateur. La mesure elle-même — au pixel, sur la capture — est dans `contrast.mjs`.
 */

/** Dans la page : relève les textes et pictogrammes visibles du viewport (couleur, boîtes, chemin). */
export const COLLECT = () => {
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
  // Les calques FIXES qui peignent sans capter le pointeur (l'effet de bord de défilement sous la barre, un voile) :
  // `elementFromPoint` ne les voit pas, mais ce qui défile dessous est vu À TRAVERS eux.
  const painted = (s) => (s.backgroundImage && s.backgroundImage !== "none") || (s.backdropFilter && s.backdropFilter !== "none")
    || (s.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor));
  const veils = [...document.querySelectorAll("body *")].filter((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" || s.pointerEvents !== "none" || s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.05) return false;
    const before = getComputedStyle(el, "::before");
    const after = getComputedStyle(el, "::after");
    return painted(s) || (before.content !== "none" && painted(before)) || (after.content !== "none" && painted(after));
    // Une BANDE posée au-dessus du contenu (z-index positif) — pas un fond plein écran peint dessous (le fond ambiant).
  }).map((el) => ({ el, r: el.getBoundingClientRect(), z: Number(getComputedStyle(el).zIndex) || 0 }))
    .filter(({ r, z }) => z > 0 && r.width > 40 && r.height > 12 && r.height < innerHeight * 0.6);
  const coverAt = (node, cx, cy) => {
    for (const { el, r, z } of veils) {
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom || el.contains(node) || node.contains(el)) continue;
      // Ce qui flotte lui-même AU-DESSUS du voile (la barre du haut sur son effet de bord) n'est pas dessous.
      let above = false;
      for (let up = node; up && up !== document.body; up = up.parentElement) {
        const us = getComputedStyle(up);
        if ((us.position === "fixed" || us.position === "sticky") && (Number(us.zIndex) || 0) >= z) { above = true; break; }
      }
      if (!above) return "layer";
    }
    const top = document.elementFromPoint(cx, cy);
    if (!top || top === node || node.contains(top) || top.contains(node)) return null;
    // Des initiales de repli SOUS un portrait, un titre sous son affiche : l'image les remplace.
    if (top.matches("img, video, canvas, picture")) return "layer";
    let solid = false;
    for (let el = top; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky" || el.matches('[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]')) {
        return el.contains(node) ? "other" : "layer";
      }
      // Un calque POSITIONNÉ et peint franchement, étranger au texte (le lecteur d'Octave, translucide, posé en
      // `absolute` sur la page qui défile) : le texte dessous se devine à travers, il ne se lit pas.
      if (el.contains(node)) continue;
      const alpha = Number(/rgba?\([^)]*?,\s*([0-9.]+)\)$/.exec(style.backgroundColor)?.[1] ?? (/^rgb\(/.test(style.backgroundColor) ? 1 : 0));
      solid ||= (style.backdropFilter && style.backdropFilter !== "none") || alpha >= 0.5;
      if (solid && style.position === "absolute" && (Number(style.zIndex) || 0) > 0) return "layer";
    }
    return "other";
  };
  // Le centre, puis les quatre bords : un texte À MOITIÉ glissé sous une barre fixe (le lecteur d'Octave) n'est
  // pas lisible en entier — ses points du bas se mesureraient sur la barre.
  const coverOf = (node, [x, y, w, h]) => {
    const center = coverAt(node, x + w / 2, y + h / 2);
    if (center === "layer") return center;
    const edges = [[x + w / 2, y + 1], [x + w / 2, y + h - 1], [x + 1, y + h / 2], [x + w - 1, y + h / 2]];
    return edges.some(([px, py]) => coverAt(node, px, py) === "layer") ? "layer" : center;
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
    // Un pictogramme rogné par un ancêtre qui défile (la rangée suivante d'une liste) ne se voit pas en entier.
    const shown = intersect(r, clipOf(svg));
    if (!shown || shown.width < r.width - 1 || shown.height < r.height - 1) continue;
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
