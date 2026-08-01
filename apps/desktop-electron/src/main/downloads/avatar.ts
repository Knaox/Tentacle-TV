/**
 * Cache local de la photo de profil, PAR utilisateur.
 *
 * Hors ligne — ou simplement le temps d'une coupure — l'`<img>` de l'avatar
 * pointe vers Jellyfin et échoue : l'utilisateur retombe sur l'initiale de son
 * nom, dans une application qui reste pourtant parfaitement utilisable sur son
 * contenu téléchargé. Une photo de profil est un repère d'identité ; la perdre
 * au premier tunnel donne l'impression d'être déconnecté alors qu'on ne l'est
 * pas.
 *
 * Emplacement : `<dossier de données>/avatars/<userId>.jpg`, comme la base
 * locale et pour la même raison — surtout PAS sous la racine de
 * téléchargements, qui peut pointer vers un disque externe débranché. L'avatar
 * doit s'afficher même quand ce disque n'est pas là.
 *
 * ⚠️ Aucun secret : une photo de profil, rien d'autre.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/avatar.rs`.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Plafond de taille. L'envoi redimensionne déjà à 512 px et la lecture demande
 * `maxWidth=160` : au-delà, c'est que la source n'est pas celle qu'on croit, et
 * une data URL de plusieurs mégaoctets traverserait l'IPC à chaque démarrage.
 */
const MAX_BYTES = 512 * 1024;

/** Base64 canonique, sans espace ni caractère hors alphabet. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Nom de fichier sûr pour un identifiant Jellyfin.
 *
 * Les identifiants sont des UUID sans tiret, mais rien ne l'impose côté
 * serveur : on n'écrit donc QUE des caractères alphanumériques, ce qui interdit
 * par construction `..`, `/`, `\` et les noms réservés de Windows. Un
 * identifiant qui ne laisse rien après ce filtre est refusé plutôt que remplacé
 * par un nom vide, qui collisionnerait entre utilisateurs.
 */
export function safeStem(userId: string): string {
  const stem = [...userId].filter((c) => /[A-Za-z0-9]/.test(c)).join("");
  if (stem === "") throw new Error("identifiant utilisateur invalide");
  return stem;
}

/** `<avatarsDir>/<stem>.jpg`, dossier créé au besoin. */
export function avatarPath(avatarsDir: string, userId: string): string {
  mkdirSync(avatarsDir, { recursive: true });
  return path.join(avatarsDir, `${safeStem(userId)}.jpg`);
}

/** Enregistre la photo (JPEG, encodé en base64 par l'appelant). */
export function put(avatarsDir: string, userId: string, base64Jpeg: string): void {
  // `Buffer.from` ne se plaint JAMAIS d'un base64 invalide : il décode ce qu'il
  // peut et jette le reste. Sans ce contrôle, une entrée abîmée deviendrait un
  // JPEG tronqué, donc une photo de profil cassée pour toutes les sessions
  // suivantes.
  if (base64Jpeg.length % 4 !== 0 || !BASE64.test(base64Jpeg)) {
    throw new Error("avatar : base64 invalide");
  }
  const bytes = Buffer.from(base64Jpeg, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new Error(`taille d'avatar hors bornes : ${bytes.length} octets`);
  }

  const target = avatarPath(avatarsDir, userId);
  // Écriture par fichier temporaire puis renommage : une coupure en cours
  // d'écriture laisserait sinon un JPEG tronqué.
  const tmp = `${target}.part`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, target);
}

/** Relit la photo en base64, ou `null` si aucune n'a jamais été mise en cache. */
export function get(avatarsDir: string, userId: string): string | null {
  try {
    const bytes = readFileSync(avatarPath(avatarsDir, userId));
    return bytes.length > 0 ? bytes.toString("base64") : null;
  } catch {
    // Absence de fichier = cas nominal au premier lancement, pas une erreur.
    return null;
  }
}
