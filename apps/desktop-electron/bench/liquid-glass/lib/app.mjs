// Parcours dans la page de l'app (par CDP) : premier lancement, connexion,
// navigation, et les sondes du verre côté DOM.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tape dans le champ `selector` (focus + insertText : React voit un vrai `input`). */
export async function typeInto(page, selector, text) {
  await page.waitFor(`document.querySelector(${JSON.stringify(selector)})`, 20_000, selector);
  await page.evaluate(`const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); return true;`);
  await page.send("Input.insertText", { text });
}

export async function submitForm(page, selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).closest("form").requestSubmit(); return true;`);
}

/** Écran « adresse du serveur » puis connexion. Idempotent : saute ce qui est fait. */
export async function connectAndLogin(page, { server, username, password }) {
  await page.waitFor(
    `document.querySelector('input[inputmode="url"], input[autocomplete="username"]') || localStorage.getItem("tentacle_user")`,
    30_000,
    "premier écran",
  );
  const state = await page.evaluate(`return {
    connect: !!document.querySelector('input[inputmode="url"]'),
    authed: !!localStorage.getItem("tentacle_user"),
  };`);
  if (state.authed) return;
  if (state.connect) {
    await typeInto(page, 'input[inputmode="url"]', server);
    await submitForm(page, 'input[inputmode="url"]');
  }
  await page.waitFor(`document.querySelector('input[autocomplete="username"]')`, 30_000, "écran de connexion");
  await typeInto(page, 'input[autocomplete="username"]', username);
  await typeInto(page, 'input[autocomplete="current-password"]', password);
  await submitForm(page, 'input[autocomplete="current-password"]');
  await page.waitFor(`localStorage.getItem("tentacle_user")`, 30_000, "session ouverte");
}

/** Navigue sans clic : React Router suit `popstate`. */
export async function go(page, route, settleMs = 1500) {
  await page.evaluate(`history.pushState({}, "", ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(settleMs);
}

/** Ferme ce qui recouvre au démarrage (nouveautés, invitation de photo…) par Échap. */
export async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(`return !!document.querySelector('[role="dialog"], [aria-modal="true"]');`);
    if (!open) return;
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(600);
  }
}

/**
 * Ce que la page dit du verre. Contrat (lg-tokens, `desktop/types.ts`) :
 * `window.tentacle.liquidGlass` absent = pas de natif ; `supported` figé au
 * démarrage ; `html[data-liquid-glass]` = le mode rendu par la page.
 */
export async function glassDom(page) {
  return page.evaluate(`
    const bridge = window.tentacle?.liquidGlass;
    const nodes = [...document.querySelectorAll("[data-liquid-glass], [data-lg-region], [data-glass-region]")];
    const visible = nodes.filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const css = getComputedStyle(document.documentElement);
    const tokens = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .flatMap((r) => r.style ? [...r.style].filter((p) => p.startsWith("--lg-")) : []);
    return {
      bridge: bridge ? { present: true, supported: bridge.supported, keys: Object.keys(bridge) } : { present: false },
      htmlAttr: document.documentElement.getAttribute("data-liquid-glass"),
      theme: document.documentElement.getAttribute("data-theme") ?? document.documentElement.className,
      glassNodes: nodes.length,
      glassNodesVisible: visible.length,
      lgTokens: [...new Set(tokens)].length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      htmlBg: css.backgroundColor,
      reducedTransparency: matchMedia("(prefers-reduced-transparency: reduce)").matches,
      moreContrast: matchMedia("(prefers-contrast: more)").matches,
      // Chrome de fenêtre (lg-chrome) et matériau (lg-physique).
      attrs: Object.fromEntries(["data-lg-material", "data-window-inactive", "data-native-playback"]
        .map((a) => [a, document.documentElement.getAttribute(a)])),
      edge: document.querySelectorAll(".lgc-edge").length,
      surfaces: document.querySelectorAll(".lg-surface").length,
      lenses: document.querySelectorAll('[data-lg-render="lens"]').length,
      bandeau: (() => { const b = document.querySelector(".bandeau-hote"); return b ? getComputedStyle(b).backgroundColor : null; })(),
      // Barre du haut : depuis la refonte (22/10), des GROUPES en lentille dans la capsule.
      capsuleLenses: document.querySelector(".lgc-capsule") ? document.querySelectorAll('.lgc-capsule .lg-surface[data-lg-render="lens"]').length : null,
      // Une modale « position: fixed » sous un ancêtre à transform / filter /
      // backdrop-filter n'a plus le viewport pour référence : elle est
      // confinée à cet ancêtre (défaut du 21/10 : dialogue dans la capsule).
      // Les briques de lg-composants présentes à l'écran (recensement, pas d'attente).
      lgClasses: Object.fromEntries([".lg-btn", ".lg-btn-media", ".lg-capsule-media", ".lg-btn-primary", ".lg-pill", ".lg-chip", ".lg-field", ".lg-badge", ".lg-notice", ".lg-panel", ".lg-bar", ".lg-menu", ".lg-sheet", ".lg-disc", ".lg-tray", ".lg-segmented", ".ctl-switch", "[data-lgc-lens]"]
        .map((c) => [c, document.querySelectorAll(c).length]).filter(([, n]) => n > 0)),
      trappedModals: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], .lg-sheet')].flatMap((m) => {
        for (let n = m.parentElement; n && n !== document.body; n = n.parentElement) {
          const c = getComputedStyle(n);
          const r = n.getBoundingClientRect();
          const fullViewport = r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight;
          if (!fullViewport && (c.transform !== "none" || c.filter !== "none" || c.backdropFilter !== "none")) {
            return [{ modal: (m.getAttribute("aria-label") ?? m.className).slice(0, 60), ancestor: String(n.className).slice(0, 60), backdrop: c.backdropFilter.slice(0, 40), transform: c.transform.slice(0, 30) }];
          }
        }
        return [];
      }),
      sidebar: (() => { const n = document.querySelector("nav.lgc-sidebar"); return n ? { selection: !!n.querySelector("span.lgc-sidebar-selection") } : null; })(),
      dark: matchMedia("(prefers-color-scheme: dark)").matches,
    };
  `);
}

/**
 * L'interrupteur du verre dans Réglages › Apparence. Cherché par son texte
 * (« Liquid Glass ») : le banc ne dépend pas d'un identifiant que la page
 * n'aurait pas encore. Rend { found, checked, label }.
 */
export async function glassToggle(page) {
  return page.evaluate(`
    const all = [...document.querySelectorAll('[role="switch"], input[type="checkbox"], button[aria-pressed], button[aria-checked]')];
    const match = all.find((el) => {
      const box = el.closest("label, li, section, div[class]") ?? el;
      return /liquid\\s*glass/i.test(box.textContent ?? "") || /liquid\\s*glass/i.test(el.getAttribute("aria-label") ?? "");
    });
    if (!match) return { found: false, mentions: /liquid\\s*glass/i.test(document.body.innerText) };
    const checked = match.getAttribute("aria-checked") ?? match.getAttribute("aria-pressed") ?? String(match.checked);
    return { found: true, checked: checked === "true", label: (match.closest("label, li, div")?.textContent ?? "").trim().slice(0, 120) };
  `);
}

export async function clickGlassToggle(page) {
  return page.evaluate(`
    const all = [...document.querySelectorAll('[role="switch"], input[type="checkbox"], button[aria-pressed], button[aria-checked]')];
    const match = all.find((el) => /liquid\\s*glass/i.test((el.closest("label, li, section, div[class]") ?? el).textContent ?? ""));
    if (!match) return false;
    match.click();
    return true;
  `);
}

/** Émule « Réduire la transparence » et le thème, côté PAGE seulement. */
export async function emulateMedia(page, { dark, reducedTransparency, reducedMotion, moreContrast } = {}) {
  const features = [];
  if (dark !== undefined) features.push({ name: "prefers-color-scheme", value: dark ? "dark" : "light" });
  if (reducedTransparency !== undefined) {
    features.push({ name: "prefers-reduced-transparency", value: reducedTransparency ? "reduce" : "no-preference" });
  }
  if (moreContrast !== undefined) features.push({ name: "prefers-contrast", value: moreContrast ? "more" : "no-preference" });
  if (reducedMotion !== undefined) features.push({ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" });
  await page.send("Emulation.setEmulatedMedia", { features });
}

/** Lecture d'une propriété mpv (pont du lecteur). */
export async function mpvProperty(page, name) {
  return page.evaluate(`try { return await window.tentacle.invoke("mpv_get_property", { name: ${JSON.stringify(name)} }); } catch (e) { return "ERREUR " + String(e); }`);
}

export { sleep };
