#!/usr/bin/env node
/**
 * L'ÉPREUVE du blocage de la pop-up de mise à jour, dans un vrai Chromium.
 *
 *   node bench/lecteur/updateBlock.mjs      (depuis apps/web ; `pnpm bench:update-lock`)
 *
 * Le labo monte un lecteur EN LECTURE — ses vrais contrôles, ses vrais raccourcis
 * (`usePlayerHotkeys`), sa vraie pause — et la vraie pop-up par-dessus. On vérifie :
 *
 *  1. DISPONIBLE : la lecture continue ; Échap vaut « Plus tard » (la pop-up se ferme).
 *  2. EN COURS (après « Mettre à jour ») : la lecture est en PAUSE ; ni les raccourcis du
 *     lecteur (Espace, flèches, F, M, N), ni Échap, ni un clic sur les contrôles ou sur le
 *     voile n'ont d'effet ; Tab ne sort pas de la pop-up ; l'arrière-plan est inerte ; la
 *     pop-up est au-dessus de tout ; une reprise forcée est remise en pause.
 *  3. Les états en cours ouverts directement verrouillent aussi ; l'erreur rend la main.
 *  4. COQUILLE CEF : sa surcouche (`update-overlay.js`, chargée telle quelle avec une fausse
 *     coquille) annonce son voile au front — sécurité, ou installation lancée par
 *     « Redémarrer » : même pause, mêmes raccourcis coupés. Sa notification, elle, ne bloque rien.
 *
 * Sort en erreur (code 1) au premier écart.
 */

import { chromium } from "playwright-core";

import { buildLab, CHROME_ARGS, chromePath, serveLab } from "./labServer.mjs";

buildLab();
const server = await serveLab();
const browser = await chromium.launch({ executablePath: chromePath(), args: CHROME_ARGS });
const failures = [];
let checks = 0;

function check(label, ok, detail = "") {
  checks += 1;
  if (ok) console.log(`  ✓ ${label}`);
  else { failures.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

const state = (page) => page.evaluate(() => {
  const node = document.querySelector("[data-lab-player]");
  return { playing: node.dataset.labPlaying === "true", time: Number(node.dataset.labTime), fullscreen: node.dataset.labFullscreen === "true" };
});
const dialogOpen = (page) => page.evaluate(() => document.querySelector("[data-update-lock-zone]") !== null);

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => failures.push(`erreur de page : ${e.message}`));
  await page.goto(`${server.base}?theme=dark&${query}`);
  await page.waitForSelector("[data-update-lock-panel]");
  await page.waitForTimeout(500);
  return page;
}

console.log("1. Disponible : rien n'est verrouillé");
{
  const page = await open("vue=maj&etat=disponible");
  check("la lecture continue sous la pop-up proposée", (await state(page)).playing === true);
  check("l'arrière-plan n'est pas inerte", await page.evaluate(() => !document.getElementById("root").inert));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Échap vaut « Plus tard » : la pop-up se ferme", (await dialogOpen(page)) === false);
  await page.close();
}

console.log("2. En cours : tout l'arrière-plan est bloqué");
{
  const page = await open("vue=maj&etat=disponible");
  await page.getByRole("button", { name: "Mettre à jour", exact: true }).click();
  await page.waitForSelector('[data-update-lock-zone][data-blocking="true"]');
  await page.waitForTimeout(300);
  const before = await state(page);
  check("la lecture est mise en pause", before.playing === false);
  check("la pop-up est une alerte modale occupée", await page.evaluate(() => {
    const panel = document.querySelector("[data-update-lock-panel]");
    return panel.getAttribute("role") === "alertdialog" && panel.getAttribute("aria-busy") === "true";
  }));
  check("plus de croix ni de « Plus tard »", await page.evaluate(() => document.querySelectorAll("[data-update-lock-panel] button").length === 0));
  check("l'arrière-plan est inerte", await page.evaluate(() => document.getElementById("root").inert === true));

  for (const key of ["Space", "KeyK", "ArrowRight", "ArrowLeft", "KeyF", "KeyM", "KeyN", "KeyR", "Enter"]) await page.keyboard.press(key);
  await page.waitForTimeout(200);
  const afterKeys = await state(page);
  check("les raccourcis du lecteur sont coupés (lecture, position, plein écran)",
    afterKeys.playing === false && afterKeys.time === before.time && afterKeys.fullscreen === before.fullscreen,
    JSON.stringify(afterKeys));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Échap est inerte : la pop-up reste", (await dialogOpen(page)) === true);

  // Le bouton lecture de la capsule (en bas à gauche) et le voile, loin de la pop-up.
  await page.mouse.click(128, 676);
  await page.mouse.click(60, 300);
  await page.mouse.dblclick(1100, 300);
  await page.waitForTimeout(300);
  const afterClicks = await state(page);
  check("un clic sur les contrôles ou sur le voile n'a aucun effet",
    afterClicks.playing === false && afterClicks.fullscreen === false && (await dialogOpen(page)) === true, JSON.stringify(afterClicks));

  check("la pop-up est au-dessus de tout, d'un coin à l'autre", await page.evaluate(() => {
    const points = [[4, 4], [640, 360], [1276, 716], [128, 676], [1200, 676], [40, 40]];
    return points.every(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-update-lock-zone]") !== null);
  }));

  let escaped = false;
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    escaped ||= await page.evaluate(() => {
      const active = document.activeElement;
      return active !== document.body && active?.closest("[data-update-lock-panel]") === null;
    });
  }
  check("Tab ne sort pas de la pop-up", !escaped);

  // Une reprise venue d'ailleurs (touche média, télécommande, séance de groupe) : remise en pause.
  await page.evaluate(() => document.querySelector('[aria-label="Lecture"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(300);
  check("une reprise forcée est remise en pause", (await state(page)).playing === false);
  await page.close();
}

console.log("3. Les états en cours ouverts directement verrouillent aussi");
for (const etat of ["telechargement", "magasin", "installation", "redemarrage"]) {
  const page = await open(`vue=maj&etat=${etat}`);
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const now = await state(page);
  check(`${etat} : en pause, Espace et Échap inertes, pop-up à l'écran`, now.playing === false && (await dialogOpen(page)) === true);
  await page.close();
}

console.log("4. L'erreur rend la main");
{
  const page = await open("vue=maj&etat=erreur");
  check("après un échec : rien n'est verrouillé, « Réessayer » est offert",
    (await state(page)).playing === true && (await page.getByRole("button", { name: "Réessayer", exact: true }).count()) === 1);
  check("l'erreur est annoncée (role=alert)", (await page.locator('[data-update-lock-panel] [role="alert"]').count()) === 1);
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  check("hors mise à jour en cours, le lecteur répond de nouveau (Espace met en pause)", (await state(page)).playing === false);
  await page.close();
}

console.log("5. Coquille CEF : sa surcouche verrouille le front");
{
  const openCef = async (etat) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => failures.push(`erreur de page : ${e.message}`));
    await page.goto(`${server.base}?theme=dark&vue=web&cef=${etat}`);
    await page.waitForSelector("tentacle-update[data-view]", { state: "attached" });
    await page.waitForTimeout(500);
    return page;
  };
  const view = (page) => page.evaluate(() => document.querySelector("tentacle-update").dataset.view);

  let page = await openCef("prete");
  check("la notification ne bloque rien : la lecture continue", (await view(page)) === "toast" && (await state(page)).playing === true);
  await page.getByRole("button", { name: "Redémarrer pour mettre à jour", exact: true }).click();
  await page.waitForTimeout(400);
  check("« Redémarrer » : le voile paraît et la lecture se met en pause", (await view(page)) === "blocking" && (await state(page)).playing === false);
  const before = await state(page);
  for (const key of ["Space", "ArrowRight", "KeyF", "Escape", "Enter"]) await page.keyboard.press(key);
  await page.mouse.click(128, 676);
  await page.waitForTimeout(250);
  const after = await state(page);
  check("pendant l'installation : raccourcis et clics sans effet",
    after.playing === false && after.time === before.time && after.fullscreen === before.fullscreen, JSON.stringify(after));
  check("l'arrière-plan est inerte, la surcouche ne l'est pas", await page.evaluate(() =>
    document.getElementById("root").inert === true && document.querySelector("tentacle-update").inert !== true));
  await page.close();

  page = await openCef("securite-prete");
  check("sécurité : voile immédiat, lecture en pause", (await view(page)) === "blocking" && (await state(page)).playing === false);
  // Le bouton du voile a le focus : Espace l'active (il relance l'installation) sans atteindre le lecteur.
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  check("Espace sur le bouton du voile n'atteint pas le lecteur", (await state(page)).playing === false && (await view(page)) === "blocking");
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${checks - failures.length} / ${checks} vérifications passées`);
if (failures.length) {
  console.error(`ÉCHECS :\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
