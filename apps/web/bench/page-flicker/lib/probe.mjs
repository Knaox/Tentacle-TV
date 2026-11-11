/**
 * La sonde posée DANS la page : à chaque image du fil principal, ce que le document contient —
 * l'anneau d'attente d'une page, la barre, les enveloppes de page et leur opacité, les cartes à
 * l'écran et celles dont l'image n'est pas peinte. Le screencast dit ce que l'écran a montré ;
 * la sonde dit POURQUOI.
 *
 * Elle lit en FIN d'image, pas au début : un `ResizeObserver` (sur un témoin dont la taille
 * bascule à chaque image) est rappelé après TOUS les `requestAnimationFrame` et le calcul des
 * styles, juste avant la peinture. Lue au début, une page qui finit sa sortie paraît revenue à
 * pleine opacité pendant une image — framer-motion annule son animation native avant d'écrire
 * la valeur finale, dans la même image — alors que rien de tel n'est peint.
 *
 * Écrite comme une fonction sérialisée : elle ne lit rien de son module.
 */
export function installProbe() {
  if (window.__flickerProbe) return;
  const now = () => performance.timeOrigin + performance.now();
  const onScreen = (el) => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  };
  const opacityOf = (el) => {
    let value = 1;
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none") return 0;
      value *= Number(style.opacity);
    }
    return value;
  };
  const read = () => {
    // L'anneau plein écran d'une page qui attend (`PageSpinner`, repli de `Suspense`, fiche en attente).
    const spinners = [...document.querySelectorAll(".animate-spin")].filter((el) => onScreen(el) && opacityOf(el) > 0.05).length;
    const header = document.querySelector("header");
    // Les enveloppes de page (`RouteExit`) : une page en place, une page qui sort (épinglée).
    // Une enveloppe DANS une page qui sort (la section sous la barre d'une coquille quittée) sort avec elle.
    const leaving = (el) => {
      for (let node = el; node; node = node.parentElement) if (node.style?.position === "fixed" && node.classList.contains("flow-root")) return true;
      return false;
    };
    const pages = [...document.querySelectorAll("div.flow-root")].map((el) => ({
      // Une page qui se prépare cachée, pendant que celle qu'on quitte reste à l'écran.
      held: el.closest("[data-page-held]") !== null,
      pinned: leaving(el),
      opacity: Math.round(opacityOf(el) * 100) / 100,
      empty: el.childElementCount === 0 || el.getBoundingClientRect().height < 4,
    }));
    const cards = [...document.querySelectorAll("[data-card-visual]")].filter(onScreen);
    const unpainted = cards.filter((card) => {
      const img = card.querySelector("img");
      return !img || !img.complete || img.naturalWidth === 0 || opacityOf(img) < 0.99;
    }).length;
    const overlay = document.querySelector("body > div.fixed.inset-0.z-\\[60\\]");
    return {
      t: now(),
      player: location.pathname.startsWith("/watch/") ? 1 : 0,
      path: location.pathname + location.search,
      spinners,
      nav: header ? Math.round(opacityOf(header) * 100) / 100 : -1,
      pages,
      cards: cards.length,
      unpainted,
      overlay: overlay ? 1 : 0,
      text: (document.querySelector("main, .lg-page, .lg-detail")?.textContent ?? "").length,
    };
  };
  const state = { running: false, frames: [], marks: [] };
  const witness = document.createElement("div");
  witness.style.cssText = "position:fixed;left:-9px;top:-9px;width:1px;height:1px;pointer-events:none;visibility:hidden";
  document.documentElement.appendChild(witness);
  let flip = false;
  new ResizeObserver(() => {
    if (!state.running) return;
    try { state.frames.push(read()); } catch (error) { state.frames.push({ t: now(), error: String(error) }); }
  }).observe(witness);
  const tick = () => {
    if (!state.running) return;
    flip = !flip;
    witness.style.width = flip ? "2px" : "1px";
    requestAnimationFrame(tick);
  };
  window.__flickerProbe = {
    start() {
      state.frames = [];
      state.marks = [];
      state.running = true;
      requestAnimationFrame(tick);
    },
    mark(label) { state.marks.push({ t: now(), label }); },
    stop() {
      state.running = false;
      return { frames: state.frames, marks: state.marks };
    },
    /** Navigue sans recharger : le routeur de l'application écoute `popstate`. */
    go(path) {
      state.marks.push({ t: now(), label: `go ${path}` });
      history.pushState({ idx: (history.state?.idx ?? 0) + 1, key: Math.random().toString(36).slice(2, 10), usr: null }, "", path);
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    },
  };
  // Le geste qui lance la transition : l'instant du pointeur enfoncé, vu de la page.
  addEventListener("pointerdown", () => state.running && state.marks.push({ t: now(), label: "pointerdown" }), true);
  addEventListener("click", () => state.running && state.marks.push({ t: now(), label: "click" }), true);
}
