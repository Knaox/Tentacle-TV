import { forgetValidatedToken } from "../middleware/auth";
import { getPrisma } from "./db";
import { retryOnWriteConflict } from "./dbRetry";
import { pairedDeviceIdForHash } from "./deviceSessions/deviceAuth";
import { endPairedDeviceSessions } from "./deviceSessions/gateway";
import { forgetJellyfinTokenOwner } from "./deviceTokenHealth";
import { cleanupJellyfinDevice } from "./jellyfinDeviceCleanup";
import { markDeviceRevoked } from "./pairedDeviceStatus";
import { endProfileSessionSockets, revokeDeviceByTokenHash } from "./wsManager";
import type { FamilyProfileEndReason } from "../family/familyProtocol";

/**
 * Le déjumelage, côté serveur — la seule porte, quel que soit le geste : la
 * TV elle-même (`POST /api/pair/self/revoke`), la liste des appareils du
 * compte, l'admin, la suppression du compte, l'époque de jumelage, le
 * provisioning.
 *
 * Dans l'ordre, chaque étape rendant la suivante sûre :
 * 1. une transaction inscrit l'appareil Jellyfin de la TV au journal
 *    (`paired_device_cleanups`) et supprime son jumelage. Validée, le jeton
 *    est refusé à toutes les portes (`pairedDeviceStatus`), et ce que Jellyfin
 *    garde d'elle est voué à disparaître — même si le serveur tombe à
 *    l'instant : le balayage du démarrage reprend le journal ;
 * 2. la mémoire : plus de verdict « jumelé » en cache, ni de validation de son
 *    jeton Jellyfin (y compris le repli quand Jellyfin ne répond pas) ;
 * 3. la TV est prévenue en direct (`session:revoked`) et ses sockets fermées ;
 * 4. sa session Jellyfin : la lecture en cours s'arrête tant que le jeton vaut
 *    encore (la position est gardée), puis la connexion se ferme ;
 * 5. Jellyfin oublie l'appareil — jeton et sessions (`DELETE /Devices`) — et
 *    le journal est soldé ; sinon il est retenté jusqu'à confirmation.
 *
 * Les étapes 4 et 5 se poursuivent après le retour (`settled`) : la
 * révocation est EFFECTIVE dès l'étape 1, le reste nettoie.
 *
 * Un jumelage d'avant (copie d'un autre jeton, `jellyfinDeviceId` nul) n'a
 * rien chez Jellyfin qui soit à lui : seule sa session est fermée.
 *
 * La Famille (docs/FAMILLE.md) : une SESSION DE PROFIL est une ligne enfant
 * (`parentId`). Révoquer un jumelage de TV révoque d'abord ses sessions de
 * profil ; une session de profil révoquée prévient sa TV par
 * `family:profile-ended` (la TV revient à « Qui regarde ? ») et non par
 * `session:revoked` (qui la déjumellerait).
 */

export type RevocationReason = "self" | "user" | "admin" | "account" | "epoch" | "provisioning" | "family";

export interface RevocationOptions {
  /** Une session de profil : pourquoi elle cesse, dit à la TV. Défaut :
   *  `closed` (la TV elle-même), `unpaired` pour celles qu'emporte leur jumelage. */
  profileEnd?: FamilyProfileEndReason;
}

/** Les sessions d'une TV s'arrêtent vite ou pas du tout : on n'attend pas plus. */
const SESSION_END_TIMEOUT_MS = 3_000;

export interface Revocation {
  /** Les étapes de nettoyage (session Jellyfin, appareil Jellyfin) terminées. */
  settled: Promise<void>;
}

type Target = { id: string } | { tokenHash: string };

export async function revokePairedDevice(
  target: Target,
  reason: RevocationReason,
  options: RevocationOptions = {},
): Promise<Revocation | null> {
  const prisma = getPrisma();
  const device = await prisma.pairedDevice.findUnique({
    where: target,
    select: { id: true, tokenHash: true, jellyfinAccessToken: true, jellyfinDeviceId: true, parentId: true, jellyfinUserId: true },
  });
  if (!device) {
    // Déjà révoqué : rien à défaire, mais la porte reste close.
    if ("tokenHash" in target) markDeviceRevoked(target.tokenHash);
    return null;
  }

  // Un jumelage de TV emporte d'abord ses sessions de profil.
  const pending: Promise<void>[] = [];
  if (!device.parentId) {
    const profileEnd = options.profileEnd ?? (reason === "account" ? "account_deleted" : "unpaired");
    const children = await prisma.pairedDevice.findMany({ where: { parentId: device.id }, select: { id: true } });
    for (const child of children) {
      const ended = await revokePairedDevice({ id: child.id }, reason, { profileEnd });
      if (ended) pending.push(ended.settled);
    }
  }

  // MariaDB 11 (isolation par instantané) refuse la transaction si la ligne a
  // bougé depuis sa lecture — `lastSeen`, ou le jeton Jellyfin que le serveur
  // pose juste après un jumelage (erreur 1020) : la TV restait alors jumelée.
  // On RELIT dans la transaction, et on rejoue le tout (`dbRetry.ts`).
  const jellyfinDeviceId = await retryOnWriteConflict(() =>
    prisma.$transaction(async (tx) => {
      const fresh = await tx.pairedDevice.findUnique({ where: { id: device.id }, select: { jellyfinDeviceId: true } });
      const deviceId = fresh ? fresh.jellyfinDeviceId : device.jellyfinDeviceId;
      if (deviceId) {
        await tx.pairedDeviceCleanup.upsert({
          where: { jellyfinDeviceId: deviceId },
          create: { jellyfinDeviceId: deviceId, tokenHash: device.tokenHash, reason: "revoked" },
          update: { reason: "revoked", nextAttemptAt: new Date() },
        });
      }
      await tx.pairedDevice.deleteMany({ where: { id: device.id } });
      return deviceId;
    }),
  );

  markDeviceRevoked(device.tokenHash);
  if (device.jellyfinAccessToken) {
    forgetValidatedToken(device.jellyfinAccessToken);
    forgetJellyfinTokenOwner(device.jellyfinAccessToken);
  }
  if (device.parentId) {
    const profileEnd = options.profileEnd ?? "closed";
    // Quitter un profil de soi-même ôte « Rester sur ce profil ».
    if (profileEnd === "closed") await forgetSticky(device.parentId, device.jellyfinUserId);
    endProfileSessionSockets(device.tokenHash, profileEnd);
    console.log(`[family] Session de profil ${device.id} terminée (${profileEnd})`);
  } else {
    revokeDeviceByTokenHash(device.tokenHash);
    console.log(`[Jumelage] Appareil ${device.id} révoqué (${reason})`);
  }

  pending.push(settle(device.tokenHash, jellyfinDeviceId));
  return { settled: Promise.all(pending).then(() => undefined) };
}

/** Le profil « Rester » de la TV, s'il était celui qu'on quitte. */
async function forgetSticky(pairingId: string, profileUserId: string): Promise<void> {
  try {
    await getPrisma().pairedDevice.updateMany({
      where: { id: pairingId, stickyProfileId: profileUserId },
      data: { stickyProfileId: null },
    });
  } catch {
    // Sans gravité : le profil reste « Rester » jusqu'au prochain choix.
  }
}


async function settle(tokenHash: string, jellyfinDeviceId: string | null): Promise<void> {
  const sessionDeviceId = jellyfinDeviceId ?? (await pairedDeviceIdForHash(tokenHash).catch(() => null));
  if (sessionDeviceId) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, SESSION_END_TIMEOUT_MS); });
    await Promise.race([endPairedDeviceSessions(sessionDeviceId).catch(() => {}), timeout]);
    clearTimeout(timer);
  }
  if (jellyfinDeviceId) await cleanupJellyfinDevice(jellyfinDeviceId).catch(() => false);
}

/** Révoque plusieurs jumelages (compte supprimé, époque, provisioning). Le
 *  nombre de jumelages réellement révoqués. */
export async function revokePairedDevices(targets: Target[], reason: RevocationReason): Promise<number> {
  let count = 0;
  for (const target of targets) {
    if (await revokePairedDevice(target, reason)) count += 1;
  }
  return count;
}
