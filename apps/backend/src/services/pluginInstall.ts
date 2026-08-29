/**
 * Installation d'un greffon : télécharger, vérifier, extraire, supprimer.
 *
 * Séparé de `pluginManager.ts`, qui garde le registre, les sources et la liste
 * des greffons installés. La coupure suit la ligne du risque : ICI, et
 * nulle part ailleurs, du code venu d'ailleurs est écrit sur le disque du
 * serveur et rendu exécutable. Ce qui s'y passe mérite d'être lu d'un seul
 * tenant, sans traverser trois cents lignes de gestion de catalogue.
 *
 * (Et `pluginManager.ts` repassait au-dessus des 300 lignes du projet.)
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, rmSync, createWriteStream } from "fs";
import { dirname, join, relative, resolve, sep } from "path";
import { pipeline } from "stream/promises";
import { assertPathUnderDataDir, DATA_DIR, isValidPluginId } from "./pluginManager";
import {
  unsafeMember,
  membersFromListing,
  rejectedDownloadUrl,
} from "./pluginArchiveGuard";

/**
 * Télécharge l'archive d'un greffon, empreinte OBLIGATOIRE.
 *
 * La vérification était conditionnée à la présence d'un `checksum` dans
 * l'entrée de registre : une entrée sans empreinte installait donc du code
 * SANS AUCUN contrôle, alors que la documentation du dépôt annonce la
 * vérification comme acquise. Un greffon s'exécute côté serveur
 * (`pluginHasServerModule`) et côté page : c'est du code, pas de la donnée.
 *
 * Rétrocompatible, et vérifié avant d'être écrit plutôt qu'espéré : les 29
 * versions publiées de Seer portent une empreinte, la CI la calcule
 * (`publish.yml`), `update-registry.mjs` refuse déjà de s'exécuter sans elle,
 * et les empreintes des quatre dernières versions ont été recalculées depuis
 * les archives réelles — elles concordent. Seule une source PERSONNALISÉE qui
 * n'en publierait pas est refusée, ce qui est exactement le but.
 */
export async function downloadPlugin(
  pluginId: string,
  downloadUrl: string,
  expectedChecksum: string | undefined,
): Promise<string> {
  if (!isValidPluginId(pluginId)) throw new Error("Invalid plugin ID");
  if (!expectedChecksum) {
    // Message explicite : il remonte tel quel dans l'interface d'administration,
    // et « échec de l'installation » n'aiderait personne à comprendre que c'est
    // la SOURCE qui est en cause, pas le serveur.
    throw new Error(
      "No SHA-256 checksum published for this plugin version: integrity cannot be verified, " +
        "installation refused. The registry entry must carry a `checksum` field.",
    );
  }
  const rejectedScheme = rejectedDownloadUrl(downloadUrl);
  if (rejectedScheme) throw new Error(rejectedScheme);

  const tmpDir = resolve(DATA_DIR, ".tmp");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const tmpFile = join(tmpDir, `${pluginId}-${Date.now()}.tgz`);
  const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  if (!res.body) throw new Error("Download failed: empty response body");

  const fileStream = createWriteStream(tmpFile);
  // @ts-expect-error Node.js ReadableStream compatibility
  await pipeline(res.body, fileStream);

  const valid = await verifyChecksum(tmpFile, expectedChecksum);
  if (!valid) {
    rmSync(tmpFile, { force: true });
    throw new Error("Checksum verification failed: file may be corrupted or tampered");
  }

  return tmpFile;
}

async function verifyChecksum(filePath: string, expected: string): Promise<boolean> {
  const { readFile } = await import("fs/promises");
  const data = await readFile(filePath);
  const hash = createHash("sha256").update(data).digest("hex");
  return hash === expected.replace(/^sha256:/i, "").toLowerCase();
}

export async function extractPlugin(archivePath: string, pluginId: string): Promise<string> {
  if (!isValidPluginId(pluginId)) throw new Error("Invalid plugin ID");
  const destDir = resolve(DATA_DIR, pluginId);
  assertPathUnderDataDir(destDir);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const { execSync } = await import("child_process");
  // Chemins RELATIFS + cwd : aucun « C: » dans les arguments, donc compatible
  // avec les DEUX saveurs de tar sans aucune option — GNU tar (Linux/Docker),
  // qui prendrait « C: » pour un hôte distant, ET bsdtar (Windows/System32),
  // qui ne connaît pas « --force-local » (l'ancienne option GNU passée sous
  // Windows faisait échouer TOUTE installation de plugin sur ce système).
  const cwd = dirname(archivePath);
  const rel = (p: string): string => relative(cwd, p).split(sep).join("/");

  // ON LISTE AVANT D'EXTRAIRE. Un membre nommé `../../serveur.js` écrirait hors
  // du dossier de destination, et le constater après coup ne servirait à rien —
  // le fichier serait déjà posé. `-tzf` n'écrit rien. Le contrôle vit dans
  // `pluginArchiveGuard.ts` : il se teste, et il se comporte pareil avec GNU tar
  // et bsdtar, là où des drapeaux de sécurité propres à l'une casseraient
  // l'autre (voir juste au-dessus).
  const listing = execSync(`tar -tzf "${rel(archivePath)}"`, {
    cwd, stdio: "pipe", timeout: 30_000, encoding: "utf8",
  });
  const unsafe = unsafeMember(membersFromListing(listing));
  if (unsafe) {
    rmSync(archivePath, { force: true });
    throw new Error(`Refused plugin archive: ${unsafe}`);
  }

  execSync(`tar -xzf "${rel(archivePath)}" -C "${rel(destDir)}"`, {
    cwd, stdio: "pipe", timeout: 30_000,
  });
  rmSync(archivePath, { force: true });
  return destDir;
}

export function removePluginFiles(pluginId: string): void {
  if (!isValidPluginId(pluginId)) throw new Error("Invalid plugin ID");
  const dir = resolve(DATA_DIR, pluginId);
  assertPathUnderDataDir(dir);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
