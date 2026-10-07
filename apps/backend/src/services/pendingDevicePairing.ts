import { getPrisma } from "./db";
import { hashToken } from "./jwt";
import { provisionOwnJellyfinToken } from "./deviceJellyfinToken";
import { freshPairingCode } from "../routes/pairing/codes";

/**
 * Un jeton d'appareil remis à un INTERMÉDIAIRE (le téléphone qui le relaie à
 * la TV par le relais public, la TV qui se jumelle par mot de passe) n'est pas
 * encore un appareil jumelé : la TV peut ne jamais le recevoir — mauvais code
 * de relais, TV éteinte, relais muet. L'appareil n'entre donc dans
 * `paired_devices` (et la liste « Appareils ») qu'à la PREMIÈRE requête de la
 * TV porteuse de ce jeton, par le verdict commun (`pairedDeviceStatus.ts`).
 *
 * En attendant, une ligne `pairing_codes` au statut `token_pending` garde
 * l'EMPREINTE du jeton (jamais le jeton), le compte et le nom. Son code de
 * quatre caractères n'est jamais montré : il n'occupe qu'une place dans
 * l'alphabet le temps de l'attente. Passé `PENDING_TTL_MS`, le jeton ne vaudra
 * jamais rien : la purge des codes expirés l'emporte, et sa première requête
 * le dit révoqué.
 */

export const PENDING_STATUS = "token_pending";
export const PENDING_TTL_MS = 15 * 60 * 1000;

export interface PendingDeviceOwner {
  jellyfinUserId: string;
  username: string;
  name: string;
}

/** Met le jeton en attente. `false` : plus aucun code libre (le cas de dix
 *  collisions d'affilée) — l'appelant crée alors l'appareil comme avant. */
export async function recordPendingDevice(token: string, owner: PendingDeviceOwner): Promise<boolean> {
  const code = await freshPairingCode();
  if (!code) return false;
  await getPrisma().pairingCode.create({
    data: {
      code,
      status: PENDING_STATUS,
      deviceName: owner.name,
      jellyfinUserId: owner.jellyfinUserId,
      username: owner.username,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  return true;
}

/**
 * La première requête d'un jeton sans ligne : s'il était en attente et l'est
 * encore, l'appareil naît MAINTENANT (et son jeton Jellyfin propre). `true` :
 * jumelé. Une base injoignable lève — le verdict répond alors « injoignable »,
 * jamais « révoqué ».
 */
export async function activatePendingDevice(token: string, tokenHash: string): Promise<boolean> {
  const prisma = getPrisma();
  // Une base de test sans la table des codes : rien n'est jamais en attente.
  if (!prisma.pairingCode) return false;
  const pending = await prisma.pairingCode.findFirst({ where: { status: PENDING_STATUS, token: tokenHash } });
  if (!pending) {
    // Une requête jumelle vient peut-être de l'activer (ligne créée, attente
    // effacée) entre notre lecture de `paired_devices` et celle-ci.
    return (await prisma.pairedDevice.findUnique({ where: { tokenHash }, select: { id: true } })) !== null;
  }
  if (pending.expiresAt < new Date() || !pending.jellyfinUserId || !pending.username) {
    await prisma.pairingCode.delete({ where: { id: pending.id } }).catch(() => {});
    return false;
  }
  const name = pending.deviceName || "TV";
  try {
    await prisma.pairedDevice.create({
      data: { name, jellyfinUserId: pending.jellyfinUserId, username: pending.username, tokenHash },
    });
  } catch (error) {
    // Deux premières requêtes simultanées : l'autre a créé la ligne.
    const exists = await prisma.pairedDevice.findUnique({ where: { tokenHash }, select: { id: true } });
    if (!exists) throw error;
    return true;
  }
  await prisma.pairingCode.delete({ where: { id: pending.id } }).catch(() => {});
  provisionOwnJellyfinToken(token, { jellyfinUserId: pending.jellyfinUserId, name });
  return true;
}
