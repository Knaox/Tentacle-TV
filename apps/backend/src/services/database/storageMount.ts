import { readFileSync } from "fs";

/**
 * Le dossier de la base est-il sur un partage RÉSEAU ? SQLite en WAL y corrompt
 * la base (NFS, SMB/CIFS, FUSE réseau : mémoire partagée et verrous non
 * fiables). On avertit, sans bloquer (docs/sqlite/DECISION.md § 7).
 *
 * Linux : le point de montage le plus long qui contient le chemin, lu dans
 * `/proc/self/mountinfo`, jugé sur son TYPE de système de fichiers, jamais sur
 * son périphérique : un disque bloc distant (Ceph RBD `/dev/rbd*`, iSCSI)
 * formaté en ext4/xfs/btrfs/zfs est local pour SQLite ; CephFS (`ceph`) ne
 * l'est pas. Windows : un chemin UNC (`\\serveur\partage`).
 * Ailleurs, ou illisible : « inconnu », jamais une fausse alerte.
 */
export type DatabaseStorage = "local" | "network" | "unknown";

const NETWORK_TYPES = new Set([
  "nfs",
  "nfs4",
  "cifs",
  "smb3",
  "smbfs",
  "9p",
  "fuse.sshfs",
  "fuse.rclone",
  "ceph",
  "fuse.ceph-fuse",
  "glusterfs",
  "fuse.glusterfs",
  "davfs",
  "fuse.davfs2",
]);

interface Mount {
  point: string;
  type: string;
}

/** `/proc/self/mountinfo` : champ 5 = point de montage, le type suit le séparateur « - ». */
export function parseMountInfo(text: string): Mount[] {
  const mounts: Mount[] = [];
  for (const line of text.split("\n")) {
    const fields = line.split(" ");
    const dash = fields.indexOf("-");
    if (dash < 0 || fields.length < 5 || dash + 1 >= fields.length) continue;
    // Les espaces d'un chemin y sont écrits « \040 ».
    mounts.push({ point: fields[4].replace(/\\040/g, " "), type: fields[dash + 1] });
  }
  return mounts;
}

/** Le type du système de fichiers qui porte `path`, d'après une liste de montages. */
export function filesystemTypeFor(path: string, mounts: Mount[]): string | null {
  let best: Mount | null = null;
  for (const mount of mounts) {
    const inside = mount.point === "/" || path === mount.point || path.startsWith(`${mount.point}/`);
    if (inside && (!best || mount.point.length >= best.point.length)) best = mount;
  }
  return best?.type ?? null;
}

export function classifyStorage(path: string, platform: NodeJS.Platform, mountInfo: string | null): DatabaseStorage {
  if (platform === "win32") return /^(\\\\|\/\/)/.test(path) ? "network" : "local";
  if (platform !== "linux" || mountInfo === null) return "unknown";
  const type = filesystemTypeFor(path, parseMountInfo(mountInfo));
  if (type === null) return "unknown";
  return NETWORK_TYPES.has(type) ? "network" : "local";
}

/** Le support de la base sur CETTE machine. */
export function databaseStorage(path: string): DatabaseStorage {
  let mountInfo: string | null = null;
  if (process.platform === "linux") {
    try {
      mountInfo = readFileSync("/proc/self/mountinfo", "utf-8");
    } catch {
      mountInfo = null;
    }
  }
  return classifyStorage(path, process.platform, mountInfo);
}
