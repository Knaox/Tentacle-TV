/**
 * Les écrans du banc « clair-verre ». Les identifiants (bibliothèques, titres, personne) sont lus
 * sur l'instance : rien n'est en dur. Une scène = une route, des gestes éventuels (ouvrir un menu,
 * une feuille), et le nombre d'écrans à faire défiler.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ORIGIN, visit } from "./lib/session.mjs";

const hrefs = (page, pattern) => page.evaluate((source) => {
  const re = new RegExp(source);
  return [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => re.test(h)))];
}, pattern.source);

/** Clique le premier élément qui correspond et attend que le calque se pose. */
export const click = (selector, wait = 500) => async (page) => {
  await page.locator(selector).first().click({ timeout: 5000 });
  await page.waitForTimeout(wait);
};

const escape = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};

/** Les identifiants lus sur l'instance, gardés d'une passe à l'autre (la découverte coûte six chargements). */
const CACHE = process.env.BANC_SCENES ?? join(homedir(), ".cache/tentacle-test/rf2/clair-verre/scenes.json");

async function discover(page) {
  await visit(page, "/", 2500);
  const libraries = await hrefs(page, /^\/library\//);
  const media = [];
  // Une carte n'est pas un lien : on l'ouvre et on lit l'adresse de sa fiche.
  for (const library of libraries.slice(0, 3)) {
    await visit(page, library, 2500);
    const card = page.locator("[data-card-rating]").first();
    if (!(await card.count())) continue;
    await card.click({ timeout: 5000 }).catch(() => {});
    await page.waitForURL(/\/media\//, { timeout: 10_000 }).catch(() => {});
    const path = new URL(page.url()).pathname;
    if (path.startsWith("/media/")) media.push(path);
  }
  let person = null;
  if (media[0]) {
    await visit(page, media[0], 3000);
    person = (await hrefs(page, /^\/person\//))[0] ?? null;
    if (!person) {
      // La distribution, elle non plus, n'est pas faite de liens.
      const cast = page.locator('[data-person-id], [href*="/person/"], button[aria-label*="acteur"], [data-cast] button').first();
      if (await cast.count()) {
        await cast.click({ timeout: 4000 }).catch(() => {});
        await page.waitForURL(/\/person\//, { timeout: 6000 }).catch(() => {});
        const path = new URL(page.url()).pathname;
        if (path.startsWith("/person/")) person = path;
      }
    }
  }
  return { libraries: libraries.slice(0, 3), media, person };
}

export async function buildScenes(page) {
  let ids = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : null;
  if (!ids || ids.libraries.length === 0 || ids.media.length === 0) {
    ids = await discover(page);
    if (ids.libraries.length && ids.media.length) writeFileSync(CACHE, JSON.stringify(ids));
  }
  const { libraries, media, person } = ids;

  const settings = ["", "/appearance", "/personalization", "/security", "/family", "/playback", "/languages", "/downloads", "/data"];
  const scenes = [
    { name: "accueil", route: "/", screens: 4, settle: 2500 },
    { name: "pour-vous", route: "/recommendations", screens: 3, settle: 2500 },
    ...libraries.slice(0, 3).map((route, i) => ({ name: `bibliotheque-${i + 1}`, route, screens: 2, settle: 2500 })),
    ...media.map((route, i) => ({ name: `fiche-${i + 1}`, route, screens: 3, settle: 3000 })),
    { name: "recherche", route: "/search?q=iron", screens: 2, settle: 2500 },
    { name: "recherche-vide", route: "/search?q=zzzzqqqq", settle: 2000 },
    ...(person ? [{ name: "personne", route: person, screens: 2, settle: 2500 }] : []),
    { name: "ma-liste", route: "/watchlist", screens: 2 },
    { name: "favoris", route: "/favorites", screens: 2 },
    ...settings.map((path) => ({ name: `reglages${path.replace("/", "-")}`, route: `/settings${path}`, screens: 4 })),
    { name: "profil", route: "/profile", screens: 2 },
    { name: "hors-ligne-file", route: "/downloads", screens: 2 },
    { name: "hors-ligne-catalogue", route: "/on-device", screens: 2 },
    { name: "statistiques", route: "/stats", screens: 3 },
    { name: "assistance", route: "/support", screens: 2 },
    { name: "aide-bandes-annonces", route: "/help/trailers", screens: 3 },
    { name: "jumelage", route: "/pair-device" },
    { name: "a-propos", route: "/about", screens: 2 },
    { name: "credits", route: "/credits", screens: 2 },
    { name: "introuvable", route: "/cette-page-n-existe-pas" },
    // Calques : menus, palette, notifications.
    { name: "menu-compte", route: "/", steps: click('[aria-haspopup="menu"][aria-label*="ompte"], button[aria-label*="Profil"], button[aria-label*="profil"]'), after: escape },
    { name: "menu-plus", route: "/", steps: click('button:has-text("Plus")'), after: escape },
    { name: "notifications", route: "/", steps: click('button[aria-label*="otification"]'), after: escape },
    { name: "watch-together", route: "/", steps: click('button[aria-label*="Watch"], button[aria-label*="groupe"], button[aria-label*="ensemble"]'), after: escape },
    { name: "palette", route: "/", steps: async (p) => { await p.keyboard.press("Meta+k"); await p.waitForTimeout(600); await p.keyboard.type("iron"); await p.waitForTimeout(1500); }, after: escape },
  ];
  return scenes;
}
