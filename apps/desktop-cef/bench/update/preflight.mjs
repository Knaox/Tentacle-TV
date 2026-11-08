#!/usr/bin/env node
// Contrôle SANS FENÊTRE qu'un .app peut démarrer : chaque bibliothèque que dyld chargera
// (@rpath, @executable_path, @loader_path, chemins absolus) doit se résoudre dans le paquet
// ou sur le disque. À faire AVANT de prendre le verrou d'écran : un paquet qui ne démarre pas
// (« no LC_RPATH's found ») est refusé en une seconde au lieu d'occuper l'écran une minute.
//   node bench/update/preflight.mjs <chemin du .app>   → 0 si tout se résout, 1 sinon
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARCH = process.arch === "arm64" ? "arm64" : "x86_64";
// -m : « Helper (GPU) » n'est pas un membre d'archive.
const otool = (...args) => execFileSync("otool", ["-m", "-arch", ARCH, ...args], { stdio: ["ignore", "pipe", "ignore"] }).toString();
const isSystem = (p) => p.startsWith("/usr/lib/") || p.startsWith("/System/");

const rpathsOf = (file) => [...otool("-l", file).matchAll(/cmd LC_RPATH\n\s+cmdsize \d+\n\s+path (.+) \(offset \d+\)/g)].map((m) => m[1]);
function depsOf(file) {
  const id = otool("-D", file).split("\n")[1]?.trim();
  const deps = otool("-L", file).split("\n").slice(1).map((l) => l.trim().replace(/ \(compatibility .*$/, "")).filter(Boolean);
  return deps.filter((d, i) => !(i === 0 && d === id));
}

// Remplace @executable_path / @loader_path ; @rpath est essayé contre chaque rpath connu.
const expand = (p, exeDir, loaderDir) => path.normalize(p.replace(/^@executable_path/, exeDir).replace(/^@loader_path/, loaderDir));
function resolve(dep, { exeDir, loaderDir, rpaths }) {
  if (!dep.startsWith("@rpath/")) {
    const full = expand(dep, exeDir, loaderDir);
    return existsSync(full) ? full : null;
  }
  for (const rp of rpaths) {
    const full = path.join(expand(rp, exeDir, loaderDir), dep.slice("@rpath/".length));
    if (existsSync(full)) return full;
  }
  return null;
}

// Un exécutable et ce qu'il charge (récursivement dans le paquet), avec la pile de rpaths de dyld.
function walk(exe, problems, seen = new Set()) {
  const exeDir = path.dirname(exe);
  const visit = (file, inherited) => {
    if (seen.has(file)) return;
    seen.add(file);
    const rpaths = [...rpathsOf(file), ...inherited];
    for (const dep of depsOf(file)) {
      if (isSystem(dep)) continue;
      const found = resolve(dep, { exeDir, loaderDir: path.dirname(file), rpaths });
      if (!found) {
        const why = dep.startsWith("@rpath/") && !rpaths.length ? "aucun LC_RPATH" : `rpaths : ${rpaths.join(", ") || "—"}`;
        problems.push(`${path.relative(path.dirname(path.dirname(path.dirname(exe))), file) || file} → ${dep} introuvable (${why})`);
      } else if (found.endsWith(".dylib") && !isSystem(found)) {
        visit(found, rpaths);
      }
    }
  };
  visit(exe, []);
}

export function preflight(app) {
  const problems = [];
  const plist = path.join(app, "Contents/Info.plist");
  if (!existsSync(plist)) return [`${app} : pas d'Info.plist`];
  const name = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleExecutable", plist]).toString().trim();
  const exes = [path.join(app, "Contents/MacOS", name), path.join(app, "Contents/MacOS/tentacle-update")];
  const fw = path.join(app, "Contents/Frameworks");
  if (existsSync(fw)) {
    for (const h of readdirSync(fw).filter((n) => n.endsWith(".app"))) {
      const dir = path.join(fw, h, "Contents/MacOS");
      if (existsSync(dir)) exes.push(...readdirSync(dir).map((n) => path.join(dir, n)));
    }
  }
  for (const exe of exes) {
    if (!existsSync(exe)) problems.push(`${path.relative(app, exe)} absent`);
    else walk(exe, problems);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = path.resolve(process.argv[2] || "");
  const problems = preflight(app);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.log(problems.length ? `[maj] ${app} NE PEUT PAS démarrer (${problems.length} problème(s))` : `[maj] ${app} : chargement résolu`);
  process.exit(problems.length ? 1 : 0);
}
