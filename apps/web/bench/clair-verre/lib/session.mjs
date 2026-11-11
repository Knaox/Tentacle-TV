/**
 * Le socle du banc « clair-verre » : un Chrome sans tête (muet), la session d'un compte de banc
 * posée par ses jetons d'appareil (jamais un mot de passe), le thème, et — à la demande — le pont
 * de la coquille SIMULÉ pour rendre le Liquid Glass de la page (la lentille de Chromium).
 *
 * Le verre NATIF (NSGlassEffectView, sous la vue web) ne se rend pas ici : seule la part peinte
 * par la page se juge dans ce banc.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { decodePng, luminance } from "./png.mjs";

export const ORIGIN = process.env.BANC_ORIGIN ?? "http://127.0.0.1:5413";
const TOKENS = process.env.BANC_TOKENS ?? join(homedir(), ".cache/tentacle-test/rf2/jetons/clair-verre.json");
const CDP_PORT = Number(process.env.BANC_CDP ?? 9413);

/** Le pont de la coquille, simulé : macOS 26, verre « supporté », l'échantillonneur branché sur le banc. */
const bridgeScript = () => `(() => {
  const noop = () => {}; noop.then = (r) => r(() => {});
  const ns = (name) => new Proxy(function () {}, {
    get(_t, p) { if (p === "then") return undefined; if (p === Symbol.toPrimitive) return () => ""; return ns(String(p)); },
    apply() { if (/^(on|subscribe|listen|watch|add)/i.test(name)) return noop; if (/version/i.test(name)) return Promise.resolve("1.41.0"); return Promise.resolve(null); },
  });
  const liquidGlass = {
    supported: true, refractsVideo: false, setEnabled() {}, upsert() {}, remove() {},
    sample: async (rects) => (window.__benchSample ? window.__benchSample(rects) : rects.map(() => null)),
  };
  window.tentacle = new Proxy({}, { get(_t, p) {
    if (p === "platform") return "darwin"; if (p === "liquidGlass") return liquidGlass; if (p === "then") return undefined;
    if (p === "version") return "1.41.0"; if (p === "titleBarHeight") return 28; return ns(String(p));
  } });
})();`;

/**
 * Ouvre un navigateur et un contexte connecté.
 * @param {{ theme?: "light"|"dark", glass?: boolean, shell?: boolean, width?: number, height?: number, account?: string }} options
 *   `glass` : pont simulé + réglage allumé (mode `native`) ; `shell` : pont simulé, réglage coupé (bureau sans verre).
 */
export async function openSession(options = {}) {
  const { theme = "light", glass = false, shell = glass, width = 1440, height = 900, account = "knaoxtest", scale = 1 } = options;
  const session = JSON.parse(readFileSync(TOKENS, "utf8"))[account];
  if (!session) throw new Error(`compte de banc inconnu : ${account}`);
  const browser = await chromium.launch({
    headless: true,
    // BANC_CDP=0 : aucun port (une seconde passe en parallèle de la première).
    args: ["--mute-audio", "--disable-audio-output", ...(CDP_PORT > 0 ? [`--remote-debugging-port=${CDP_PORT}`] : [])],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale: "fr-FR", colorScheme: theme });
  await context.addCookies([{ name: "tentacle_token", value: session.token, url: ORIGIN }]);
  const storage = {
    tentacle_token: session.token,
    tentacle_user: JSON.stringify(session.user),
    tentacle_theme_mode: theme,
    tentacle_liquid_glass: String(glass),
    // Le bureau demande l'adresse du serveur : celle du client de dev, qui relaie `/api` (même origine, même cookie).
    ...(shell ? { tentacle_server_url: ORIGIN } : {}),
  };
  await context.addInitScript(`(() => { try { const s = ${JSON.stringify(storage)}; for (const k in s) localStorage.setItem(k, s[k]); } catch {} })();`);
  if (shell) await context.addInitScript(bridgeScript());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (shell) {
    // L'échantillonneur de la coquille : la luminance médiane de la page PEINTE sous chaque rectangle.
    await page.exposeFunction("__benchSample", async (rects) => {
      try {
        const { data, width: w, height: h } = decodePng(await page.screenshot({ type: "png", scale: "css" }));
        return rects.map((rect) => medianLuminance(data, w, h, rect));
      } catch {
        return rects.map(() => null);
      }
    });
  }
  return { browser, context, page, errors, session };
}

function medianLuminance(data, width, height, rect) {
  const values = [];
  for (let iy = 0; iy < 16; iy++) {
    for (let ix = 0; ix < 16; ix++) {
      const x = Math.round(rect.x + ((ix + 0.5) * rect.width) / 16);
      const y = Math.round(rect.y + ((iy + 0.5) * rect.height) / 16);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const o = (y * width + x) * 4;
      values.push(luminance(data[o], data[o + 1], data[o + 2]));
    }
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

/** Va à une route et attend que la page se pose (requêtes, polices, images en fondu). */
export async function visit(page, route, settle = 1800, keepOverlays = false) {
  await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(settle);
  // La liaison vers Jellyfin (données mobiles + VPN) décroche par moments : le voile « hors ligne » n'est pas l'écran.
  for (let attempt = 0; attempt < 5 && (await offlineVeil(page)); attempt++) {
    await page.waitForTimeout(6000);
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(settle);
  }
  if (await offlineVeil(page)) throw new Error("serveur injoignable (voile hors ligne) : scène non mesurée");
  if (!keepOverlays) await dismissStartupOverlays(page);
}

/** Les recouvrements du démarrage (nouveautés, invitation à choisir une photo) : fermés, et dès lors « vus ». */
async function dismissStartupOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const close = page.locator('[role="dialog"] button[aria-label="Fermer"], [role="dialog"] button[aria-label="Close"]').first();
    if (!(await close.count())) return;
    await close.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
}

const offlineVeil = (page) => page.evaluate(() => [...document.querySelectorAll("div.fixed.inset-0 h1, div.fixed.inset-0 h2")].some((h) => /hors ligne|offline/i.test(h.textContent ?? "")));
