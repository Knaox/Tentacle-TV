// Recette « du matin » : depuis un clone PROPRE de `dev`, `pnpm install` puis
// `pnpm dev:electron` — exactement la commande de Damien —, et le verre doit
// être là, activé par défaut.
//   BANC_STATE=<état> node morning.mjs <dossier du clone> [--garder]
// Le clone se fait depuis le dépôt local (branche `dev`, rien de poussé requis).
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, glassDom, glassToggle, go, sleep } from "./lib/app.mjs";
import { STATE, SERVER, account, outDir } from "./lib/config.mjs";
import { launchApp, stopApp } from "./lib/electron.mjs";
import { captureWindow, mainWindow } from "./lib/macos.mjs";
import { nativeSnapshot } from "./lib/scenarios.mjs";

const REPO = "/Users/damienrouge/Desktop/Projet - local/Tentacle-TV";
const clone = path.resolve(process.argv[2] ?? path.join(STATE, "clone-matin"));
const out = outDir("matin");
const log = (file) => path.join(out, file);
const verdict = { clone, steps: [], issues: [] };
const fail = (message) => verdict.issues.push(message);

if (!existsSync(clone)) {
  execFileSync("git", ["clone", "--quiet", "--branch", "dev", "--single-branch", REPO, clone], { stdio: "inherit" });
}
verdict.commit = execFileSync("git", ["-C", clone, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const started = Date.now();
execFileSync("sh", ["-c", `pnpm install --frozen-lockfile > "${log("install.log")}" 2>&1`], { cwd: clone });
verdict.steps.push({ name: "pnpm install", seconds: Math.round((Date.now() - started) / 1000) });

const app = await launchApp({
  home: path.join(STATE, "home-matin"),
  fresh: true,
  log: log("dev-electron.log"),
  // `pnpm dev:electron -- <drapeaux>` : pnpm les passe à `electron .`.
  command: { bin: "pnpm", args: ["dev:electron", "--"], cwd: clone },
  startTimeoutMs: 20 * 60_000,
});
try {
  verdict.steps.push({ name: "pnpm dev:electron → fenêtre", seconds: Math.round((Date.now() - started) / 1000) });
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(4000);
  await dismissOverlays(app.page);
  const dom = await glassDom(app.page);
  const native = await nativeSnapshot(app);
  const win = mainWindow(STATE, app.pid) ?? null;
  verdict.home = { dom, native, capture: win ? captureWindow(win.id, log("accueil.png")) : null };
  if (!dom.bridge.present || dom.bridge.supported !== true) fail("pont du verre absent ou non supporté");
  if (dom.htmlAttr !== "native") fail(`html[data-liquid-glass]=${dom.htmlAttr} (attendu native)`);
  if (native.exposed && (native.regions ?? []).filter((r) => !r.hidden).length === 0) fail("aucune région native à l'accueil");
  await go(app.page, "/settings/appearance", 2000);
  const toggle = await glassToggle(app.page);
  verdict.settings = { toggle, capture: win ? captureWindow(win.id, log("reglages.png")) : null };
  if (!toggle.found || toggle.checked !== true) fail("interrupteur Liquid Glass absent ou pas allumé par défaut");
} catch (error) {
  fail(`démarrage ou parcours interrompu : ${String(error?.message ?? error)}`);
} finally {
  await stopApp(app);
}
writeFileSync(log("verdict.json"), JSON.stringify(verdict, null, 1));
console.log(verdict.issues.length === 0 ? `MATIN VALIDÉ (${verdict.commit})` : `MATIN : ${verdict.issues.length} défaut(s)\n- ${verdict.issues.join("\n- ")}`);
console.log(out);
