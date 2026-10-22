// La matrice de recette du verre natif.
//   BANC_STATE=<état> node matrix.mjs [cellule…] [--sans-lecteur] [--label <nom>]
// Sans cellule : toutes. Rapport : <sortie>/rapport.json et resume.md.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { clickGlassToggle, connectAndLogin, emulateMedia, glassToggle, go, sleep } from "./lib/app.mjs";
import { checkCell } from "./lib/checks.mjs";
import { STATE, SERVER, account, outDir, resetPlayback } from "./lib/config.mjs";
import { evalMain, focusEvents, launchApp, stopApp } from "./lib/electron.mjs";
import { offline } from "./lib/offline.mjs";
import { whatsNew } from "./lib/whatsNew.mjs";
import { menus } from "./lib/menus.mjs";
import { admin, player, screens } from "./lib/scenarios.mjs";

async function reload(page) {
  await page.evaluate(`location.reload(); return true;`).catch(() => {});
  await sleep(4000);
}

const CELLS = {
  // macOS 26, réglage par défaut : le verre natif doit être là.
  allume: { expect: "on", run: [whatsNew, screens, menus, player] },
  // L'utilisateur coupe dans Réglages › Apparence : rendu d'avant, aucune région.
  coupe: {
    expect: "off",
    run: [screens, player],
    async prepare(app) {
      await go(app.page, "/settings/appearance", 2000);
      const before = await glassToggle(app.page);
      if (before.found && before.checked) await clickGlassToggle(app.page);
      await sleep(1000);
      return { before, after: await glassToggle(app.page) };
    },
  },
  // OS « non supporté » simulé : option invisible, aucun verre natif.
  "env-off": { expect: "unsupported", env: { TENTACLE_LIQUID_GLASS: "off" }, run: [whatsNew, screens] },
  // Thème clair de l'app ET apparence claire de la fenêtre native.
  clair: {
    expect: "on",
    run: [screens, menus],
    async prepare(app) {
      await app.page.evaluate(`localStorage.setItem("tentacle_theme_mode", "light"); return true;`);
      const native = await evalMain(app, `require("electron").nativeTheme.themeSource = "light"; return "light";`).catch(String);
      await emulateMedia(app.page, { dark: false });
      await reload(app.page);
      return { native };
    },
  },
  // « Réduire la transparence » côté PAGE (émulée). Côté natif, NSGlassEffectView
  // suit le réglage du SYSTÈME, que le banc ne bascule pas (global à la machine).
  transparence: {
    expect: "on",
    a11y: "Réduire la transparence",
    run: [screens],
    async prepare(app) {
      await emulateMedia(app.page, { reducedTransparency: true });
      await reload(app.page);
      await emulateMedia(app.page, { reducedTransparency: true });
      return { emulated: true };
    },
  },
  // Contraste accru (émulé côté page) : verre givré/opaque (lg-physique).
  contraste: {
    expect: "on",
    a11y: "Contraste accru",
    run: [screens],
    async prepare(app) {
      await emulateMedia(app.page, { moreContrast: true });
      await reload(app.page);
      await emulateMedia(app.page, { moreContrast: true });
      return { emulated: true };
    },
  },
  // Le hors ligne en verre (lg-composants), puis le même réglage coupé.
  "hors-ligne": { expect: "on", run: [offline] },
  "hors-ligne-coupe": { expect: "off", run: [offline], prepare: (app) => CELLS.coupe.prepare(app) },
  // Menus et feuilles seuls (sombre / clair), pour rejouer vite une passe de lg-tokens.
  menus: { expect: "on", run: [menus] },
  "menus-clair": { expect: "on", run: [menus], prepare: (app) => CELLS.clair.prepare(app) },
  // L'administration (compte admin du Jellyfin jetable).
  admin: { expect: "on", account: "admin", run: [admin] },
};

const args = process.argv.slice(2);
const noPlayer = args.includes("--sans-lecteur");
const labelAt = args.indexOf("--label");
const label = labelAt >= 0 ? args[labelAt + 1] : "matrice";
const wanted = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--label");
const names = wanted.length > 0 ? wanted : Object.keys(CELLS);
const out = outDir(label);
const all = [];

for (const name of names) {
  const cell = CELLS[name];
  if (!cell) throw new Error(`cellule inconnue : ${name}`);
  const report = { cell: name, expect: cell.expect, steps: [], startedAt: new Date().toISOString() };
  console.log(`[banc] cellule ${name}…`);
  report.reset = await resetPlayback();
  const app = await launchApp({
    home: path.join(STATE, `home-${name}`),
    fresh: true,
    env: cell.env ?? {},
    log: path.join(out, `${name}-electron.log`),
  });
  try {
    await connectAndLogin(app.page, { server: SERVER, ...account(cell.account ?? "Knaoxtest") });
    await sleep(3000);
    if (cell.prepare) report.prepare = await cell.prepare(app);
    for (const run of cell.run) {
      if (noPlayer && run === player) continue;
      await run({ app, out, cell: name, report });
    }
  } catch (error) {
    report.fatal = String(error?.message ?? error);
  } finally {
    report.focusEvents = await focusEvents(app);
    await stopApp(app);
  }
  report.issues = checkCell(cell, report);
  if (report.focusEvents.length > 0) report.notes = [...(report.notes ?? []), `${report.focusEvents.length} prise(s) de focus — 1re à ${report.focusEvents[0].at} : ${report.focusEvents[0].stack.slice(0, 160)}`];
  if (report.fatal) report.issues.unshift({ message: `cellule interrompue : ${report.fatal}`, proof: null });
  all.push(report);
  writeFileSync(path.join(out, "rapport.json"), JSON.stringify(all, null, 1));
  console.log(`[banc] ${name} : ${report.issues.length} défaut(s) candidat(s)`);
}

const lines = [`# Recette Liquid Glass — ${label}`, "", `Sortie : ${out}`, ""];
for (const r of all) {
  lines.push(`## ${r.cell} (attendu : ${r.expect})`, "");
  for (const s of r.steps) lines.push(`- ${s.ok ? "✓" : "✗"} ${s.name}${s.capture ? ` — ${s.capture}` : ""}${s.error ? ` — ${s.error}` : ""}`);
  for (const note of r.notes ?? []) lines.push(`- ⚠️ ${note}`);
  if (r.captureErrors?.length) lines.push(`- ⚠️ ${r.captureErrors.length} capture(s) impossible(s) (écran verrouillé ?) : ${r.captureErrors[0]}`);
  lines.push("", r.issues.length === 0 ? "**Aucun défaut.**" : "**Défauts candidats :**");
  r.issues.forEach((i, n) => lines.push(`${n + 1}. ${i.message}${i.proof ? ` (preuve : ${i.proof})` : ""}`));
  lines.push("");
}
writeFileSync(path.join(out, "resume.md"), lines.join("\n"));
console.log(path.join(out, "resume.md"));
