/**
 * Les icônes du bureau, entretenues — pour la seule AppImage.
 *
 * # Pourquoi personne ne le fait à notre place
 *
 * Les trois autres formats installent leurs icônes : `.deb`, `.rpm` et
 * `.pkg.tar.zst` posent `usr/share/icons/hicolor/…` dans le système, et une
 * mise à jour par le gestionnaire de paquets les remplace avec le reste.
 *
 * L'AppImage, elle, **n'installe rien** — c'est la définition du format, et
 * `prepareLegacyCompat` s'appuie dessus. Son icône et son `.desktop` ont été
 * posés à la main dans `~/.local/share/`, une fois, le jour de l'installation.
 * Notre updater (`update.ts`, `replaceAppImage`) remplace ensuite le fichier
 * exécutable et LUI SEUL : la barre des tâches continue d'afficher l'icône du
 * jour de l'installation, mise à jour après mise à jour, indéfiniment.
 *
 * # Pourquoi au DÉMARRAGE, et pas après l'installation
 *
 * Au moment où la mise à jour s'installe, l'AppImage montée sur `$APPDIR` est
 * l'ANCIENNE : ses icônes sont justement celles qu'on veut remplacer. Celles de
 * la neuve dorment dans un fichier qu'il faudrait monter pour les lire. Au
 * démarrage suivant, en revanche, `$APPDIR` EST la nouvelle version — le
 * rafraîchissement n'a plus qu'à recopier. Il rattrape du même coup les
 * installations remplacées à la main, et celles déjà périmées.
 *
 * # Ce qu'il ne fait pas, volontairement
 *
 * Il ne CRÉE rien : sans une icône déjà posée, l'application n'est pas intégrée
 * au bureau, et ce n'est pas à une mise à jour d'en décider. Il ne touche
 * jamais à `/usr` — tout vit dans le `$HOME`, sans privilèges, sans `pkexec`.
 *
 * Limite honnête : les caches d'icônes sont invalidés, mais un shell déjà lancé
 * peut garder l'ancienne image en mémoire jusqu'à sa propre relance. L'icône
 * est juste au plus tard à l'ouverture de session suivante.
 */

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Le nom du fichier d'icône, tel que le `.desktop` le désigne (`Icon=tentacle-tv`). */
const ICON_FILE = "tentacle-tv.png";

/** Les tailles qu'`electron-builder` embarque dans l'AppImage. */
const SIZES = ["32x32", "64x64", "128x128", "256x256", "512x512"] as const;

export interface IconCopy {
  from: string;
  to: string;
}

/** Le dossier de thème de l'utilisateur — jamais celui du système. */
export function userIconRoot(home: string = homedir()): string {
  return path.join(home, ".local", "share", "icons", "hicolor");
}

function iconPath(root: string, size: string): string {
  return path.join(root, size, "apps", ICON_FILE);
}

/** Deux fichiers au contenu identique ? La taille d'abord, elle tranche presque toujours. */
function sameBytes(a: string, b: string): boolean {
  try {
    if (statSync(a).size !== statSync(b).size) return false;
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

/**
 * Ce qu'il y a à recopier, et rien de plus.
 *
 * Vide si l'application n'est pas intégrée au bureau (aucune icône posée) ou si
 * tout est déjà à jour — le cas ordinaire, à chaque démarrage.
 *
 * Dès qu'UNE taille est posée, toutes celles que l'AppImage porte sont écrites :
 * une intégration faite à la main n'en pose souvent qu'une, et la barre des
 * tâches réduit alors un 512 au lieu de lire le 32 qui lui est destiné.
 */
export function iconRefreshPlan(appDir: string, iconRoot: string): readonly IconCopy[] {
  if (appDir === "") return [];
  const integrated = SIZES.some((size) => existsSync(iconPath(iconRoot, size)));
  if (!integrated) return [];

  const plan: IconCopy[] = [];
  for (const size of SIZES) {
    const from = path.join(appDir, "usr", "share", "icons", "hicolor", size, "apps", ICON_FILE);
    if (!existsSync(from)) continue;
    const to = iconPath(iconRoot, size);
    if (sameBytes(from, to)) continue;
    plan.push({ from, to });
  }
  return plan;
}

/**
 * Les caches d'icônes, invalidés — sans quoi le disque est juste et l'écran faux.
 *
 * GTK lit un cache binaire par dossier de thème ; KDE garde le sien dans un
 * fichier mmap partagé, qu'il régénère seul dès qu'il a disparu. Les deux
 * échecs sont sans conséquence : le bureau se rattrape à la session suivante.
 */
function invalidateCaches(iconRoot: string, home: string): void {
  try {
    const child = spawn("gtk-update-icon-cache", ["-f", "-t", iconRoot], { stdio: "ignore" });
    // Sans ce gestionnaire, l'absence du binaire remonterait en exception non
    // capturée du processus principal.
    child.on("error", () => { /* GTK n'est pas installé : rien à invalider. */ });
  } catch { /* idem */ }
  rmSync(path.join(home, ".cache", "icon-cache.kcache"), { force: true });
}

/**
 * Remet les icônes du bureau au niveau de l'AppImage en cours d'exécution.
 *
 * Sans effet hors AppImage : `$APPDIR` n'y est pas posée, et les trois autres
 * formats ont déjà reçu leurs icônes du gestionnaire de paquets. Rend le nombre
 * d'icônes réécrites — zéro au démarrage ordinaire.
 */
export function refreshDesktopIcons(
  appDir: string = process.env["APPDIR"] ?? "",
  home: string = homedir(),
): number {
  if (process.platform !== "linux") return 0;
  const iconRoot = userIconRoot(home);
  const plan = iconRefreshPlan(appDir, iconRoot);
  if (plan.length === 0) return 0;

  let written = 0;
  for (const { from, to } of plan) {
    try {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      written += 1;
    } catch (error) {
      console.warn(`[icones] ${to} non remplacée : ${String(error)}`);
    }
  }
  if (written > 0) {
    invalidateCaches(iconRoot, home);
    console.info(`[icones] ${String(written)} icône(s) du bureau remises à niveau`);
  }
  return written;
}
