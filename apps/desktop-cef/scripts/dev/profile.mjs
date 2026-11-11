// Profil : le dossier de données du bureau (stockage du front repris), et le profil Chromium de CEF à côté.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cache, capture, die, platform, say } from "./common.mjs";

/**
 * L'identifiant du dossier de données du bureau, hérité des coquilles d'avant (Tauri puis
 * Electron) et GARDÉ : le renommer ferait perdre session, réglages et cache d'Octave à chaque
 * installation existante. Chaîne traversée : ne se renomme jamais.
 */
export const DATA_IDENTIFIER = "com.tentacle.media";

/**
 * Le dossier de données du bureau (le « profil d'Electron » du temps de cette coquille) :
 * Application Support/<identifiant> sous macOS, %APPDATA%\<identifiant> sous Windows,
 * $XDG_DATA_HOME ou ~/.local/share sous Linux. Une app du Mac App Store vit dans son
 * conteneur (bac à sable) : à viser par TENTACLE_ELECTRON_PROFILE (nom historique).
 */
export function electronProfile() {
  const forced = process.env.TENTACLE_ELECTRON_PROFILE;
  if (forced) return forced.replace(/[\\/]+$/, "");
  const id = DATA_IDENTIFIER;
  switch (platform) {
    case "darwin":
      return path.join(os.homedir(), "Library/Application Support", id);
    case "win32": {
      const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      return path.join(appData, id);
    }
    case "linux": {
      const xdg = process.env.XDG_DATA_HOME;
      // Relatif = invalide au sens de la spécification XDG (même règle que dataPaths.ts).
      return path.join(xdg && path.isAbsolute(xdg) ? xdg : path.join(os.homedir(), ".local/share"), id);
    }
    default:
      die(`système non pris en charge par le lanceur : ${platform}`);
  }
}

/**
 * PARTAGÉ avec Electron : ce que le front range sous son origine tentacle://app — `Local
 * Storage` (jeton, adresse du serveur, réglages) et `IndexedDB` (cache d'Octave, pochettes
 * gardées). Le reste du profil Chromium (cookies, cache, historique) reste à CEF : autre
 * version de Chromium, autre disposition, autre clé de chiffrement des cookies.
 */
export const sharedStorage = ["Local Storage", "IndexedDB"];

/** POSIX `cksum` (CRC du standard) : le nom des profils CEF d'un profil d'Electron forcé. */
function cksum(text) {
  const data = Buffer.from(text, "utf8");
  let crc = 0;
  const step = (byte) => {
    crc ^= byte << 24;
    for (let i = 0; i < 8; i++) crc = crc & 0x80000000 ? ((crc << 1) ^ 0x04c11db7) >>> 0 : (crc << 1) >>> 0;
  };
  for (const b of data) step(b);
  for (let n = data.length; n > 0; n >>>= 8) step(n & 0xff);
  return (~crc >>> 0).toString();
}

/** Racine du profil CEF (état de Chromium, caches GPU…), hors du dossier d'Electron. */
export function cefProfileFor(electron) {
  if (!process.env.TENTACLE_ELECTRON_PROFILE) return path.join(cache, "profiles", "electron");
  return path.join(cache, "profiles", `electron-${cksum(electron)}`);
}

/** PID qui tiennent ce fichier ouvert : lsof (macOS), /proc (Linux), rien (Windows). */
function holdersOf(file) {
  if (platform === "darwin") {
    const out = capture("lsof", ["-t", "--", file]);
    return out ? out.split(/\s+/).filter(Boolean) : [];
  }
  if (platform !== "linux") return [];
  const target = fs.realpathSync(file);
  const pids = [];
  for (const pid of fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d))) {
    let fds;
    try {
      fds = fs.readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue; // processus d'un autre utilisateur, ou déjà parti
    }
    for (const fd of fds) {
      try {
        if (fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === target) {
          pids.push(pid);
          break;
        }
      } catch {}
    }
  }
  return pids;
}

function pidAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function describe(pid) {
  if (platform === "linux") {
    try {
      return `${pid} ${fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim()}`;
    } catch {}
  }
  return capture("ps", ["-o", "pid=,comm=", "-p", String(pid)]) || String(pid);
}

/**
 * Jamais Electron et CEF sur les mêmes bases LevelDB en même temps : le second n'obtient pas
 * leur verrou (LOCK) et tourne sur un stockage EN MÉMOIRE — déconnecté, et ce qu'il écrit est
 * perdu à la fermeture. On refuse de lancer tant qu'un processus les tient.
 * Windows : Electron n'y pose pas de SingletonLock et les verrous ne se lisent pas sans outil ;
 * la garde y passe par le verrou exclusif de LevelDB (voir windows.mjs).
 */
export function guardProfileFree(profile, extraHolders = () => []) {
  const holders = new Set();
  // Electron pose SingletonLock (requestSingleInstanceLock) : un lien « hôte-pid ».
  try {
    const target = fs.readlinkSync(path.join(profile, "SingletonLock"));
    const i = target.lastIndexOf("-");
    const host = target.slice(0, i);
    const pid = target.slice(i + 1);
    if (host === os.hostname() && pidAlive(pid)) holders.add(pid);
  } catch {}
  const locks = [path.join(profile, "Local Storage/leveldb/LOCK")];
  try {
    for (const d of fs.readdirSync(path.join(profile, "IndexedDB"))) locks.push(path.join(profile, "IndexedDB", d, "LOCK"));
  } catch {}
  for (const lock of locks) {
    if (!fs.existsSync(lock)) continue;
    for (const pid of holdersOf(lock)) holders.add(pid);
  }
  for (const pid of extraHolders(profile, locks)) holders.add(pid);
  if (holders.size === 0) return;
  console.error("dev : le profil d'Electron est ouvert par un autre processus :");
  for (const pid of [...holders].sort()) console.error(`  ${describe(pid)}`);
  die("fermer Tentacle TV (Electron) — ou l'autre Tentacle CEF — puis relancer");
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Des liens depuis le profil CEF vers le stockage d'Electron : ce que l'un écrit, l'autre le
 * relit. Windows : jonctions (aucun droit d'administrateur ni mode développeur requis).
 */
export function prepareProfile(electron, cef) {
  if (!fs.existsSync(electron)) say(`profil d'Electron absent, créé : ${electron} (pnpm dev:electron le reprendra)`);
  fs.mkdirSync(path.join(cef, "Default"), { recursive: true });
  for (const name of sharedStorage) {
    const target = path.join(electron, name);
    fs.mkdirSync(target, { recursive: true });
    const link = path.join(cef, "Default", name);
    let st = null;
    try {
      st = fs.lstatSync(link);
    } catch {}
    if (st?.isSymbolicLink()) {
      if (path.resolve(path.dirname(link), fs.readlinkSync(link)) === path.resolve(target)) continue;
      fs.unlinkSync(link);
    } else if (st) {
      // Un stockage propre à CEF (lancement d'avant le partage) : mis de côté, jamais effacé.
      fs.renameSync(link, `${link}.cef-${stamp()}`);
    }
    fs.symlinkSync(target, link, platform === "win32" ? "junction" : "dir");
  }
}
