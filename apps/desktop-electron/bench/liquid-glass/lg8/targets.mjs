// Banc lg8 — ce que la page montre et qu'on mesure, relevé SANS dépendre des
// classes du lecteur (la mise en page change en parallèle) :
//  - texte : chaque nœud texte visible (boîte du texte lui-même, pas de l'élément) ;
//  - glyphe : chaque <svg> visible qui n'est pas dans un autre ;
//  - barre : le remplissage de la barre de progression (`LG8_BAR`, sinon
//    `[data-lg8-bar]`, `.lgp-scrub__fill`, puis tout `[class*=scrub|seek][class*=fill]`)
//    et sa piste (le parent du remplissage).
// Les outils de débogage (compteur « cache », bouton DEBUG) sont MASQUÉS dans les
// deux captures : ils n'existent qu'en build instrumenté et fausseraient le titre.

const BAR_SELECTORS = [process.env.LG8_BAR, "[data-lg8-bar]", ".lgp-scrub__fill", "[class*='scrub'][class*='fill']", "[class*='seek'][class*='fill']"].filter(Boolean);

/** Corps de `page.evaluate` : marque les cibles, rend leurs boîtes en px CSS. */
export const COLLECT = `
  document.getElementById("lg8-style")?.remove();
  const style = document.createElement("style");
  style.id = "lg8-style";
  style.textContent = \`
    [data-lg8-debug] { visibility: hidden !important; }
    html[data-lg8-bare] [data-lg8-text] { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }
    html[data-lg8-bare] [data-lg8-glyph], html[data-lg8-bare] [data-lg8-rail], html[data-lg8-bare] [data-lg8-thumb] { visibility: hidden !important; }
  \`;
  document.head.append(style);
  for (const a of ["data-lg8-text", "data-lg8-glyph", "data-lg8-rail", "data-lg8-thumb"]) document.querySelectorAll("[" + a + "]").forEach((n) => n.removeAttribute(a));
  const shown = (el) => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      o *= Number(cs.opacity);
    }
    return o;
  };
  const inView = (r) => r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  const box = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
  const nameOf = (el) => (el.closest("[aria-label]")?.getAttribute("aria-label") ?? el.closest("[title]")?.getAttribute("title") ?? "").slice(0, 40);
  const debug = (el, text) => /^cache \\d/.test(text) || el.closest("[data-lg8-debug]") || /^DEBUG$/.test(text);
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\\s+/g, " ").trim();
    const el = n.parentElement;
    if (!text || !el || el.closest("script,style,noscript,title")) continue;
    if (debug(el, text)) {
      // Le bouton DEBUG est un <button> : on masque le bouton entier, le compteur aussi.
      (el.closest("button") ?? el).setAttribute("data-lg8-debug", "");
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!inView(r) || shown(el) < 0.5) continue;
    el.setAttribute("data-lg8-text", "");
    out.push({ kind: "texte", name: text.slice(0, 40), where: nameOf(el), box: box(r) });
  }
  for (const svg of document.querySelectorAll("svg")) {
    if (svg.parentElement?.closest("svg") || svg.closest("[data-lg8-debug]")) continue;
    const r = svg.getBoundingClientRect();
    if (!inView(r) || shown(svg) < 0.5) continue;
    svg.setAttribute("data-lg8-glyph", "");
    out.push({ kind: "glyphe", name: nameOf(svg) || "(sans nom)", box: box(r) });
  }
  let fill = null;
  for (const sel of ${JSON.stringify(BAR_SELECTORS)}) {
    fill = [...document.querySelectorAll(sel)].find((e) => inView(e.getBoundingClientRect()) && shown(e) >= 0.5) ?? null;
    if (fill) break;
  }
  if (fill) {
    const rail = fill.parentElement;
    rail.setAttribute("data-lg8-rail", "");
    const thumb = rail.parentElement?.querySelector("[class*='thumb']");
    thumb?.setAttribute("data-lg8-thumb", "");
    const f = fill.getBoundingClientRect();
    const t = rail.getBoundingClientRect();
    out.push({ kind: "barre", name: "barre (remplie)", box: box(f) });
    // La piste : la partie de la ligne APRÈS le remplissage (et le pouce).
    const start = Math.max(f.right + 12, t.x);
    if (t.right - start > 8) out.push({ kind: "barre", name: "barre (piste)", box: { x: start, y: t.y, w: t.right - start, h: t.height } });
  }
  return { viewport: [innerWidth, innerHeight], mode: document.documentElement.getAttribute("data-liquid-glass"), targets: out };
`;

export const SET_BARE = (on) => `document.documentElement.toggleAttribute("data-lg8-bare", ${on}); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return true;`;
