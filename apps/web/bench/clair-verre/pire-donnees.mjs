#!/usr/bin/env node
/**
 * Banc « clair-verre » : les filtres d'une bibliothèque face aux PIRES données réalistes (skill `break-ui`).
 *
 *   node bench/clair-verre/pire-donnees.mjs [dossier de captures]      (depuis apps/web)
 *
 * Les données entrent par où elles entrent d'ordinaire — les réponses de l'API, interceptées et réécrites
 * (jamais le balisage) : un nom de bibliothèque très long, un autre en japonais, des genres longs, courts,
 * à barre oblique, soixante genres. Puis, à trois largeurs et au texte grossi à 200 %, en clair puis en sombre :
 * rien ne déborde de la fenêtre ni du panneau d'outils, aucune pastille n'en chevauche une autre, un libellé coupé
 * peut se lire en entier, le menu ouvert tient dans la fenêtre. THEME=light|dark|both (défaut both), GLASS=1.
 * Code de sortie 1 s'il y a une casse.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { openSession, visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const OUT = process.argv[2] ? resolve(process.argv[2]) : null;
if (OUT) mkdirSync(OUT, { recursive: true });

/** Des noms qu'un vrai serveur porte : la limite de Jellyfin est large, et rien ne la borne côté client. */
const LIBRARY_NAMES = ["Films d'animation et documentaires de la collection familiale (4K)", "アニメとドラマ・コレクション", "TV"];
const GENRES = [
  "Science-fiction & fantastique", "Documentaire animalier et environnemental", "Comédie romantique musicale pour adolescents",
  "Guerre/Politique", "SF", "異世界ファンタジー", "Téléréalité", "Court-métrage d'animation expérimental", "Mystère", "Western",
  ...Array.from({ length: 50 }, (_, i) => `Genre importé n° ${i + 1}`),
];

async function rewrite(page) {
  await page.route(/\/api\/jellyfin\/Users\/[^/]+\/Views/, async (route) => {
    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    if (body?.Items) body.Items.forEach((item, i) => { if (LIBRARY_NAMES[i]) item.Name = LIBRARY_NAMES[i]; });
    await route.fulfill({ response, json: body });
  });
  await page.route(/\/api\/jellyfin\/Genres/, async (route) => {
    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    if (body?.Items) {
      const sample = body.Items[0] ?? { Type: "Genre" };
      body.Items = GENRES.map((Name, i) => ({ ...sample, Name, Id: body.Items[i]?.Id ?? `pire-${i}` }));
      body.TotalRecordCount = body.Items.length;
    }
    await route.fulfill({ response, json: body });
  });
}

/** Dans la page : ce qui casse, mesuré sur les boîtes. */
const CHECK = () => {
  const out = [];
  const label = (el) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 30)}]` : ""} « ${(el.textContent ?? "").trim().slice(0, 40)} »`;
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ kind: "la page déborde en largeur", detail: `${document.documentElement.scrollWidth} px pour ${innerWidth}` });
  const bar = document.querySelector("section[aria-label]:has(input)") ?? document.querySelector("section.ui-panel");
  if (bar) {
    const box = bar.getBoundingClientRect();
    const controls = [...bar.querySelectorAll("button, input, [role=radio], [role=tab]")].filter((el) => el.offsetParent !== null);
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.right > box.right + 1 || r.left < box.left - 1) out.push({ kind: "un contrôle sort du panneau d'outils", detail: label(el) });
      if (r.right > innerWidth + 1) out.push({ kind: "un contrôle sort de la fenêtre", detail: label(el) });
    }
    // Deux contrôles FRÈRES qui se recouvrent (les enfants d'une même rangée).
    const rows = new Map();
    for (const el of controls) { const list = rows.get(el.parentElement) ?? []; list.push(el); rows.set(el.parentElement, list); }
    for (const list of rows.values()) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i].getBoundingClientRect();
        const b = list[j].getBoundingClientRect();
        if (list[i].contains(list[j]) || list[j].contains(list[i])) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) out.push({ kind: "deux contrôles se recouvrent", detail: `${label(list[i])} / ${label(list[j])}` });
      }
    }
  }
  // Un texte coupé qu'on ne peut lire nulle part.
  for (const el of document.querySelectorAll("section[aria-label] *, [role=menu] *, .ui-menu *, h1")) {
    if (el.children.length > 0 || !el.textContent?.trim()) continue;
    const style = getComputedStyle(el);
    const cut = (el.scrollWidth > el.clientWidth + 1 && style.overflowX !== "visible") || (style.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1);
    if (!cut) continue;
    const readable = el.closest("[title], [aria-label]");
    const shown = (readable?.getAttribute("title") ?? readable?.getAttribute("aria-label") ?? "").includes(el.textContent.trim().slice(0, 12));
    if (!shown) out.push({ kind: "un libellé coupé, illisible en entier", detail: label(el) });
  }
  // Le titre de la bannière ne passe ni sous la barre du haut ni hors de la fenêtre.
  const title = document.querySelector("h1");
  if (title) {
    const r = title.getBoundingClientRect();
    if (r.right > innerWidth + 1) out.push({ kind: "le titre sort de la fenêtre", detail: label(title) });
    const nav = document.querySelector(".lgc-capsule, header nav, [data-top-nav]")?.getBoundingClientRect();
    if (nav && r.top < nav.bottom - 2 && r.bottom > nav.top) out.push({ kind: "le titre passe sous la barre du haut", detail: `${Math.round(r.top)} < ${Math.round(nav.bottom)}` });
  }
  // Un menu ouvert tient dans la fenêtre, et ses rangées dans le menu.
  for (const menu of document.querySelectorAll(".ui-menu, [role=menu], [role=listbox]")) {
    const r = menu.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) out.push({ kind: "un menu sort de la fenêtre", detail: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}` });
    for (const item of menu.querySelectorAll(".ui-menu-item, [role^=menuitem], [role=option]")) {
      const ir = item.getBoundingClientRect();
      if (ir.right > r.right + 1) out.push({ kind: "une rangée sort de son menu", detail: label(item) });
    }
  }
  return out;
};

const themes = process.env.THEME === "light" || process.env.THEME === "dark" ? [process.env.THEME] : ["light", "dark"];
let broken = 0;
for (const theme of themes) {
  for (const [width, zoom] of [[1440, 1], [1100, 1], [820, 1], [1440, 2]]) {
    const { browser, page } = await openSession({ theme, glass: process.env.GLASS === "1", width, height: 900 });
    await rewrite(page);
    const scenes = await buildScenes(page);
    const library = scenes.find((s) => s.name === "bibliotheque-1").route;
    await visit(page, library, 3000);
    if (zoom !== 1) await page.addStyleTag({ content: `html { font-size: ${zoom * 100}% !important; }` });
    await page.waitForTimeout(600);
    const name = `${theme}-${width}${zoom === 1 ? "" : `-texte×${zoom}`}`;
    const steps = [
      ["au repos", async () => {}],
      ["menu Genres", async () => { await page.locator('section[aria-label] button[aria-haspopup="true"]:has-text("Genres")').first().click({ timeout: 5000 }); await page.waitForTimeout(700); }],
      ["genres posés", async () => {
        for (const genre of GENRES.slice(0, 3)) await page.locator(`.ui-menu :text-is("${genre}")`).first().click({ timeout: 4000 }).catch(() => {});
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1500);
      }],
    ];
    for (const [step, run] of steps) {
      let found;
      try { await run(); found = await page.evaluate(CHECK); } catch (error) { found = [{ kind: "geste impossible", detail: error.message.split("\n")[0] }]; }
      const unique = [...new Map(found.map((f) => [`${f.kind}|${f.detail}`, f])).values()];
      broken += unique.length;
      console.log(`${unique.length === 0 ? "✓" : "✗"} ${name} — ${step}${unique.length ? ` : ${unique.length} casse(s)` : ""}`);
      for (const f of unique.slice(0, 8)) console.log(`    ${f.kind} — ${f.detail}`);
      if (OUT) await page.screenshot({ path: join(OUT, `${name}-${step.replace(/\s+/g, "-")}.png`) });
    }
    await browser.close();
  }
}
console.log(`${broken} casse(s)`);
process.exit(broken === 0 ? 0 : 1);
