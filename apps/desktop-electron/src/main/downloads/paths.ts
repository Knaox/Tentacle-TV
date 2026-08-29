/**
 * Racine de stockage, arborescence, espace disque et chemins sûrs.
 *
 * La racine par défaut est `<dossier de données>/downloads`. Elle est
 * configurable par `settings.storage_root`, et le changement est REFUSÉ tant
 * que des téléchargements existent — pas de migration automatique.
 *
 * Tous les chemins stockés en base sont RELATIFS à la racine et confinés à
 * `media/` ou `meta/`. `safeJoin` est la seule chose qui empêche une traversée
 * de dossier : ces chemins viennent de la base, mais la base a été remplie à
 * partir d'identifiants venus d'un serveur.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/fsops.rs`. N'importe pas
 * `electron` : le dossier de données lui est donné.
 */

import { existsSync, mkdirSync, renameSync, rmSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { integer } from "./rows";
import { settingGet, settingSet } from "./db";

export const STORAGE_ROOT_KEY = "storage_root";

/** Marge de sécurité : jamais moins de 2 Gio laissés libres sur le disque. */
export const CAPACITY_MARGIN_BYTES = 2 * 1024 * 1024 * 1024;

/** Seuls préfixes admis sous la racine. */
const PREFIXES = new Set(["media", "meta"]);

/**
 * Racine résolue, une seule lecture SQLite par session.
 *
 * Remplace le `RootCache` de Tauri, qui devait être un `RwLock` partagé entre
 * threads. Ici tout vit sur la boucle d'évènements : une variable suffit.
 */
let cache: string | null = null;

/** Racine par défaut, sous le dossier de données. */
export function defaultRoot(userDataDir: string): string {
  return path.join(userDataDir, "downloads");
}

/** Crée `media/` et `meta/` sous la racine. */
export function ensureLayout(root: string): void {
  for (const sub of ["media", "meta"]) mkdirSync(path.join(root, sub), { recursive: true });
}

/** Racine effective : cache mémoire → paramètre enregistré → défaut. */
export function resolveRoot(db: DatabaseSync, userDataDir: string): string {
  if (cache !== null) return cache;
  const root = settingGet(db, STORAGE_ROOT_KEY) ?? defaultRoot(userDataDir);
  ensureLayout(root);
  cache = root;
  return root;
}

/** Oublie la racine mémorisée. Réservé aux tests et à `setRoot`. */
export function forgetRoot(): void {
  cache = null;
}

/**
 * Change la racine.
 *
 * Codes d'erreur STABLES, consommés tels quels par l'interface :
 * `root-not-empty` (des téléchargements existent), `root-not-writable`.
 */
export function setRoot(db: DatabaseSync, newRoot: string): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM files").get();
  if (row !== undefined && integer(row, "n") > 0) throw new Error("root-not-empty");

  try {
    mkdirSync(newRoot, { recursive: true });
    ensureLayout(newRoot);
    // Un dossier créable n'est pas forcément inscriptible — lecteur réseau en
    // lecture seule, quota, ACL. On écrit vraiment pour le savoir.
    const probe = path.join(newRoot, ".tentacle-write-probe");
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
  } catch (error) {
    // Le code reste le PRÉFIXE — `api.ts` le lit tel quel. Ce qui suit est la
    // cause système, et elle n'est pas un luxe : dans un paquet livré (MSIX,
    // Mac App Store) le `console.error` du processus principal ne va nulle
    // part, si bien qu'un refus était impossible à expliquer. `EPERM` sur un
    // dossier du profil désigne l'accès contrôlé aux dossiers de Windows,
    // `EACCES` une ACL, `EROFS` un volume monté en lecture seule — trois
    // conduites à tenir différentes, que « pas accessible en écriture »
    // confondait en une seule.
    throw new Error(`root-not-writable: ${systemCause(error)}`);
  }

  settingSet(db, STORAGE_ROOT_KEY, newRoot);
  cache = newRoot;
  return newRoot;
}

/**
 * Cause système d'un échec d'écriture, en une ligne lisible.
 *
 * Le code errno ET le chemin fautif : `ensureLayout` crée deux sous-dossiers et
 * la sonde en écrit un troisième, savoir LEQUEL a cédé oriente le diagnostic.
 * Le message verbeux de Node est écarté — il répète le code et l'appel système.
 */
function systemCause(error: unknown): string {
  const errno = error as NodeJS.ErrnoException;
  const code = errno?.code ?? "";
  if (code === "") return String(error);
  const target = errno?.path ?? "";
  return target === "" ? code : `${code} ${target}`;
}

/** Espace libre du volume portant la racine, en octets. */
export function freeSpace(root: string): number {
  const stats = statfsSync(root);
  return stats.bavail * stats.bsize;
}

/** Assez de place pour `needed` octets en respectant la marge ? */
export function hasCapacity(needed: number, free: number): boolean {
  // STRICTEMENT supérieur : demander exactement l'espace libre moins la marge
  // ne laisse rien, et un fichier annoncé est rarement exact à l'octet.
  return free > needed + CAPACITY_MARGIN_BYTES;
}

/**
 * Joint un chemin RELATIF sous la racine en refusant toute traversée.
 *
 * Trois barrières, dans cet ordre : aucun `%` (une séquence encodée serait
 * décodée plus tard par quelqu'un d'autre), un premier composant `media` ou
 * `meta`, et aucun composant qui ne soit un nom simple. Le résultat est
 * revérifié comme étant SOUS la racine — c'est l'invariant qui compte, les
 * trois autres n'en sont que les gardiens.
 */
export function safeJoin(root: string, rel: string): string {
  if (rel === "" || rel.includes("%")) throw new Error("invalid-path");

  const segments = rel.split(/[/\\]/);
  if (!PREFIXES.has(segments[0] ?? "")) throw new Error("invalid-path");
  for (const segment of segments) {
    // Vide = séparateur doublé ou chemin absolu ; `:` = lettre de lecteur ou
    // flux de données alternatif NTFS.
    if (segment === "" || segment === "." || segment === ".." || segment.includes(":")) {
      throw new Error("invalid-path");
    }
  }

  const joined = path.resolve(root, ...segments);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!joined.startsWith(rootWithSep)) throw new Error("invalid-path");
  return joined;
}

/**
 * Supprime le fichier final ET son éventuel `.part`. Un fichier déjà absent
 * n'est pas une erreur — c'est même le cas courant après un échec de transfert.
 */
export function removeMediaFile(root: string, rel: string): void {
  const target = safeJoin(root, rel);
  for (const file of [target, `${target}.part`]) {
    try {
      unlinkSync(file);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw new Error(`remove ${rel}: ${String(error)}`);
    }
  }
}

/** Supprime récursivement le dossier de méta d'un item. */
export function removeItemMetaDir(root: string, itemId: string): void {
  removeItemDir(root, "meta", itemId);
}

/**
 * Supprime récursivement le dossier média d'un item.
 *
 * Le fichier vidéo est déjà parti, mais les side-cars de sous-titres
 * (`media/<id>/subs/`) restaient orphelins sur le disque.
 */
export function removeItemMediaDir(root: string, itemId: string): void {
  removeItemDir(root, "media", itemId);
}

function removeItemDir(root: string, kind: string, itemId: string): void {
  const dir = safeJoin(root, `${kind}/${itemId}`);
  rmSync(dir, { recursive: true, force: true });
}

/** Le fichier existe-t-il, et quelle taille fait-il ? Confinement compris. */
export function mediaFileExists(root: string, rel: string): boolean {
  try {
    return existsSync(safeJoin(root, rel));
  } catch {
    return false;
  }
}

/** Renomme le `.part` en fichier final. Utilisé en fin de transfert. */
export function promotePartFile(finalPath: string): void {
  renameSync(`${finalPath}.part`, finalPath);
}
