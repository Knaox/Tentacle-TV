#!/usr/bin/env node
// Lanceur de développement : `pnpm dev:cef` à la racine du monorepo, et les scripts du
// package.json (pnpm --filter @tentacle-tv/desktop-cef dev | dev:server | build | banc).
// Node seul, aucune dépendance : macOS, Linux et Windows.
//
//   node scripts/dev.mjs run [opts…]         build web (coquille de bureau) + build natif, puis
//                                            l'app sur le PROFIL D'ELECTRON (scripts/dev/profile.mjs)
//   node scripts/dev.mjs run-server [opts…]  mode des bancs : page servie par $TENTACLE_URL (défaut :
//                                            le banc), profil à part $cache/profiles/dev, données
//                                            natives à part $cache/profiles/dev-data
//   node scripts/dev.mjs build               le build natif seul (Release)
//   node scripts/dev.mjs deps                Linux/Windows : prérequis et dépendances seulement
//   node scripts/dev.mjs banc [up|status]    banc local (colima + Tentacle 1.42.0 + Jellyfin)
//
// Options de `run` : --skip-web (garde apps/web/dist tel quel), --mute (son coupé, comme
// TENTACLE_MUTE=1) ; toute autre option va à l'app (--size=1440x900, --devtools-port=9300…).
// Variables : TENTACLE_ELECTRON_PROFILE (autre profil d'Electron), TENTACLE_URL (adresse du
// serveur posée dans le front s'il n'en a aucune), TENTACLE_BUILD (dossier de build),
// TENTACLE_DEV_DRY=1 (imprime la commande de l'app sans la lancer).
// Par OS : scripts/dev/{macos,linux,windows}.mjs (prérequis, dépendances, build, lancement).
import fs from "node:fs";
import path from "node:path";
import {
  DevError, bancUrl, buildWeb, cache, capture, checkServer, desktopVersion, die, launch, platform, repo, root, run, say, soundEnv,
} from "./dev/common.mjs";
import { cefProfileFor, electronProfile, guardProfileFree, prepareProfile } from "./dev/profile.mjs";

async function osModule() {
  switch (platform) {
    case "darwin":
      return (await import("./dev/macos.mjs")).macos;
    case "linux":
      return (await import("./dev/linux.mjs")).linux;
    case "win32":
      return (await import("./dev/windows.mjs")).windows;
    default:
      die(`système non pris en charge par le lanceur : ${platform}`);
  }
}

/** `pnpm dev -- --mute` : pnpm transmet le « -- ». */
function stripDashes(args) {
  return args[0] === "--" ? args.slice(1) : args;
}

async function runApp(rawArgs) {
  const os = await osModule();
  const args = [];
  let mute = Boolean(process.env.TENTACLE_MUTE);
  let skipWeb = false;
  for (const a of stripDashes(rawArgs)) {
    if (a === "--skip-web") skipWeb = true;
    else {
      if (a === "--mute") mute = true;
      args.push(a);
    }
  }
  const electron = electronProfile();
  const cef = cefProfileFor(electron);
  guardProfileFree(electron, os.extraHolders); // avant les builds : inutile d'attendre pour rien
  await os.prepare?.(); // prérequis et dépendances AVANT le long build web
  if (!skipWeb) buildWeb();
  if (!fs.existsSync(path.join(repo, "apps/web/dist/index.html"))) die("apps/web/dist absent : relancer sans --skip-web");
  const binary = await os.build();
  guardProfileFree(electron, os.extraHolders); // et juste avant de l'ouvrir
  prepareProfile(electron, cef);
  const version = desktopVersion();
  if (process.env.TENTACLE_URL) args.unshift(`--server-url=${process.env.TENTACLE_URL}`);
  const env = os.env(soundEnv({ ...process.env }, mute));
  say(`tentacle://app (${repo}/apps/web/dist) — profil d'Electron ${electron} — son ${mute ? "coupé" : "ouvert"}`);
  // Chromium diffère l'écriture du stockage et ne la termine qu'à une fermeture normale :
  // Ctrl+C tue aussi ses helpers, le service de stockage avec (mesuré : écriture perdue).
  say(`quitter par ${os.quitHint} — Ctrl+C perd ce que le front vient d'écrire`);
  return launch(
    binary,
    [
      "--url=tentacle://app/",
      `--web-root=${path.join(repo, "apps/web/dist")}`,
      `--profile=${cef}`,
      // --user-data : le dossier de données des modules natifs (shell/paths.h : octave-art/,
      // tentacle-local.db…) est le profil d'Electron visé, celui dont le front partage le stockage.
      `--user-data=${electron}`,
      `--app-version=${version}`,
      ...args,
    ],
    env,
  );
}

async function runServer(rawArgs) {
  const os = await osModule();
  const url = process.env.TENTACLE_URL || bancUrl;
  const args = stripDashes(rawArgs);
  const mute = Boolean(process.env.TENTACLE_MUTE) || args.includes("--mute");
  await checkServer(url);
  await os.prepare?.();
  const binary = await os.build();
  const env = os.env(soundEnv({ ...process.env }, mute));
  const profile = path.join(cache, "profiles", "dev");
  say(`${url} — profil ${profile} — son ${mute ? "coupé" : "ouvert"}`);
  // --user-data à part : sans lui, les modules natifs (shell/paths.h : octave-art/, tentacle-local.db…)
  // écriraient dans le VRAI dossier d'Electron. Les bancs n'y touchent jamais (reseau, 5ee55a228).
  const userData = path.join(cache, "profiles", "dev-data");
  return launch(binary, [`--url=${url}`, `--profile=${profile}`, `--user-data=${userData}`, ...args], env);
}

async function banc(rawArgs) {
  const cmd = stripDashes(rawArgs)[0] || "status";
  if (platform === "darwin" && capture("colima", ["status"]) === null) {
    if (cmd !== "up") die("colima est arrêté — lancez : colima start && pnpm banc up");
    run("colima", ["start"]);
  }
  if (platform === "win32") die("le banc se lance depuis macOS ou Linux (bench/server/banc.sh)");
  run(path.join(root, "bench/server/banc.sh"), [cmd]);
  return 0;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "build": {
      const os = await osModule();
      await os.prepare?.();
      await os.build();
      return 0;
    }
    case "deps": {
      const os = await osModule();
      await os.prepare?.();
      return 0;
    }
    case "run":
      return runApp(rest);
    case "run-server":
      return runServer(rest);
    case "banc":
      return banc(rest);
    default:
      die("usage : node scripts/dev.mjs build | deps | run [--skip-web] [options de l'app…] | run-server [options…] | banc [up|status]");
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    if (e instanceof DevError) {
      console.error(`dev : ${e.message}`);
      process.exit(1);
    }
    throw e;
  },
);
