/**
 * L'adaptateur fichiers pour Node et Electron : `node:fs` et `node:path`.
 *
 * Seul fichier de la couche stockage qui touche au système de fichiers de
 * Node pour le compte du cœur. Les chemins qu'il reçoit sont ceux que le cœur
 * a construits par `safeJoin` : il ne vérifie rien lui-même.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { FileStore, FsErrorKind, Volume } from "../core/adapters";

function errnoCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

/**
 * Cause système d'un échec, en une ligne lisible.
 *
 * Le code errno ET le chemin fautif : `ensureLayout` crée deux sous-dossiers et
 * la sonde d'écriture en écrit un troisième, savoir LEQUEL a cédé oriente le
 * diagnostic. Le message verbeux de Node est écarté — il répète le code et
 * l'appel système.
 */
function describe(error: unknown): string {
  const code = errnoCode(error);
  if (code === "") return String(error);
  const target = (error as { path?: unknown } | null)?.path;
  return typeof target === "string" && target !== "" ? `${code} ${target}` : code;
}

function classify(error: unknown): FsErrorKind {
  const code = errnoCode(error);
  if (code === "ENOSPC") return "disk-full";
  if (code === "ENOENT") return "not-found";
  return "other";
}

export const nodeFiles: FileStore = {
  sep: path.sep,
  join: (...parts) => path.join(...parts),
  dirname: (target) => path.dirname(target),
  exists: (target) => existsSync(target),
  size: (target) => {
    try {
      const stats = statSync(target);
      return stats.isFile() ? stats.size : null;
    } catch {
      return null;
    }
  },
  mkdirp: (dir) => {
    mkdirSync(dir, { recursive: true });
  },
  writeBytes: (target, bytes) => {
    writeFileSync(target, bytes);
  },
  writeText: (target, text) => {
    writeFileSync(target, text, "utf8");
  },
  readBytes: (target) => readFileSync(target),
  readText: (target) => readFileSync(target, "utf8"),
  remove: (target) => {
    try {
      unlinkSync(target);
    } catch (error) {
      // Déjà absent : c'est le cas courant après un échec de transfert.
      if (errnoCode(error) !== "ENOENT") throw error;
    }
  },
  removeTree: (dir) => {
    rmSync(dir, { recursive: true, force: true });
  },
  rename: (from, to) => {
    renameSync(from, to);
  },
  listFiles: (dir) => {
    try {
      return readdirSync(dir).filter((name) => {
        try {
          return statSync(path.join(dir, name)).isFile();
        } catch {
          return false;
        }
      });
    } catch {
      // Pas de dossier : rien à lister.
      return [];
    }
  },
  freeSpace: (target) => {
    const stats = statfsSync(target);
    return stats.bavail * stats.bsize;
  },
  classify,
  describe,
};

/** Un volume Node sur une racine absolue. */
export function nodeVolume(root: string): Volume {
  return { files: nodeFiles, root };
}
