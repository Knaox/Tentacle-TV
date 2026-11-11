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

const slug = (label) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Les menus de la barre de filtres d'une bibliothèque (le tri est le premier déclencheur de la barre). */
const FILTER_MENUS = ["Genres", "Année", "Note minimum", "Plateformes", "Langue audio", "Sous-titres"];

/** Les écrans du labo des réglages qu'aucune session de banc n'atteint (administration, profils, installation). */
const LAB_SETTINGS = [
  "admin", "admin-a-regler", "admin-recommandations", "admin-sessions", "admin-tickets", "admin-utilisateurs",
  "admin-invitations", "admin-famille", "admin-telechargements", "admin-services", "admin-metadonnees",
  "admin-acces-distant", "admin-extensions", "admin-systeme", "qui-regarde", "connexion", "inscription", "assistant",
];

/** Pose un statut, les favoris et le premier genre : les pastilles allumées et la rangée « ce qui est posé ». */
async function applyFilters(page) {
  const bar = page.locator("section[aria-label]").first();
  await bar.getByText("Non vus", { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await bar.locator('button:has-text("Favoris")').first().click({ timeout: 5000 }).catch(() => {});
  await bar.locator('button[aria-haspopup="true"]:has-text("Genres")').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('[role="menuitemcheckbox"], [role="option"], .ui-menu-item').first().click({ timeout: 4000 }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
}

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

  const library = libraries[1] ?? libraries[0];
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
    // La bibliothèque et TOUS ses filtres : chaque menu ouvert, les filtres posés, l'état vide.
    ...FILTER_MENUS.map((label) => ({ name: `filtre-${slug(label)}`, route: library, steps: click(`section[aria-label] button[aria-haspopup="true"]:has-text("${label}")`), after: escape })),
    { name: "filtre-tri", route: library, steps: click('section[aria-label] button[aria-haspopup="true"] >> nth=0'), after: escape },
    { name: "filtres-poses", route: library, steps: applyFilters, screens: 2 },
    { name: "bibliotheque-vide", route: library, steps: async (p) => { await p.locator('section[aria-label] input').first().fill("zzzzqqqq"); await p.waitForTimeout(2500); } },
    // Ce qu'un compte sans droits ne voit pas, ou ce qui ne se provoque pas : les labos du paquet de développement.
    ...LAB_SETTINGS.map((id) => ({ name: `labo-${id}`, route: `/dev/reglages?vue=${id}`, screens: 3 })),
    ...["jetons", "boutons", "controles", "calques"].map((id) => ({ name: `labo-socle-${id}`, route: `/dev/socle?vue=${id}`, screens: 3 })),
    ...["avis", "etats", "cartes"].map((id) => ({ name: `labo-accueil-${id}`, route: `/dev/accueil?vue=${id}`, screens: 2 })),
    ...["feuille-film", "feuille-saison", "feuille-serie", "file", "catalogue", "serie", "film", "boutons", "avis"].map((id) => ({ name: `labo-hors-ligne-${id}`, route: `/dev/hors-ligne?vue=${id}`, screens: 2 })),
    // Octave en mode bureau : son propre thème (« Apparence d'Octave », par défaut celle de Tentacle).
    ...[["", "accueil"], ["/search", "recherche"], ["/library", "bibliotheque"], ["/liked", "aimes"], ["/playlists", "playlists"], ["/settings", "reglages"]]
      .map(([path, id]) => ({ name: `octave-${id}`, route: `/octave${path}`, screens: 2, settle: 3000 })),
    // Le labo du verre : chaque surface de Liquid Glass sur de vrais dessous (mode natif seulement).
    ...["surfaces", "grandes", "composants", "barres", "menus", "contenu", "controles", "feuilles"].flatMap((vue) =>
      ["affiches", "blanc"].map((fond) => ({ name: `labo-verre-${vue}-${fond}`, route: `/dev/verre?vue=${vue}&fond=${fond}`, screens: 2 }))),
  ];
  return scenes;
}
