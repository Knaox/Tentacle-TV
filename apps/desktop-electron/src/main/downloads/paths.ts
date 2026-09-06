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
 * Ce fichier ne touche JAMAIS au système de fichiers lui-même : tout passe par
 * le `FileStore` du `Volume` (voir `adapters.ts`), ce qui le rend commun au
 * bureau et au mobile. Portage de
 * `apps/desktop/src-tauri/src/downloads/fsops.rs`.
 */

import type { DatabaseHandle, FileStore, Volume } from "./adapters";
import { integer } from "./rows";
import { settingGet, settingSet } from "./db";

export const STORAGE_ROOT_KEY = "storage_root";

/** Marge de sécurité : jamais moins de 2 Gio laissés libres sur le disque. */
export const CAPACITY_MARGIN_BYTES = 2 * 1024 * 1024 * 1024;

/** Seuls préfixes admis sous la racine. */
const PREFIXES = new Set(["media", "meta"]);

/**
 * Volume résolu, une seule lecture SQLite par session.
 *
 * Remplace le `RootCache` de Tauri, qui devait être un `RwLock` partagé entre
 * threads. Ici tout vit sur la boucle d'évènements : une variable suffit.
 */
let cache: Volume | null = null;

/** Racine par défaut, sous le dossier de données. */
export function defaultRoot(files: FileStore, userDataDir: string): string {
  return files.join(userDataDir, "downloads");
}

/** Crée `media/` et `meta/` sous la racine. */
export function ensureLayout(volume: Volume): void {
  for (const sub of ["media", "meta"]) volume.files.mkdirp(volume.files.join(volume.root, sub));
}

/** Volume effectif : cache mémoire → paramètre enregistré → défaut. */
export function resolveRoot(db: DatabaseHandle, files: FileStore, userDataDir: string): Volume {
  if (cache !== null) return cache;
  const root = settingGet(db, STORAGE_ROOT_KEY) ?? defaultRoot(files, userDataDir);
  const volume: Volume = { files, root };
  ensureLayout(volume);
  cache = volume;
  return volume;
}

/** Oublie le volume mémorisé. Réservé aux tests et à `setRoot`. */
export function forgetRoot(): void {
  cache = null;
}

/**
 * Change la racine.
 *
 * Codes d'erreur STABLES, consommés tels quels par l'interface :
 * `root-not-empty` (des téléchargements existent), `root-not-writable`.
 */
export function setRoot(db: DatabaseHandle, files: FileStore, newRoot: string): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM files").get();
  if (row !== undefined && integer(row, "n") > 0) throw new Error("root-not-empty");

  const volume: Volume = { files, root: newRoot };
  try {
    files.mkdirp(newRoot);
    ensureLayout(volume);
    // Un dossier créable n'est pas forcément inscriptible — lecteur réseau en
    // lecture seule, quota, ACL. On écrit vraiment pour le savoir.
    const probe = files.join(newRoot, ".tentacle-write-probe");
    files.writeText(probe, "ok");
    files.remove(probe);
  } catch (error) {
    // Le code reste le PRÉFIXE — `api.ts` le lit tel quel. Ce qui suit est la
    // cause système, et elle n'est pas un luxe : dans un paquet livré (MSIX,
    // Mac App Store) le `console.error` du processus principal ne va nulle
    // part, si bien qu'un refus était impossible à expliquer. `EPERM` sur un
    // dossier du profil désigne l'accès contrôlé aux dossiers de Windows,
    // `EACCES` une ACL, `EROFS` un volume monté en lecture seule — trois
    // conduites à tenir différentes, que « pas accessible en écriture »
    // confondait en une seule.
    throw new Error(`root-not-writable: ${files.describe(error)}`);
  }

  settingSet(db, STORAGE_ROOT_KEY, newRoot);
  cache = volume;
  return newRoot;
}

/** Espace libre du volume portant la racine, en octets. */
export function freeSpace(volume: Volume): number {
  return volume.files.freeSpace(volume.root);
}

/**
 * Assez de place pour `needed` octets en respectant la marge ?
 *
 * La marge est un paramètre : 2 Gio sur un ordinateur, moins sur un téléphone.
 */
export function hasCapacity(needed: number, free: number, margin = CAPACITY_MARGIN_BYTES): boolean {
  // STRICTEMENT supérieur : demander exactement l'espace libre moins la marge
  // ne laisse rien, et un fichier annoncé est rarement exact à l'octet.
  return free > needed + margin;
}

/**
 * Joint un chemin RELATIF sous la racine en refusant toute traversée.
 *
 * Trois barrières, dans cet ordre : aucun `%` (une séquence encodée serait
 * décodée plus tard par quelqu'un d'autre), un premier composant `media` ou
 * `meta`, et aucun composant qui ne soit un nom simple. Le résultat est
 * revérifié comme étant SOUS la racine — c'est l'invariant qui compte, les
 * trois autres n'en sont que les gardiens. La revérification se fait avec le
 * séparateur DU MAGASIN, pas celui de Node : le cœur n'a plus `path`.
 */
export function safeJoin(volume: Volume, rel: string): string {
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

  const { files } = volume;
  // La racine passe elle aussi par `join` : sur Node, c'est ce qui normalise
  // ses séparateurs avant la comparaison.
  const base = files.join(volume.root);
  const joined = files.join(base, ...segments);
  const rootWithSep = base.endsWith(files.sep) ? base : base + files.sep;
  if (!joined.startsWith(rootWithSep)) throw new Error("invalid-path");
  return joined;
}

/**
 * Supprime le fichier final ET son éventuel `.part`. Un fichier déjà absent
 * n'est pas une erreur — c'est même le cas courant après un échec de transfert.
 */
export function removeMediaFile(volume: Volume, rel: string): void {
  const target = safeJoin(volume, rel);
  for (const file of [target, `${target}.part`]) {
    try {
      volume.files.remove(file);
    } catch (error) {
      throw new Error(`remove ${rel}: ${volume.files.describe(error)}`);
    }
  }
}

/** Supprime récursivement le dossier de méta d'un item. */
export function removeItemMetaDir(volume: Volume, itemId: string): void {
  removeItemDir(volume, "meta", itemId);
}

/**
 * Supprime récursivement le dossier média d'un item.
 *
 * Le fichier vidéo est déjà parti, mais les side-cars de sous-titres
 * (`media/<id>/subs/`) restaient orphelins sur le disque.
 */
export function removeItemMediaDir(volume: Volume, itemId: string): void {
  removeItemDir(volume, "media", itemId);
}

function removeItemDir(volume: Volume, kind: string, itemId: string): void {
  volume.files.removeTree(safeJoin(volume, `${kind}/${itemId}`));
}

/** Le fichier existe-t-il ? Confinement compris. */
export function mediaFileExists(volume: Volume, rel: string): boolean {
  try {
    return volume.files.exists(safeJoin(volume, rel));
  } catch {
    return false;
  }
}

/** Renomme le `.part` en fichier final. Utilisé en fin de transfert. */
export function promotePartFile(volume: Volume, finalPath: string): void {
  volume.files.rename(`${finalPath}.part`, finalPath);
}
