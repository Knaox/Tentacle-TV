// Banc de fluidité (lot lg5) : les ablations d'`ablate.mjs`. Chacune RETIRE un
// effet (feuille injectée, `!important` : l'emporte sur le style en ligne des
// lentilles) ; aucune n'est une proposition de rendu — c'est un instrument de
// mesure, pour savoir où va le dessin GPU.
const N = 'html[data-liquid-glass="native"]';

/**
 * Variante appliquée aux filtres de lentille par un MutationObserver (les
 * menus en créent à chaque ouverture). `mutate` : corps de fonction (filtre).
 */
const filterPatch = (mutate) => `
  const patch = (f) => { if (f.dataset.lg5 || !f.querySelector("feDisplacementMap")) return; f.dataset.lg5 = "1"; ${mutate} };
  document.querySelectorAll("filter").forEach(patch);
  window.__lg5Mo?.disconnect();
  window.__lg5Mo = new MutationObserver(() => document.querySelectorAll("filter:not([data-lg5])").forEach(patch));
  window.__lg5Mo.observe(document.body, { childList: true, subtree: true });`;

/** `count` lentilles de test, posées sur le héros, avec le filtre de la première lentille de la page. */
function injectLenses(count, width, height, origin = null) {
  return `const src = document.querySelector("[style*='--lg-lens']");
    const lens = src?.style.getPropertyValue("--lg-lens");
    for (let i = 0; i < ${count}; i += 1) {
      const d = document.createElement("div");
      d.className = "lg5-test-lens";
      d.style.cssText = "position:fixed;z-index:5;pointer-events:none;border-radius:18px;left:" + ${origin ? `(${origin[0]} + (i % 5) * ${width + 6})` : "(40 + (i % 3) * 700)"} + "px;top:" + ${origin ? `(${origin[1]} + Math.floor(i / 5) * ${height + 6})` : `(160 + Math.floor(i / 3) * ${height + 12})`} + "px;width:${width}px;height:${height}px;backdrop-filter:blur(4px) saturate(1.2) " + lens;
      document.body.append(d);
    }`;
}

export const ABLATIONS = [
  { name: "reference", css: "" },
  {
    // La lentille SVG (`url(#…)` : déplacement + lumière du bord) remplacée par un filtre neutre.
    name: "sans-lentille",
    css: `${N} * { --lg-lens: saturate(1) !important; --lgc-lens: saturate(1) !important; --lgc-refract: saturate(1) !important; }`,
  },
  {
    // La lentille SANS la lumière du bord (second feImage + feComposite retirés).
    name: "sans-lumiere",
    css: "",
    js: filterPatch(`f.querySelectorAll('feImage[result="light"]').forEach((n) => { n.nextElementSibling?.remove(); n.remove(); });`),
  },
  {
    // La lentille SANS la réfraction : la carte de déplacement remplacée par un décalage nul.
    name: "sans-deplacement",
    css: "",
    js: filterPatch(`f.querySelectorAll("feDisplacementMap").forEach((d) => { const o = document.createElementNS("http://www.w3.org/2000/svg", "feOffset"); o.setAttribute("in", "SourceGraphic"); o.setAttribute("result", d.getAttribute("result")); d.replaceWith(o); }); f.querySelectorAll('feImage[result="map"]').forEach((n) => n.remove());`),
  },
  {
    // Mêmes filtres, cartes de 2 × 2 px (étirées) : le filtre fait le même
    // travail, il n'y a presque plus d'image à envoyer. Coût d'IMAGE ou de CALCUL ?
    name: "cartes-2x2",
    css: "",
    js: filterPatch(`const tiny = (r, g, b, a) => { const c = document.createElement("canvas"); c.width = c.height = 2; const x = c.getContext("2d"); x.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")"; x.fillRect(0, 0, 2, 2); return c.toDataURL(); };
      f.querySelectorAll('feImage[result="map"]').forEach((n) => n.setAttribute("href", tiny(128, 128, 128, 1)));
      f.querySelectorAll('feImage[result="light"]').forEach((n) => n.setAttribute("href", tiny(255, 255, 255, 0.02)));`),
  },
  {
    // Une SEULE carte (la lumière lue dans la carte de déplacement par une
    // matrice de couleur) : le coût d'un second feImage. Rendu faux, coût juste.
    name: "une-carte",
    css: "",
    js: filterPatch(`f.querySelectorAll('feImage[result="light"]').forEach((n) => { const m = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix"); m.setAttribute("in", "map"); m.setAttribute("type", "matrix"); m.setAttribute("values", "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 0"); m.setAttribute("result", "light"); n.replaceWith(m); });`),
  },
  {
    // Lentilles de la barre seules retirées (le héros garde les siennes).
    name: "sans-lentille-barre",
    css: `${N} .lgc-capsule, ${N} .lgc-capsule * { --lg-lens: saturate(1) !important; --lgc-lens: saturate(1) !important; }`,
  },
  {
    // La lentille réservée à la barre et aux grands verres : les boutons posés sur le héros en givre seul.
    name: "heros-sans-lentille",
    // En CSS : les boutons du héros sont RECRÉÉS à chaque diapositive (un patch en JS ne tient pas).
    css: `${N} .lg-surface:not(.lgc-capsule *):not([data-lg-scale="surface"]) { --lg-lens: saturate(1) !important; }`,
  },
  {
    // Le cadre du héros sans son découpage arrondi (instrument : le dessin déborde des coins).
    name: "heros-sans-decoupe",
    css: '[class*="group/billboard"] { overflow: visible !important; }',
  },
  {
    // Les grands verres (menus, popovers : régime `surface`) sans lentille ; la barre garde la sienne.
    name: "menu-sans-lentille",
    css: `${N} [data-lg-scale="surface"], ${N} [data-lg-scale="surface"] * { --lg-lens: saturate(1) !important; --lgc-lens: saturate(1) !important; }`,
  },
  {
    // Le halo « ambilight » du héros masqué (un filtre CSS flou sur une grande image).
    name: "sans-halo",
    css: ".hero-halo-zoom { display: none !important; }",
  },
  {
    // Les grands verres sans AUCUN backdrop-filter (ni givre ni lentille).
    name: "menu-sans-givre",
    css: `${N} [data-lg-scale="surface"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  },
  {
    // Les groupes de la barre sans AUCUN backdrop-filter.
    name: "barre-sans-givre",
    css: `${N} .lgc-capsule, ${N} .lgc-capsule * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  },
  {
    // Les petites lentilles (≤ 60 px : boutons ronds du héros) seules retirées.
    name: "petites-sans-lentille",
    css: `${N} .lg-surface.h-9.w-9 { --lg-lens: saturate(1) !important; }`,
  },
  {
    // Loi d'échelle : 10 lentilles de 36 px de PLUS sur le héros (même filtre qu'une vraie).
    name: "plus-10-petites",
    css: "",
    js: injectLenses(10, 36, 36),
  },
  {
    // Loi de POSITION : les mêmes 10 petites, groupées en haut à gauche…
    name: "plus-10-haut-gauche",
    css: "",
    js: injectLenses(10, 36, 36, [90, 90]),
  },
  {
    // … ou en bas à droite.
    name: "plus-10-bas-droite",
    css: "",
    js: injectLenses(10, 36, 36, [1020, 650]),
  },
  {
    // … ou UNE lentille de plus, de la taille d'un groupe de la barre.
    name: "plus-1-grande",
    css: "",
    js: injectLenses(1, 655, 48),
  },
  {
    // … ou 10 GRANDES (le coût suit-il la surface ?).
    name: "plus-10-grandes",
    css: "",
    js: injectLenses(10, 655, 48),
  },
  {
    // Le menu « Plus » sans ses images (tuiles des bibliothèques).
    name: "plus-sans-images",
    css: ".lg-more img { visibility: hidden !important; }",
  },
  {
    // Le menu « Plus » sans défilement propre (plus de calque de défilement).
    name: "plus-sans-defilement",
    css: ".lg-more { overflow: visible !important; }",
  },
  {
    // MÊME rendu : chaque primitive reçoit sa sous-région explicite (celle du filtre).
    name: "sous-regions",
    css: "",
    js: filterPatch(`const w = f.getAttribute("width"), h = f.getAttribute("height");
      f.querySelectorAll("feDisplacementMap, feComposite, feColorMatrix").forEach((p) => { p.setAttribute("x", "0"); p.setAttribute("y", "0"); p.setAttribute("width", w); p.setAttribute("height", h); });`),
  },
  {
    // Aucune mesure du ton (la coquille répond tout de suite, sans capture) — `main` : côté principal.
    name: "sans-mesure-ton",
    css: "",
    main: `const { ipcMain } = require("electron"); const ch = "tentacle:liquid-glass-sample";
      globalThis.__lg5SampleOrig ??= ipcMain._invokeHandlers.get(ch);
      ipcMain._invokeHandlers.set(ch, async () => []);`,
    mainUndo: `const { ipcMain } = require("electron"); if (globalThis.__lg5SampleOrig) ipcMain._invokeHandlers.set("tentacle:liquid-glass-sample", globalThis.__lg5SampleOrig);`,
  },
  {
    // Instrument : la taille de chaque capture du ton (`capturePage`), rendue par `report`.
    name: "compte-captures",
    css: "",
    main: `const { BrowserWindow } = require("electron"); globalThis.__lg5Caps = [];
      for (const w of BrowserWindow.getAllWindows()) { const wc = w.webContents; if (wc.__lg5) continue; wc.__lg5 = true; const orig = wc.capturePage.bind(wc);
        wc.capturePage = async (rect, ...rest) => { const t = performance.now(); const img = await orig(rect, ...rest); globalThis.__lg5Caps.push({ w: rect?.width, h: rect?.height, ms: Math.round(performance.now() - t) }); return img; }; }`,
    report: `return globalThis.__lg5Caps;`,
  },
  {
    // La couche floutée sous la barre (bord de défilement adouci).
    name: "sans-bord",
    css: `${N} .lgc-edge::before { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  },
  {
    // Les ombres des glyphes (texte et icônes) dans le verre.
    name: "sans-ombres",
    css: `${N} * { text-shadow: none !important; } ${N} svg { filter: none !important; }`,
  },
  {
    // TOUTES les animations CSS figées (travelling, halo, jauge du héros) ; les menus (framer) bougent encore.
    name: "css-fige",
    css: "*, *::before, *::after { animation-play-state: paused !important; }",
  },
  {
    // Le travelling du héros arrêté : ce que coûte un dessous qui bouge.
    name: "heros-fige",
    css: ".hero-zoom, .hero-halo-zoom { animation: none !important; }",
  },
  {
    // Plancher : aucun backdrop-filter du tout.
    name: "sans-givre",
    css: `${N} *, ${N} *::before, ${N} *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  },
];
