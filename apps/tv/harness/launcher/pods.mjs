// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// `pod install` sans salir le dépôt. Hors du dossier principal, il retouche
// trois fichiers suivis sans rien y changer de réel (constaté le 2026-10-01) :
// les sommes de contrôle de boost, DoubleConversion et glog dans Podfile.lock
// (elles dépendent du chemin du dossier), l'ordre de deux lignes du projet
// Xcode, et les commentaires de PrivacyInfo.xcprivacy. Le lanceur rétablit ces
// retouches de FORME ; une vraie différence reste, et on la signale.
import fs from "node:fs";
import path from "node:path";
import { LauncherError, REPO, STATE_DIR, capture, note, runLogged, shortPath, warn } from "./runtime.mjs";

const sortedLines = (text) => text.split("\n").sort().join("\n");
const withoutComments = (text) => text.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, "");
const CHECKSUM = /^ {2}(\S+): [0-9a-f]{40}$/;

/** Seules des sommes de contrôle de pods ont changé (mêmes pods, mêmes versions). */
function onlyChecksums(before, after) {
  const [a, b] = [before.split("\n"), after.split("\n")];
  if (a.length !== b.length) return false;
  return a.every((line, i) => {
    if (line === b[i]) return true;
    const [x, y] = [line.match(CHECKSUM), b[i].match(CHECKSUM)];
    return Boolean(x && y && x[1] === y[1]);
  });
}

// Pour chaque fichier : « l'écart n'est-il que de forme ? »
const FORM_ONLY = {
  "Podfile.lock": onlyChecksums,
  "TentacleTV.xcodeproj/project.pbxproj": (before, after) => sortedLines(before) === sortedLines(after),
  "TentacleTV/PrivacyInfo.xcprivacy": (before, after) => withoutComments(before) === withoutComments(after),
};

/** Le fichier est-il identique à sa version du dernier commit (ni indexé, ni modifié) ? */
const untouched = (file) => capture("git", ["-C", REPO, "diff", "--quiet", "HEAD", "--", file]) !== null;

export async function podInstall(iosDir) {
  // On ne rétablit que ce que l'utilisateur n'avait pas lui-même modifié.
  const originals = new Map();
  for (const file of Object.keys(FORM_ONLY)) {
    const full = path.join(iosDir, file);
    if (untouched(path.relative(REPO, full))) originals.set(file, fs.readFileSync(full, "utf8"));
  }
  const log = path.join(STATE_DIR, "pod-install.log");
  try {
    await runLogged("pod", ["install"], { cwd: iosDir, env: { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }, log });
  } catch {
    for (const line of fs.readFileSync(log, "utf8").trim().split("\n").slice(-8)) note(line.trim());
    throw new LauncherError(`pod install en échec — journal : ${shortPath(log)}`);
  }
  const restored = [];
  for (const [file, original] of originals) {
    const full = path.join(iosDir, file);
    const current = fs.readFileSync(full, "utf8");
    if (current === original) continue;
    if (!FORM_ONLY[file](original, current)) {
      warn(`pod install a vraiment modifié ${file} — à relire (et à commiter avec le changement natif qui l'explique)`);
      continue;
    }
    fs.writeFileSync(full, original);
    // Xcode compare Podfile.lock à Pods/Manifest.lock avant de construire.
    if (file === "Podfile.lock") fs.writeFileSync(path.join(iosDir, "Pods/Manifest.lock"), original);
    restored.push(path.basename(file));
  }
  note(`pod install fait${restored.length ? ` — retouches de forme rétablies (${restored.join(", ")})` : ""}`);
}
