// Recette « du matin » : depuis un clone PROPRE de `dev`, `pnpm install` puis
// `pnpm dev:electron` — exactement la commande de Damien —, et le verre doit
// être là, activé par défaut.
//   BANC_STATE=<état> node morning.mjs <dossier du clone> [--garder]
// Le clone se fait depuis le dépôt local (branche `dev`, rien de poussé requis).
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, glassDom, glassToggle, go, sleep } from "./lib/app.mjs";
import { STATE, SERVER, account, outDir } from "./lib/config.mjs";
import { launchApp, stopApp } from "./lib/electron.mjs";
import { captureWindow, mainWindow } from "./lib/macos.mjs";
import { nativeSnapshot } from "./lib/steps.mjs";

const REPO = "/Users/damienrouge/Desktop/Projet - local/Tentacle-TV";
const clone = path.resolve(process.argv[2] ?? path.join(STATE, "clone-matin"));
const out = outDir("matin");
const log = (file) => path.join(out, file);
const verdict = { clone, steps: [], issues: [] };
const fail = (message) => verdict.issues.push(message);

// Un clone NEUF à chaque passe : rien d'une passe précédente (node_modules,
// dist/) ne doit pouvoir masquer un oubli dans le dépôt.
if (existsSync(clone)) rmSync(clone, { recursive: true, force: true });
{
  execFileSync("git", ["clone", "--quiet", "--branch", "dev", "--single-branch", REPO, clone], { stdio: "inherit" });
}
verdict.commit = execFileSync("git", ["-C", clone, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const started = Date.now();
// Sans shell : le chemin du journal (BANC_OUT) n'est jamais relu comme une commande.
const installLog = openSync(log("install.log"), "w");
try {
  execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: clone, stdio: ["ignore", installLog, installLog] });
} finally {
  closeSync(installLog);
}
verdict.steps.push({ name: "pnpm install", seconds: Math.round((Date.now() - started) / 1000) });

const app = await launchApp({
  home: path.join(STATE, "home-matin"),
  fresh: true,
  log: log("dev-electron.log"),
  // `pnpm dev:electron <drapeaux>` : pnpm les colle au bout du script, donc
  // derrière `electron .`. ⚠️ JAMAIS `--` : Electron le recevrait tel quel, et
  // Chromium ignore tout drapeau placé après (CDP muet, mesuré le 21/10).
  command: { bin: "pnpm", args: ["dev:electron"], cwd: clone },
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
  const tryCapture = (file) => { try { return win ? captureWindow(win.id, log(file)) : null; } catch { return "capture impossible (écran verrouillé ?)"; } };
  verdict.home = { dom, native, capture: tryCapture("accueil.png") };
  if (!dom.bridge.present || dom.bridge.supported !== true) fail("pont du verre absent ou non supporté");
  if (dom.htmlAttr !== "native") fail(`html[data-liquid-glass]=${dom.htmlAttr} (attendu native)`);
  // Natif = lecteur (décision du lot) : à l'accueil, on exige le verre DISPONIBLE et allumé.
  if (!native.exposed) fail("relevé natif non exposé (__tentacleGlass)");
  else if (native.supported !== true || native.enabled !== true) fail(`verre natif : supported=${native.supported} enabled=${native.enabled}`);
  await go(app.page, "/settings/appearance", 2000);
  const toggle = await glassToggle(app.page);
  verdict.settings = { toggle, capture: tryCapture("reglages.png") };
  if (!toggle.found || toggle.checked !== true) fail("interrupteur Liquid Glass absent ou pas allumé par défaut");
} catch (error) {
  fail(`démarrage ou parcours interrompu : ${String(error?.message ?? error)}`);
} finally {
  await stopApp(app);
}
writeFileSync(log("verdict.json"), JSON.stringify(verdict, null, 1));
console.log(verdict.issues.length === 0 ? `MATIN VALIDÉ (${verdict.commit})` : `MATIN : ${verdict.issues.length} défaut(s)\n- ${verdict.issues.join("\n- ")}`);
console.log(out);
