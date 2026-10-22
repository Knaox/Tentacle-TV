// Inventaire du verre à l'écran (corps de fonction évalué dans la page) :
// chaque élément visible qui floute son dessous ou porte un attribut du verre,
// avec ce qui viole les règles Apple du lot (verre dans le contenu, verre sur
// verre, bandes, teinte de marque hors action principale).
export const INVENTORY = `
  const vis = (n) => { const r = n.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(n).visibility !== "hidden"; };
  const blurOf = (n) => { const c = getComputedStyle(n); const b = c.backdropFilter || c.webkitBackdropFilter || "none"; return b === "none" ? null : b; };
  const label = (n) => (n.getAttribute("aria-label") || n.getAttribute("role") || "") + " " + String(n.className?.baseVal ?? n.className).slice(0, 70);
  const nodes = [...document.querySelectorAll("*")].filter((n) => vis(n) && (blurOf(n) || n.hasAttribute("data-lg-band") || n.hasAttribute("data-lg-tone") || n.hasAttribute("data-lg-scale")));
  const glass = nodes.filter((n) => blurOf(n));
  const inFunctional = (n) => !!n.closest('header, nav, [role="menu"], [role="dialog"], [role="listbox"], .lg-menu, .lg-sheet, .lgc-capsule, .lgc-sidebar, [data-lg-functional]');
  return {
    route: location.pathname,
    theme: document.documentElement.getAttribute("data-theme"),
    lg: document.documentElement.getAttribute("data-liquid-glass"),
    count: glass.length,
    glass: glass.map((n) => {
      const r = n.getBoundingClientRect();
      const c = getComputedStyle(n);
      let parentGlass = null;
      for (let p = n.parentElement; p; p = p.parentElement) if (blurOf(p)) { parentGlass = label(p).trim().slice(0, 50); break; }
      return {
        el: label(n).trim(), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        bf: blurOf(n).slice(0, 80), bg: c.backgroundColor, bgImg: c.backgroundImage === "none" ? null : c.backgroundImage.slice(0, 60),
        tone: n.getAttribute("data-lg-tone"), band: n.getAttribute("data-lg-band"), scale: n.getAttribute("data-lg-scale"),
        functional: inFunctional(n), glassOnGlass: parentGlass,
      };
    }),
    bands: [...document.querySelectorAll("[data-lg-band]")].filter(vis).length,
    toneHolders: nodes.filter((n) => n.hasAttribute("data-lg-tone")).map((n) => label(n).trim().slice(0, 50) + " → " + n.getAttribute("data-lg-tone")),
    brandGradients: [...document.querySelectorAll("button, a, [role=menuitem], [aria-current]")].filter(vis).filter((n) => /gradient/.test(getComputedStyle(n).backgroundImage) && /(139|168|236|217|192|147)/.test(getComputedStyle(n).backgroundImage)).map((n) => (n.textContent || n.getAttribute("aria-label") || "").trim().slice(0, 30)),
  };
`;
