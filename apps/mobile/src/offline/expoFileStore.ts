/**
 * L'adaptateur fichiers du mobile : expo-file-system (`File`, `Directory`,
 * `Paths`) derrière le `FileStore` du cœur hors ligne.
 *
 * Les chemins sont des URI `file://` de bout en bout — c'est ce que le lecteur
 * vidéo et `expo-image` consomment tels quels. Le cœur ne les compare que par
 * `sep` (`/`), et ne les assemble que par `join` : un assemblage de chaînes
 * maison, sans l'encodage d'URL de `Paths.join`, pour que le chemin construit
 * soit exactement celui que `safeJoin` revérifie.
 */

import { Directory, File, Paths } from "expo-file-system";
import type { FileStore, FsErrorKind } from "@tentacle-tv/offline-core";

/** Retire les barres finales — la racine du cœur n'en a jamais. */
export function stripTrailingSlashes(uri: string): string {
  return uri.replace(/\/+$/, "");
}

function joinUri(...parts: string[]): string {
  const [head, ...rest] = parts.filter((part) => part !== "");
  if (head === undefined) return "";
  return [stripTrailingSlashes(head), ...rest.map((part) => part.replace(/^\/+|\/+$/g, ""))].join("/");
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Classement par le message natif : ni iOS ni Android ne rendent de code
 * errno à travers Expo. Les libellés « disque plein » sont ceux de
 * `NSFileWriteOutOfSpaceError` et d'`ENOSPC` (« No space left on device »).
 */
function classify(error: unknown): FsErrorKind {
  const text = message(error);
  if (/no space left|not enough space|out of space|ENOSPC|insufficient storage/i.test(text)) return "disk-full";
  if (/no such file|does not exist|not found|ENOENT|couldn.t be opened/i.test(text)) return "not-found";
  return "other";
}

function writeFile(target: string, content: string | Uint8Array): void {
  const file = new File(target);
  // `write` sur un fichier absent : créer d'abord, avec les dossiers manquants.
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  file.write(content);
}

export const expoFileStore: FileStore = {
  sep: "/",
  join: joinUri,
  dirname: (target) => {
    const trimmed = stripTrailingSlashes(target);
    const cut = trimmed.lastIndexOf("/");
    return cut <= 0 ? trimmed : trimmed.slice(0, cut);
  },
  exists: (target) => {
    try {
      return Paths.info(target).exists;
    } catch {
      return false;
    }
  },
  size: (target) => {
    try {
      const file = new File(target);
      return file.exists ? file.size : null;
    } catch {
      return null;
    }
  },
  mkdirp: (dir) => {
    new Directory(dir).create({ intermediates: true, idempotent: true });
  },
  writeBytes: (target, bytes) => writeFile(target, bytes),
  writeText: (target, text) => writeFile(target, text),
  readBytes: (target) => new File(target).bytesSync(),
  readText: (target) => new File(target).textSync(),
  remove: (target) => {
    const file = new File(target);
    // Déjà absent : c'est le cas courant après un échec de transfert.
    if (file.exists) file.delete();
  },
  removeTree: (dir) => {
    const directory = new Directory(dir);
    if (directory.exists) directory.delete();
  },
  rename: (from, to) => {
    const destination = new File(to);
    if (destination.exists) destination.delete();
    new File(from).move(destination);
  },
  listFiles: (dir) => {
    try {
      return new Directory(dir)
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((file) => file.name);
    } catch {
      // Pas de dossier : rien à lister.
      return [];
    }
  },
  freeSpace: () => Paths.availableDiskSpace,
  classify,
  describe: message,
};
