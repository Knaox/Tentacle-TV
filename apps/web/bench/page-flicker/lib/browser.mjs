/**
 * Le navigateur du banc : un Chromium sans tête lancé ici, ou un navigateur déjà ouvert (CEF)
 * rejoint par son port CDP. La session est celle d'un fichier de jetons préparé hors dépôt —
 * jamais affichée, jamais écrite ailleurs que dans la page.
 */

import { readFileSync } from "node:fs";

import { chromium } from "playwright-core";

/** Son coupé, toujours ; capot fermé : sans `--disable-audio-output`, l'horloge média de Chrome cale. */
const MUTED = ["--mute-audio", "--disable-audio-output"];

/**
 * @param {{ cdp?: string, chrome?: string, width: number, height: number }} options
 * @returns {Promise<{ browser: import("playwright-core").Browser, context: import("playwright-core").BrowserContext, attached: boolean }>}
 */
export async function openBrowser({ cdp, chrome, width, height }) {
  if (cdp) {
    const browser = await chromium.connectOverCDP(cdp);
    const context = browser.contexts()[0];
    if (!context) throw new Error(`aucun contexte dans le navigateur de ${cdp}`);
    return { browser, context, attached: true };
  }
  const browser = await chromium.launch({
    headless: true,
    // `chromium` : le nouveau mode sans tête (le vrai compositeur), pas le « headless shell ».
    ...(chrome ? { executablePath: chrome } : { channel: "chromium" }),
    args: [...MUTED, "--hide-scrollbars"],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  return { browser, context, attached: false };
}

/** Lit `{ token, user }` du compte de test dans le fichier de jetons. */
export function readSession(file, account = "knaoxtest") {
  const all = JSON.parse(readFileSync(file, "utf8"));
  const entry = all[account];
  if (!entry?.token || !entry?.user) throw new Error(`pas de session « ${account} » dans le fichier de jetons`);
  return { token: entry.token, user: entry.user };
}

/**
 * Pose la session et le thème AVANT le premier script de l'application : `localStorage` (jeton,
 * compte, mode du thème) et le cookie sans lequel `auth/refresh` répond 401.
 */
export async function signIn(context, base, session, theme) {
  const { hostname } = new URL(base);
  await context.addCookies([{ name: "tentacle_token", value: session.token, domain: hostname, path: "/" }]);
  await context.addInitScript(({ token, user, mode }) => {
    try {
      localStorage.setItem("tentacle_token", token);
      localStorage.setItem("tentacle_user", JSON.stringify(user));
      localStorage.setItem("tentacle_theme_mode", mode);
    } catch { /* stockage refusé : la page le dira */ }
  }, { token: session.token, user: session.user, mode: theme });
}
