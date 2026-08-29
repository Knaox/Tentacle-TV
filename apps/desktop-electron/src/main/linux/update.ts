/**
 * L'auto-updater de Linux : détecter le format, télécharger, installer.
 *
 * Portage direct de `linux_update/{detect,install}.rs` de l'app Tauri. Le
 * contrat avec la page ne change pas d'un mot — `apps/web/src/lib/linuxUpdate.ts`
 * et le manifeste `updates/store-versions.json` sont inchangés.
 *
 * # Pourquoi un updater à nous, alors que les stores font le travail ailleurs
 *
 * Windows passe par le Microsoft Store, macOS par l'App Store. Linux n'a pas de
 * guichet unique : l'application est installée en `.deb`, `.rpm`, `.pkg.tar.zst`
 * ou en AppImage, et **c'est le format qui décide de la façon de mettre à jour**.
 * L'updater de Tauri lui-même ne gérait pas pacman ; celui-ci gère les quatre.
 *
 * # Ce qui garantit l'intégrité
 *
 * Le SHA-256 du manifeste, vérifié en flux pendant le téléchargement, et le
 * fichier effacé s'il ne correspond pas. Ce n'est pas une ceinture de plus :
 * la signature locale de pacman est facultative, et rien d'autre ne protège
 * l'utilisateur d'un octet retourné en route.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export type LinuxFormat = "appimage" | "deb" | "rpm" | "pacman" | "unknown";

/** Le dossier des paquets téléchargés — jamais celui de l'utilisateur. */
function tempFolder(): string {
  const d = path.join(tmpdir(), "tentacle-update");
  mkdirSync(d, { recursive: true });
  return d;
}

/** `true` si la commande s'exécute ET réussit — donc si le paquet possède le binaire. */
function owns(command: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, [...args], { stdio: "ignore" });
      child.on("error", () => { resolve(false); });
      child.on("exit", (code) => { resolve(code === 0); });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Comment cette application a été installée.
 *
 * L'ordre compte : `$APPIMAGE` d'abord, parce qu'une AppImage lancée sur une
 * machine où le paquet est AUSSI installé se ferait sinon prendre pour lui, et
 * on remplacerait le mauvais fichier. Puis le gestionnaire qui possède le
 * binaire courant. Sinon `unknown` — et la page ne propose alors rien plutôt que
 * de toucher à une installation qu'on ne comprend pas.
 */
export async function detectFormat(): Promise<LinuxFormat> {
  if ((process.env["APPIMAGE"] ?? "") !== "") return "appimage";
  const exe = process.execPath;
  if (await owns("pacman", ["-Qo", exe])) return "pacman";
  if (await owns("dpkg", ["-S", exe])) return "deb";
  if (await owns("rpm", ["-qf", exe])) return "rpm";
  return "unknown";
}

export interface Download {
  url: string;
  sha256: string;
  fileName: string;
  /** Progression 0..1, appelée à chaque bloc. */
  onProgress: (fraction: number) => void;
}

/**
 * Le nom de fichier, débarrassé de tout ce qui désigne un chemin.
 *
 * ⚠️ Il vient du MANIFESTE, donc du réseau. Sans ce nettoyage, un nom fabriqué
 * écrirait où il voudrait sur le disque — `../../.bashrc` est le cas d'école.
 * Les séparateurs partent, et le résultat est de toute façon rejoint à un
 * dossier temporaire dont il ne peut plus sortir.
 */
export function nameFrom(fileName: string): string {
  const bare = fileName.replace(/[/\\]/g, "_").replace(/^\.+/, "_");
  return bare === "" ? "paquet" : bare;
}

/** Télécharge le paquet, vérifie son empreinte, rend son chemin local. */
export async function download(t: Download): Promise<string> {
  const destination = path.join(tempFolder(), nameFrom(t.fileName));
  const response = await fetch(t.url, { redirect: "follow" });
  if (!response.ok || response.body === null) {
    throw new Error(`téléchargement échoué : ${String(response.status)} ${response.statusText}`);
  }
  const total = Number(response.headers.get("content-length") ?? "0");
  const digest = createHash("sha256");
  let received = 0;

  async function* count(): AsyncGenerator<Uint8Array> {
    // `reponse.body` est un flux web : on le parcourt, on compte, on hache.
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      digest.update(chunk);
      received += chunk.byteLength;
      if (total > 0) t.onProgress(received / total);
      yield chunk;
    }
  }

  await pipeline(count(), createWriteStream(destination));

  if (t.sha256 !== "") {
    const granted = digest.digest("hex");
    if (granted.toLowerCase() !== t.sha256.toLowerCase()) {
      rmSync(destination, { force: true });
      throw new Error(`SHA256 invalide (attendu ${t.sha256}, obtenu ${granted})`);
    }
  }
  return destination;
}

/** Un exécutable est-il dans le `PATH` ? */
function onPath(binary: string): boolean {
  const paths = (process.env["PATH"] ?? "").split(path.delimiter).filter((p) => p !== "");
  return paths.some((d) => existsSync(path.join(d, binary)));
}

/**
 * Exécute une commande en root par `pkexec` — l'invite graphique de polkit.
 *
 * ⚠️ Sans `pkexec`, on ne se rabat PAS sur `sudo` : il n'y a pas de terminal
 * pour saisir un mot de passe, et l'appel resterait suspendu sans rien montrer.
 * On rend la commande à taper, ce qui est une dégradation honnête.
 */
function escalate(manager: string, args: readonly string[]): Promise<void> {
  if (!onPath("pkexec")) {
    return Promise.reject(new Error(
      `pkexec introuvable (installer polkit). À la main : sudo ${manager} ${args.join(" ")}`,
    ));
  }
  return new Promise((resolve, reject) => {
    const child = spawn("pkexec", [manager, ...args], { stdio: "ignore" });
    child.on("error", (e) => { reject(new Error(`pkexec : ${e.message}`)); });
    child.on("exit", (code) => {
      // 126 = non autorisé, 127 = annulé dans le dialogue polkit.
      if (code === 0) resolve();
      else reject(new Error(`installation annulée ou refusée (pkexec code ${String(code)})`));
    });
  });
}

/**
 * Remplace l'AppImage en cours d'exécution par la nouvelle.
 *
 * Le fichier courant est d'abord renommé — pas écrasé : un binaire en cours
 * d'exécution ne se réécrit pas, mais son inode survit à un renommage. La
 * sauvegarde est restaurée si la copie échoue, et effacée seulement après.
 */
function replaceAppImage(next: string): void {
  const target = process.env["APPIMAGE"] ?? "";
  if (target === "") throw new Error("$APPIMAGE absent (l'application n'est pas lancée en AppImage)");
  const backup = `${target}.bak`;
  renameSync(target, backup);
  try {
    copyFileSync(next, target);
    chmodSync(target, 0o755);
  } catch (e) {
    renameSync(backup, target);
    throw new Error(`remplacement AppImage échoué : ${String(e)}`);
  }
  rmSync(backup, { force: true });
}

/** Installe le paquet téléchargé, selon le format d'origine. */
export async function install(path: string, format: LinuxFormat): Promise<void> {
  switch (format) {
    case "pacman": return escalate("pacman", ["-U", "--noconfirm", path]);
    case "deb": return escalate("apt-get", ["install", "-y", path]);
    case "rpm": return escalate("dnf", ["install", "-y", path]);
    case "appimage": return Promise.resolve(replaceAppImage(path));
    default: throw new Error(`format non géré : ${format}`);
  }
}
