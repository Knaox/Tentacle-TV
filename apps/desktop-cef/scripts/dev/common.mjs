// Outils communs du lanceur (`pnpm dev:cef`) : chemins, sortie, processus. Node seul, aucune
// dépendance : ce fichier tourne sur macOS, Linux et Windows tel quel.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** apps/desktop-cef */
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Racine du monorepo. */
export const repo = path.resolve(root, "../..");
export const cache = process.env.TENTACLE_CEF_CACHE || path.join(os.homedir(), ".cache", "tentacle-cef");
export const bancUrl = "http://127.0.0.1:3471";
export const platform = process.platform; // "darwin" | "linux" | "win32"

export class DevError extends Error {}

/** Arrête le lanceur avec un message (le `die` de l'ancien dev.sh). */
export function die(message) {
  throw new DevError(message);
}

export function say(message) {
  console.log(`dev : ${message}`);
}

export function warn(message) {
  console.error(`dev : ⚠ ${message}`);
}

/**
 * Dossier de build : `tv`, ou `tv-<worktree>` dans un worktree — jamais `dev`, qu'occupe le
 * dépôt d'origine du prototype (CMake refuse qu'un même dossier serve deux sources).
 * TENTACLE_BUILD l'emporte. Même règle que l'ancien dev.sh.
 */
export function buildName() {
  if (process.env.TENTACLE_BUILD) return process.env.TENTACLE_BUILD;
  const parts = root.split(path.sep);
  const i = parts.lastIndexOf("worktrees");
  if (i > 0 && parts[i - 1] === ".claude" && parts[i + 1]) return `tv-${parts[i + 1]}`;
  return "tv";
}

/** Mode « à blanc » (TENTACLE_DEV_DRY=1) : les builds et l'app sont imprimés, pas lancés. */
export const dry = process.env.TENTACLE_DEV_DRY === "1";

/** Lance une commande, sortie au terminal ; arrête le lanceur si elle échoue. */
export function run(cmd, args, options = {}) {
  if (dry) {
    console.log(["DRY", cmd, ...args].join(" "));
    return;
  }
  const r = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (r.error) die(`${cmd} introuvable ou refusé : ${r.error.message}`);
  if (r.status !== 0) die(`${[cmd, ...args].join(" ")} a échoué (code ${r.status ?? r.signal})`);
}

/**
 * Un chemin pour CMake : des barres obliques, sur les trois OS. Un `-DVAR=C:\Users\…` garde ses
 * antislashs dans le cache de CMake ; recopié dans un fichier généré ou une définition de
 * compilation, `\U` et `\t` y deviennent des séquences d'échappement (lot rf2 : lu, non exécuté).
 */
export function cmakePath(p) {
  return String(p).replaceAll("\\", "/");
}

/** Sortie standard d'une commande (texte rogné), ou null si elle échoue. */
export function capture(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
}

/** Chemin d'un exécutable du PATH, ou null. */
export function which(name) {
  const exts = platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, name + ext.toLowerCase());
      const q = path.join(dir, name + ext);
      for (const c of [p, q]) {
        try {
          if (fs.statSync(c).isFile()) return c;
        } catch {}
      }
    }
  }
  return null;
}

/** Compare deux versions « a.b.c » : vrai si `have` >= `want`. */
export function versionAtLeast(have, want) {
  const a = String(have).split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const b = String(want).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

/** Version du bureau (versions.json → desktop), comme `node -p` dans l'ancien dev.sh. */
export function desktopVersion() {
  return JSON.parse(fs.readFileSync(path.join(repo, "versions.json"), "utf8")).desktop;
}

/**
 * Le build web de la coquille de bureau, en développement. `TENTACLE_SHELL=electron` est le nom
 * HISTORIQUE de la cible « coquille de bureau » lu par apps/web/vite.config.ts : ne pas le
 * changer d'un seul côté.
 */
export function buildWeb() {
  if (!fs.existsSync(path.join(repo, "pnpm-workspace.yaml"))) die(`monorepo introuvable au-dessus de ${root}`);
  // Windows : `pnpm` par l'interpréteur (cmd), qui résout lui-même `pnpm.cmd` (npm, corepack) OU
  // `pnpm.exe` (l'installateur autonome, winget) par PATHEXT. Nommer `pnpm.cmd` échouait avec un
  // pnpm installé en `.exe` (« n'est pas reconnu… ») — lu dans le code, lot rf2, non exécuté.
  run("pnpm", ["--filter", "@tentacle-tv/web", "build"], {
    cwd: repo,
    env: { ...process.env, TENTACLE_SHELL: "electron", TENTACLE_DEBUG: "1" },
    shell: platform === "win32",
  });
}

/**
 * Son : ouvert, sauf --mute ou TENTACLE_MUTE. TENTACLE_ALLOW_SOUND est l'interrupteur du
 * lecteur (muet par défaut) ; --mute et TENTACLE_MUTE sont transmis tels quels.
 */
export function soundEnv(env, mute) {
  if (mute) {
    env.TENTACLE_MUTE = "1";
    delete env.TENTACLE_ALLOW_SOUND;
  } else {
    env.TENTACLE_ALLOW_SOUND = "1";
  }
  return env;
}

/**
 * Lance l'app et lui laisse le terminal. Node ne sait pas remplacer son processus (exec) :
 * il attend l'app et rend son code. Ctrl+C atteint aussi l'app (même groupe de processus).
 * TENTACLE_DEV_DRY=1 : imprime la commande et l'environnement du lecteur, sans lancer.
 */
export function launch(binary, args, env) {
  if (dry) {
    const shown = ["TENTACLE_MUTE", "TENTACLE_ALLOW_SOUND"].filter((k) => k in env).map((k) => `${k}=${env[k]}`);
    console.log(["DRY", ...shown, binary, ...args].join("\n  "));
    return Promise.resolve(0);
  }
  return new Promise((resolve) => {
    const child = spawn(binary, args, { stdio: "inherit", env });
    // Le signal est déjà parvenu à l'app : le lanceur l'attend sans mourir avant elle.
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => {});
    child.on("error", (e) => {
      console.error(`dev : lancement impossible : ${e.message}`);
      resolve(1);
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

/** Le serveur répond-il ? Pour le banc, dit quoi faire (colima, pnpm banc up). */
export async function checkServer(url) {
  let ok = false;
  try {
    const ctl = AbortSignal.timeout(5000);
    await fetch(`${url}/`, { signal: ctl, redirect: "manual" });
    ok = true;
  } catch {}
  if (ok) return;
  if (url === bancUrl) {
    if (platform !== "darwin" || capture("colima", ["status"]) === null) {
      die(`le banc ne répond pas sur ${url}${platform === "darwin" ? " et colima est arrêté — lancez : colima start && pnpm banc up" : " — démarrez-le (pnpm banc up sous macOS) ou donnez TENTACLE_URL"}`);
    }
    die(`le banc ne répond pas sur ${url} (colima tourne) — lancez : pnpm banc up, puis pnpm banc status`);
  }
  die(`${url} ne répond pas (TENTACLE_URL)`);
}
