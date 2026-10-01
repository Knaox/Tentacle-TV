// Une capture du client web, telle qu'un appareil la voit : gabarit (CSS px ×
// densité), tactile ou souris, session de démonstration posée dans le
// stockage, puis la page, attendue jusqu'au repos (réseau, images, polices).
import fs from "node:fs";
import path from "node:path";
import { installCaptureCss } from "./captureCss.mjs";
import { DEMO_USER_ID, loadLibrary } from "./library.mjs";

// Des agents de navigateur ordinaires : le web en tire ses libellés de
// raccourci (⌘K sur Apple, Ctrl+K ailleurs) — jamais celui d'Electron.
const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  // iPadOS se présente en Safari « Macintosh » : le miroir le reconnaît au toucher.
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

/** Les appareils de la vitrine. `touch` : le web y devient le miroir de l'app. */
export const DEVICES = {
  // iPhone 6,9 pouces (16/17 Pro Max) : 440×956 pt → 1320×2868.
  iphone: { width: 440, height: 956, scale: 3, touch: true, userAgent: UA.iphone },
  // iPad Pro 13 pouces : 1032×1376 pt → 2064×2752 (portrait).
  ipad: { width: 1032, height: 1376, scale: 2, touch: true, userAgent: UA.ipad },
  // Le même iPad en paysage : 1376×1032 pt → 2752×2064 (l'App Store prend les deux sens).
  ipadLandscape: { width: 1376, height: 1032, scale: 2, touch: true, userAgent: UA.ipad },
  // Tablette Android en paysage 16:9 (fiche Play) : 1280×720 → 2560×1440.
  tablet: { width: 1280, height: 720, scale: 2, touch: true, userAgent: UA.android },
  // Bureau 16:10 (Mac App Store, site) et 16:9 (Microsoft Store, GitHub).
  mac: { width: 1440, height: 900, scale: 2, touch: false, userAgent: UA.mac },
  windows: { width: 1920, height: 1080, scale: 2, touch: false, userAgent: UA.windows },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * L'horloge des animations JS, arrêtable : une animation pilotée par
 * `requestAnimationFrame` (framer-motion) redemande une image en continu, et à
 * haute densité la capture n'aboutit jamais. Figer = garder les rappels en
 * attente ; l'écran reste celui du moment, rien n'est retouché.
 */
const SEED = Number(process.env.VITRINE_SEED ?? 20261001) >>> 0;
const CLOCK_SCRIPT = `(() => {
  // Le hasard de l'app (vedette de « Pour vous », mélanges) devient
  // déterministe : une graine fixe, la même capture à chaque passage.
  let s = ${SEED};
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const raf = window.requestAnimationFrame.bind(window);
  const held = [];
  window.__vitrineFrozen = false;
  window.requestAnimationFrame = (cb) => (window.__vitrineFrozen ? (held.push(cb), 0) : raf(cb));
  window.__vitrineThaw = () => { window.__vitrineFrozen = false; held.splice(0).forEach((cb) => raf(cb)); };
})();`;

/** Suit les requêtes en vol : le réseau est « au repos » sans requête depuis `quietMs`. */
function networkWatch(page) {
  const inflight = new Map();
  let last = Date.now();
  const failures = [];
  const touch = () => (last = Date.now());
  page.on("Network.requestWillBeSent", (p) => (inflight.set(p.requestId, p.request.url), touch()));
  page.on("Network.loadingFinished", (p) => (inflight.delete(p.requestId), touch()));
  page.on("Network.loadingFailed", (p) => {
    const url = inflight.get(p.requestId);
    inflight.delete(p.requestId);
    if (url && !p.canceled) failures.push(`${p.errorText} ${url}`);
    touch();
  });
  page.on("Network.responseReceived", (p) => {
    if (p.response.status >= 400 && !/\/Images\//.test(p.response.url)) failures.push(`${p.response.status} ${p.response.url}`);
    // Un appel d'API dont l'app ne lit que l'en-tête (sondes, 404) ne « finit »
    // jamais pour Chrome : la réponse reçue suffit. Les images, elles, vont au bout.
    if (p.type === "Fetch" || p.type === "XHR") {
      inflight.delete(p.requestId);
      touch();
    }
  });
  return {
    failures,
    /** Les requêtes encore en vol (diagnostic d'une attente qui n'aboutit pas). */
    pending: () => [...inflight.values()],
    /** À la navigation : les requêtes de la page quittée ne finiront jamais. */
    reset: () => {
      inflight.clear();
      touch();
    },
    // Un flux vidéo ou un socket restent ouverts : ils ne comptent pas.
    async idle(quietMs = 700, timeoutMs = 20_000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        // Les sondes de connectivité (périodiques) et les flux vidéo ne comptent pas.
        const busy = [...inflight.values()].filter((url) => !/\/Videos\/|\/api\/ws|\.mp4|\/api\/health|System\/Info\/Public/.test(url));
        if (busy.length === 0 && Date.now() - last > quietMs) return true;
        await sleep(100);
      }
      if (process.env.VITRINE_DEBUG) console.log("réseau jamais au repos :", [...inflight.values()]);
      return false;
    },
  };
}

/** Prépare l'onglet (déjà à la taille de l'appareil, cf. engine.mjs) pour
 *  une langue : tactile si l'appareil l'est, session de démo comprise. */
export async function prepare(page, { device, origin, lang }) {
  const spec = DEVICES[device];
  if (!spec) throw new Error(`appareil inconnu : ${device}`);
  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("Runtime.enable");
  await installCaptureCss(page);
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Emulation.setUserAgentOverride", { userAgent: spec.userAgent });
  // Un doigt : « pointer: coarse » et « hover: none », d'où le miroir de l'app.
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: spec.touch, maxTouchPoints: 5 });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await page.send("Animation.enable");
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK_SCRIPT });
  const watch = networkWatch(page);
  const user = loadLibrary(lang).user;
  // Un fichier statique de la même origine : le stockage se pose sans démarrer l'app.
  await page.send("Page.navigate", { url: `${origin}/tentacle.svg` });
  await sleep(300);
  await page.evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem("tentacle_user", ${JSON.stringify(JSON.stringify(user))});
    localStorage.setItem("tentacle_token", "vitrine-demo");
    localStorage.setItem("disclaimer_accepted", "true");
    localStorage.setItem("tentacle_language", ${JSON.stringify(lang)});
    // Économie de données coupée (réglage de l'appareil) : sinon une sonde lente
    // l'allume au hasard — pastille dans l'en-tête, images en basse qualité.
    localStorage.setItem("tentacle_data_saver", "off");
    return true;
  })()`);
  return { spec, watch, userId: DEMO_USER_ID };
}

/** Va à une route et attend le repos : réseau, polices, images, animations. */
export async function open(page, watch, origin, route, { settleMs = 1200 } = {}) {
  watch.reset();
  await page.send("Page.navigate", { url: `${origin}${route}` });
  await settle(page, watch, { settleMs });
}

/** Le repos de la page : réseau, polices, images visibles décodées, plus
 *  aucune animation CSS en cours, puis `settleMs` (fondus pilotés en JS). */
export async function settle(page, watch, { settleMs = 1200 } = {}) {
  await watch.idle();
  await page.evaluate(`Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 5000))])`);
  await settleImages(page);
  await page.evaluate(`(async () => {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity);
      if (running.length === 0) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  })()`);
  await sleep(settleMs);
}

/** Attend que les images visibles soient décodées (une affiche à moitié chargée ne part pas). */
export async function settleImages(page, timeoutMs = 3_000) {
  return page.evaluate(`(async () => {
    const visible = (img) => { const r = img.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
    const start = Date.now();
    while (Date.now() - start < ${timeoutMs}) {
      // Une image paresseuse jamais lancée (currentSrc vide) ne viendra pas : on ne l'attend pas.
      const pending = [...document.images].filter((img) => visible(img) && !img.complete && img.currentSrc !== "");
      if (pending.length === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Une image jamais chargée ne doit pas bloquer la capture : décodage borné.
    const decoded = Promise.all([...document.images].filter((img) => visible(img) && img.complete && img.naturalWidth > 0).map((img) => img.decode?.().catch(() => {})));
    await Promise.race([decoded, new Promise((r) => setTimeout(r, 3000))]);
    return true;
  })()`);
}

/** Fige le temps (animations JS et CSS) : l'écran ne bouge plus. */
export async function freeze(page) {
  await page.evaluate(`(window.__vitrineFrozen = true)`);
  await page.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await sleep(250);
}

/** Relance le temps après une capture (pour enchaîner des gestes). */
export async function thaw(page) {
  await page.send("Animation.setPlaybackRate", { playbackRate: 1 });
  await page.evaluate(`(window.__vitrineThaw?.(), true)`);
}

/** La capture de la fenêtre hors écran, en PNG à la densité de l'appareil,
 *  temps figé. Il le reste ensuite : `thaw` avant d'enchaîner d'autres gestes. */
export async function screenshot(page, file) {
  await freeze(page);
  const png = await page.capture();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  return file;
}
