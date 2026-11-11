// Téléchargements épinglés : chaque binaire a sa version ET son empreinte, vérifiées AVANT
// d'être extraites ; rien ne s'exécute depuis une archive non vérifiée.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { capture, die, platform, run, say, warn } from "./common.mjs";

/** Garde-fou du lot : pas de gros téléchargement en partage de connexion (iPhone). */
export function refuseOnTethering(what) {
  if (process.env.TENTACLE_ALLOW_TETHERING === "1") return;
  let gw = null;
  if (platform === "darwin") gw = /gateway: (\S+)/.exec(capture("route", ["-n", "get", "default"]) || "")?.[1];
  else if (platform === "linux") gw = /default via (\S+)/.exec(capture("ip", ["route", "show", "default"]) || "")?.[1];
  if (gw === "172.20.10.1") {
    die(`partage de connexion détecté (passerelle ${gw}) : téléchargement de ${what} refusé — TENTACLE_ALLOW_TETHERING=1 pour passer outre`);
  }
}

function digest(file, algo) {
  const h = createHash(algo);
  const fd = fs.openSync(file, "r");
  const buf = Buffer.allocUnsafe(1 << 20);
  for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest("hex");
}

/**
 * Vérifie l'archive contre ses empreintes épinglées. `pin.sha256` est exigée ; `pin.sha1`
 * (publiée par le CDN de CEF) est vérifiée en plus quand elle est connue. Une empreinte
 * SHA-256 encore absente du dépôt n'est acceptée que si la SHA-1 publiée concorde, et le
 * lanceur imprime alors la SHA-256 à épingler (TOFU signalé, jamais silencieux).
 */
export function verify(file, pin) {
  if (pin.sha1) {
    const got = digest(file, "sha1");
    if (got !== pin.sha1) return `SHA-1 inattendue : ${got} (attendue ${pin.sha1})`;
  }
  const got256 = digest(file, "sha256");
  if (pin.sha256) {
    if (got256 !== pin.sha256) return `SHA-256 inattendue : ${got256} (attendue ${pin.sha256})`;
  } else if (pin.sha1) {
    warn(`${path.basename(file)} : SHA-256 pas encore épinglée — ${got256} (la SHA-1 publiée concorde) ; à recopier dans le dépôt`);
  } else {
    return "aucune empreinte épinglée : refusé";
  }
  return null;
}

/** Télécharge `url` vers `dest` (fichier .part puis renommage), avec un avancement sobre. */
export async function download(url, dest, sizeHint = 0) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  say(`téléchargement de ${url}`);
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { redirect: "follow" });
      if (res.ok) break;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt >= 3) die(`téléchargement impossible (${url}) : ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  const total = Number(res.headers.get("content-length")) || sizeHint;
  const out = fs.createWriteStream(part);
  let done = 0;
  let shown = -1;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    done += chunk.length;
    const pct = total ? Math.floor((done * 100) / total) : -1;
    if (pct >= 0 && pct >= shown + 10) {
      shown = pct - (pct % 10);
      process.stderr.write(`  ${shown} % (${Math.round(done / 1e6)} Mo)\n`);
    }
  }
  await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
  fs.renameSync(part, dest);
}

/** `tar` du système : bsdtar de Windows (System32) en priorité, qui lit bz2 et zip. */
export function tarBinary() {
  if (platform === "win32") {
    const sys = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    if (fs.existsSync(sys)) return sys;
  }
  return "tar";
}

/**
 * Renomme un dossier fraîchement extrait. Sous Windows, l'antivirus tient encore des fichiers
 * d'une grosse archive (CEF : des milliers) quelques instants après l'extraction : le renommage
 * répond EPERM ou EBUSY, puis passe. Cinq essais, une seconde entre deux (lot rf2 : lu dans le
 * code, non exécuté). Ailleurs, le premier essai passe.
 */
function renamePatiently(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e;
      warn(`renommage retenu (${e.code}), nouvel essai ${attempt}/4…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
}

/**
 * Télécharge (si besoin), vérifie, extrait dans un dossier temporaire et renomme le dossier
 * `inner` de l'archive en `dest`. Idempotent : `marker` présent sous `dest` = déjà prêt.
 */
export async function fetchArchive({ url, pin, dest, inner, marker, sizeHint, what, small = false }) {
  if (fs.existsSync(path.join(dest, marker))) return dest;
  const dl = path.join(path.dirname(dest), ".dl");
  const archive = path.join(dl, decodeURIComponent(path.basename(new URL(url).pathname)));
  if (!fs.existsSync(archive) || verify(archive, pin)) {
    if (!small) refuseOnTethering(what);
    await download(url, archive, sizeHint);
  }
  const bad = verify(archive, pin);
  if (bad) die(`${what} : ${bad}`);
  const tmp = path.join(dl, `extract.${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  say(`extraction de ${path.basename(archive)}`);
  run(tarBinary(), ["-xf", archive, "-C", tmp]);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  renamePatiently(path.join(tmp, inner), dest);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(archive, { force: true });
  say(`${what} prêt : ${dest}`);
  return dest;
}
