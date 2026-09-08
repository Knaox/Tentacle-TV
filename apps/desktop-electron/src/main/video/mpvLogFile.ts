/**
 * Où le journal de mpv a le droit d'être écrit.
 *
 * # Pourquoi le chemin ne peut pas venir de la page
 *
 * ⚠️ `/tmp/tentacle-mpv.log` — ce que la page demandait — **n'existe pas pour un
 * paquet du Mac App Store** : le bac à sable interdit `/tmp`, et mpv échoue EN
 * SILENCE. Mesuré sur le paquet signé 1400749 : l'option est bien posée (mpv la
 * relit telle quelle par `log-file`), et aucun fichier n'apparaît ; le même
 * journal écrit 23 Kio sans broncher dès qu'on vise le conteneur. Autrement dit,
 * le drapeau `tentacle_mpv_log` était mort précisément là où il sert — chez
 * l'utilisateur, sur un paquet livré, quand plus rien d'autre n'est
 * instrumentable. Windows n'était pas mieux loti : `C:\tmp` n'existe pas par
 * défaut.
 *
 * La page dit donc qu'elle VEUT un journal ; le processus principal dit OÙ. Lui
 * seul connaît un dossier que les trois systèmes — et le bac à sable — laissent
 * écrire.
 *
 * # Pourquoi on ne garde que le nom
 *
 * ⚠️ La valeur vient de la page. L'allowlist filtre le NOM des options, pas leur
 * CONTENU : sans ce rabotage, un `../../../` écrirait où il veut. On ne retient
 * que le dernier segment, et on refuse ce qui n'est pas un nom de fichier.
 */

import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { app } from "electron";
import type { MpvValue } from "./mpvAllowlist";

/** Le nom retenu quand la page n'en propose pas d'utilisable. */
const DEFAULT_NAME = "tentacle-mpv.log";

/**
 * Le nom de fichier sûr correspondant à ce que la page a demandé.
 *
 * `basename` seul ne suffit pas : il rend `".."` tel quel, et une valeur vide
 * donnerait un chemin qui désigne le dossier.
 */
export function safeLogName(requested: MpvValue): string {
  const name = basename(String(requested).replace(/\\/g, "/")).trim();
  if (name === "" || name === "." || name === "..") return DEFAULT_NAME;
  return name;
}

/**
 * Réécrit `log-file` vers le dossier donné. Sans `log-file`, rien ne change —
 * le journal reste ce qu'il est : un outil qu'on allume, jamais un défaut.
 */
export function resolveLogFile(
  options: Readonly<Record<string, MpvValue>>,
  logsDir: string,
): Record<string, MpvValue> {
  const requested = options["log-file"];
  if (requested === undefined) return { ...options };
  return { ...options, "log-file": join(logsDir, safeLogName(requested)) };
}

/**
 * Le dossier des journaux, créé au besoin — mpv ne crée pas l'arborescence et
 * abandonnerait son journal sans le dire.
 */
function logsDirectory(): string {
  const dir = app.getPath("logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Le point d'entrée du processus principal : options entrantes, options avec un
 * journal réellement écrivable.
 *
 * Le chemin retenu est annoncé sur la sortie standard : c'est la seule façon de
 * le retrouver dans un paquet livré, où il est enfoui dans le conteneur du bac
 * à sable — et l'application se lance justement au terminal quand on en est là.
 */
export function withWritableLogFile(
  options: Readonly<Record<string, MpvValue>>,
): Record<string, MpvValue> {
  if (options["log-file"] === undefined) return { ...options };
  const resolved = resolveLogFile(options, logsDirectory());
  console.log(`[tentacle] journal mpv : ${String(resolved["log-file"])}`);
  return resolved;
}
