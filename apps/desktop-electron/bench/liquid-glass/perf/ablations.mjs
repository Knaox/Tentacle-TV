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
    // Les grands verres (menus, popovers : régime `surface`) sans lentille ; la barre garde la sienne.
    name: "menu-sans-lentille",
    css: `${N} [data-lg-scale="surface"], ${N} [data-lg-scale="surface"] * { --lg-lens: saturate(1) !important; --lgc-lens: saturate(1) !important; }`,
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
