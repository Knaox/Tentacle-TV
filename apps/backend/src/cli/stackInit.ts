import { randomBytes } from "crypto";
import { chownSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Le service `init` des piles Docker (`stacks/`) : ce qu'il faut AVANT le
 * premier démarrage de la base, et que l'assistant ne peut pas faire — lui ne
 * fait que configurer, par les API.
 *
 * - les secrets de la base, générés UNE fois dans le volume `tentacle-secrets`
 *   (aucun mot de passe dans le compose : il se copie-colle tel quel) ;
 * - les dossiers des médias (`films`, `series`), s'ils manquent — seulement
 *   pour un compose d'AVANT qui monte encore `/media` ici. Les piles actuelles
 *   ne donnent plus les médias à Tentacle : c'est `jellyfin-init` (l'image de
 *   Jellyfin) qui crée ces dossiers. Sans `/media` monté, rien n'est fait.
 *
 * Rien pour les volumes de Jellyfin : son image les crée en 777 et Docker
 * reporte ces droits sur un volume neuf — Jellyfin y écrit sous n'importe quel
 * PUID (mesuré le 2026-10-05). Lancé en root par l'entrypoint (`init`),
 * relancé à chaque `docker compose up` : il ne refait jamais ce qui est fait,
 * et ne touche jamais à un fichier qu'il n'a pas créé, médias compris.
 */
export interface StackInitEnv {
  TENTACLE_SECRETS_DIR?: string;
  TENTACLE_MEDIA_DIR?: string;
  TENTACLE_MEDIA_SUBDIRS?: string;
  PUID?: string;
  PGID?: string;
}

export interface StackInitFs {
  exists(path: string): boolean;
  mkdir(path: string): void;
  writeSecret(path: string, value: string): void;
  chown(path: string, uid: number, gid: number): void;
}

/** Les secrets que la base lit par `MARIADB_*_FILE` et le serveur par `DB_PASSWORD_FILE`. */
export const DB_SECRETS = ["db_password", "db_root_password"] as const;

/** 32 octets aléatoires, en base64url : sûr dans une URL `mysql://` comme dans MariaDB. */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

function idOf(raw: string | undefined, fallback: number): number {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 0 ? id : fallback;
}

export function runStackInit(env: StackInitEnv, fs: StackInitFs, log: (line: string) => void = console.log): void {
  const secretsDir = env.TENTACLE_SECRETS_DIR || "/run/tentacle-secrets";
  if (fs.exists(secretsDir)) {
    for (const name of DB_SECRETS) {
      const path = join(secretsDir, name);
      if (fs.exists(path)) continue;
      fs.writeSecret(path, newSecret());
      log(`[init] secret ${name} généré`);
    }
  }

  const mediaDir = env.TENTACLE_MEDIA_DIR || "/media";
  if (fs.exists(mediaDir)) {
    const uid = idOf(env.PUID, 1000);
    const gid = idOf(env.PGID, 1000);
    const subdirs = (env.TENTACLE_MEDIA_SUBDIRS ?? "films,series").split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of subdirs) {
      const path = join(mediaDir, name);
      if (fs.exists(path)) continue;
      fs.mkdir(path);
      fs.chown(path, uid, gid);
      log(`[init] dossier ${path} créé`);
    }
  }
}

/** Le vrai système de fichiers : secrets en lecture seule pour tous (base et serveur n'ont pas le même uid). */
export const nodeFs: StackInitFs = {
  exists: (path) => existsSync(path),
  mkdir: (path) => mkdirSync(path, { recursive: true, mode: 0o755 }),
  writeSecret: (path, value) => writeFileSync(path, value, { mode: 0o444, flag: "wx" }),
  chown: (path, uid, gid) => chownSync(path, uid, gid),
};

if (require.main === module) {
  try {
    runStackInit(process.env, nodeFs);
    console.log("[init] prêt");
  } catch (err) {
    console.error(`[init] échec : ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
