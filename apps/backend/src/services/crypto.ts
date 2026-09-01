import crypto from "crypto";
import { getOrCreateJwtSecret } from "./jwt";

/**
 * Chiffrement des tokens de comptes externes (AniList) au repos.
 *
 * AES-256-GCM, clé dérivée (scrypt) de `TENTACLE_ENCRYPTION_KEY` si posée,
 * sinon du `jwt_secret`. LIMITE ASSUMÉE et documentée : sans variable d'env,
 * le secret de dérivation vit dans la même base que le chiffré — cela protège
 * une table exfiltrée seule (injection SQL, dump partiel, log), pas un dump
 * complet. C'est déjà mieux que l'existant (tokens Jellyfin en clair), sans
 * exiger une clé externe de chaque déploiement.
 *
 * Format : `v1:<iv hex>:<tag hex>:<chiffré hex>`.
 */

const SCRYPT_SALT = "tentacle-external-accounts-v1";

let cachedKey: Buffer | null = null;

async function getKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const secret = process.env.TENTACLE_ENCRYPTION_KEY || (await getOrCreateJwtSecret());
  cachedKey = crypto.scryptSync(secret, SCRYPT_SALT, 32);
  return cachedKey;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Null si le format est inconnu ou l'authentification GCM échoue. */
export async function decryptSecret(stored: string): Promise<string | null> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const key = await getKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "hex"));
    decipher.setAuthTag(Buffer.from(parts[2], "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], "hex")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
