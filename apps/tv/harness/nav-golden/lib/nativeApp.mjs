// L'app native (Debug, simulateur) que le banc installe : UNE build par
// empreinte du natif, rangée dans le cache de la machine et partagée par
// toutes les sessions. Le lot ne touche que du JavaScript : la référence et le
// code refactorisé tournent alors sur le MÊME binaire — seul le paquet JS,
// servi par Metro, diffère. Si le natif change, l'empreinte change et le banc
// reconstruit (une fois).
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BenchError, CACHE_DIR, REPO, capture, duration, mainCheckout, note, step } from "./config.mjs";
import { withLock } from "./checkout.mjs";

// Ce qui entre dans le binaire (l'équivalent du lanceur, `launcher/nativeBuild.mjs`).
const NATIVE_INPUTS = ["apps/tv/ios", "apps/tv/package.json", "apps/tv/react-native.config.js", "apps/tv/app.json", "apps/tv/assets/fonts"];
const PRODUCT = "Build/Products/Debug-appletvsimulator/TentacleTV.app";
const UTF8 = { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" };

/** « chemin empreinte-git » de chaque fichier natif du checkout, trié. */
function nativeBlobs(checkout) {
  if (checkout.dir === REPO) {
    // Le dossier courant : son état réel, modifications non commitées comprises.
    const files = (capture("git", ["-C", REPO, "ls-files", "-z", "-co", "--exclude-standard", "--", ...NATIVE_INPUTS]) ?? "")
      .split("\0").filter((file) => file && fs.existsSync(path.join(REPO, file))).sort();
    const hashes = capture("git", ["-C", REPO, "hash-object", "--stdin-paths"], { input: files.join("\n") })?.trim().split("\n") ?? [];
    return files.map((file, i) => `${file} ${hashes[i]}`);
  }
  // Un checkout de référence : son commit fait foi.
  const tree = capture("git", ["-C", REPO, "ls-tree", "-r", "-z", checkout.sha, "--", ...NATIVE_INPUTS]) ?? "";
  return tree.split("\0").filter(Boolean).map((line) => {
    const [meta, file] = line.split("\t");
    return `${file} ${meta.split(" ")[2]}`;
  }).sort();
}

/**
 * L'empreinte du natif d'un checkout : ses fichiers natifs, l'installation
 * pnpm du principal (que tous les checkouts empruntent : son lockfile et ses
 * correctifs) et la version de Xcode.
 */
export function nativeFingerprint(checkout) {
  const main = mainCheckout();
  const hash = crypto.createHash("sha256");
  for (const line of nativeBlobs(checkout)) hash.update(`${line}\n`);
  for (const file of ["pnpm-lock.yaml", ...fs.readdirSync(path.join(main, "patches")).map((name) => `patches/${name}`)]) {
    hash.update(`${file}\0`).update(fs.readFileSync(path.join(main, file))).update("\0");
  }
  hash.update(capture("xcodebuild", ["-version"]) ?? "");
  return hash.digest("hex").slice(0, 16);
}

export const cachedApp = (fingerprint) => path.join(CACHE_DIR, "apps", fingerprint, "TentacleTV.app");

function runLogged(command, args, { cwd, log, env = {} }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const fd = fs.openSync(log, "w");
    const child = spawn(command, args, { cwd, env: { ...process.env, ...UTF8, ...env }, stdio: ["ignore", fd, fd] });
    fs.closeSync(fd);
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new BenchError(`${command} a échoué (code ${code}) — journal : ${log}`))));
  });
}

// `pod install` hors du dossier principal retouche trois fichiers suivis sans
// rien y changer de réel (sommes de contrôle liées au chemin, ordre de lignes,
// commentaires) : on rétablit ces retouches de FORME dans un dossier suivi.
const FORM_ONLY = {
  "Podfile.lock": (a, b) => a.replace(/^( {2}\S+:) [0-9a-f]{40}$/gm, "$1") === b.replace(/^( {2}\S+:) [0-9a-f]{40}$/gm, "$1"),
  "TentacleTV.xcodeproj/project.pbxproj": (a, b) => a.split("\n").sort().join("\n") === b.split("\n").sort().join("\n"),
  "TentacleTV/PrivacyInfo.xcprivacy": (a, b) => a.replace(/<!--[\s\S]*?-->|\s+/g, "") === b.replace(/<!--[\s\S]*?-->|\s+/g, ""),
};

async function podInstall(iosDir, log) {
  const before = Object.fromEntries(Object.keys(FORM_ONLY).map((file) => [file, fs.readFileSync(path.join(iosDir, file), "utf8")]));
  await runLogged("pod", ["install"], { cwd: iosDir, log });
  for (const [file, same] of Object.entries(FORM_ONLY)) {
    const full = path.join(iosDir, file);
    const after = fs.readFileSync(full, "utf8");
    if (after === before[file] || !same(before[file], after)) continue;
    fs.writeFileSync(full, before[file]);
    if (file === "Podfile.lock") fs.writeFileSync(path.join(iosDir, "Pods/Manifest.lock"), before[file]);
  }
}

/**
 * Range dans le cache une app déjà construite AILLEURS (le build commun du
 * lot, celui d'une autre session) pour l'empreinte de ce checkout. À ne faire
 * que pour une app construite depuis ce même natif : le banc ne peut pas le
 * vérifier.
 */
export function importNativeApp(source, checkout) {
  if (!fs.existsSync(path.join(source, "Info.plist"))) throw new BenchError(`pas une app : ${source}`);
  const fingerprint = nativeFingerprint(checkout);
  const app = cachedApp(fingerprint);
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(app), { recursive: true });
  fs.cpSync(source, app, { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE });
  fs.writeFileSync(path.join(path.dirname(app), "built-from.txt"), `importée de ${source}\npour ${checkout.label}\n${new Date().toISOString()}\n`);
  return { fingerprint, app };
}

/**
 * L'app de ce checkout, construite au besoin (une fois par empreinte, pour
 * toute la machine : les autres sessions attendent le verrou puis la
 * reprennent). Rend `{ fingerprint, app }`.
 */
export async function ensureNativeApp(checkout) {
  const fingerprint = nativeFingerprint(checkout);
  const app = cachedApp(fingerprint);
  if (fs.existsSync(path.join(app, "Info.plist"))) return { fingerprint, app };
  await withLock(`build-${fingerprint}`, async () => {
    if (fs.existsSync(path.join(app, "Info.plist"))) return;
    const iosDir = path.join(checkout.dir, "apps/tv/ios");
    const logs = path.join(CACHE_DIR, "builds", fingerprint);
    const derived = path.join(CACHE_DIR, "dd", fingerprint);
    step("App native", `build Debug du simulateur depuis ${checkout.label} — empreinte ${fingerprint} (10 à 15 min la première fois)`);
    const start = Date.now();
    const beat = setInterval(() => note(`build en cours… ${duration(Date.now() - start)}`), 120_000);
    try {
      await podInstall(iosDir, path.join(logs, "pod-install.log"));
      note(`pod install fait (${duration(Date.now() - start)})`);
      await runLogged("xcodebuild", [
        "-workspace", "TentacleTV.xcworkspace", "-scheme", "TentacleTV", "-configuration", "Debug",
        "-sdk", "appletvsimulator", "-destination", "generic/platform=tvOS Simulator",
        "-derivedDataPath", derived, "COMPILER_INDEX_STORE_ENABLE=NO", "build",
      ], { cwd: iosDir, log: path.join(logs, "xcodebuild.log") });
    } finally {
      clearInterval(beat);
    }
    fs.mkdirSync(path.dirname(app), { recursive: true });
    fs.cpSync(path.join(derived, PRODUCT), app, { recursive: true, verbatimSymlinks: true });
    fs.writeFileSync(path.join(path.dirname(app), "built-from.txt"), `${checkout.label}\n${checkout.sha ?? ""}\n${new Date().toISOString()}\n`);
    note(`build réussie en ${duration(Date.now() - start)} — rangée dans ${path.dirname(app)}`);
  });
  return { fingerprint, app };
}
