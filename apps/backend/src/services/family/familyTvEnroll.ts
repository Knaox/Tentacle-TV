import { forgetValidatedToken } from "../../middleware/auth";
import { getPrisma } from "../db";
import { endPairedDeviceSessions } from "../deviceSessions/gateway";
import { forgetJellyfinTokenOwner } from "../deviceTokenHealth";
import { cleanupJellyfinDevice } from "../jellyfinDeviceCleanup";
import { hashToken, signTvPairingToken, verifyDeviceToken, verifyTvPairingToken } from "../jwt";
import { markDeviceRevoked } from "../pairedDeviceStatus";
import { closeDeviceSockets } from "../wsManager";
import type { TvEnrollResponse } from "../../family/familyContract";
import { FamilyFailure } from "./familyErrors";

/**
 * L'Apple TV passe aux profils (docs/FAMILLE.md) : son jeton d'appareil
 * s'ÉCHANGE contre un jeton de jumelage « profils seuls » (type `tv_pairing`)
 * qu'aucune autre porte ne connaît — un oubli échoue fermé. Dans la même
 * transaction : la ligne change d'empreinte, passe en mode profils, et
 * l'appareil Jellyfin de l'ancien jeton entre au journal pour disparaître.
 *
 * L'ancien jeton est refusé partout dès lors (401 `revoked`) — sauf pour
 * REJOUER l'échange tant que le nouveau n'a pas servi (`legacyTokenHash`) : une
 * réponse perdue ne coûte pas un rejumelage. Le premier usage du jeton de
 * jumelage efface cette porte (`pairingFromToken`).
 */

export interface PairingRow {
  id: string;
  name: string;
  jellyfinUserId: string;
  username: string;
  tokenHash: string;
  parentId: string | null;
  profilesSince: Date | null;
  legacyTokenHash: string | null;
  stickyProfileId: string | null;
  jellyfinAccessToken: string | null;
  jellyfinDeviceId: string | null;
}

/** Fermeture des sockets d'un jeton échangé : la TV les a déjà quittées. */
const ENROLLED_CLOSE_CODE = 4011;

export function pairingRequired(revoked: boolean): FamilyFailure {
  return new FamilyFailure("family.pairing_required", "Jeton de jumelage de TV requis", revoked ? { revoked: true } : {});
}

export async function enrollTv(token: string): Promise<TvEnrollResponse> {
  const prisma = getPrisma();
  if (await verifyTvPairingToken(token)) {
    const row = await prisma.pairedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.parentId || !row.profilesSince) throw pairingRequired(true);
    return { pairingToken: token };
  }
  const device = await verifyDeviceToken(token);
  if (!device || device.scope === "profile") throw pairingRequired(false);
  const presented = hashToken(token);
  const direct = await prisma.pairedDevice.findUnique({ where: { tokenHash: presented } });
  const row: PairingRow | null =
    direct ?? (await prisma.pairedDevice.findFirst({ where: { legacyTokenHash: presented, parentId: null } }));
  if (!row) throw pairingRequired(true);
  if (row.parentId) throw pairingRequired(false);

  const pairingToken = await signTvPairingToken({ pairingId: row.id, userId: row.jellyfinUserId, username: row.username });
  await prisma.$transaction(async (tx) => {
    if (row.jellyfinDeviceId) {
      await tx.pairedDeviceCleanup.upsert({
        where: { jellyfinDeviceId: row.jellyfinDeviceId },
        create: { jellyfinDeviceId: row.jellyfinDeviceId, tokenHash: row.tokenHash, reason: "revoked" },
        update: { reason: "revoked", nextAttemptAt: new Date() },
      });
    }
    await tx.pairedDevice.update({
      where: { id: row.id },
      data: {
        tokenHash: hashToken(pairingToken),
        legacyTokenHash: row.legacyTokenHash ?? presented,
        profilesSince: row.profilesSince ?? new Date(),
        jellyfinAccessToken: null,
        jellyfinDeviceId: null,
      },
    });
  });

  // Le jeton d'avant (ou le jeton de jumelage d'un échange perdu) ne vaut plus rien.
  markDeviceRevoked(row.tokenHash);
  if (row.jellyfinAccessToken) {
    forgetValidatedToken(row.jellyfinAccessToken);
    forgetJellyfinTokenOwner(row.jellyfinAccessToken);
  }
  closeDeviceSockets(row.tokenHash, ENROLLED_CLOSE_CODE, "Profiles enabled");
  if (row.jellyfinDeviceId) {
    const deviceId = row.jellyfinDeviceId;
    void endPairedDeviceSessions(deviceId)
      .catch(() => undefined)
      .then(() => cleanupJellyfinDevice(deviceId))
      .catch(() => false);
  }
  console.log(`[family] TV ${row.id} passée aux profils`);
  return { pairingToken };
}

/** Le jumelage d'une TV passée aux profils, depuis son jeton — sinon le bon refus. */
export async function pairingFromToken(token: string | null): Promise<PairingRow> {
  if (!token) throw pairingRequired(false);
  const prisma = getPrisma();
  if (!(await verifyTvPairingToken(token))) {
    // Une TV d'avant les profils qui appelle trop tôt : l'échange d'abord.
    const device = await verifyDeviceToken(token);
    if (device && !device.scope && (await prisma.pairedDevice.findUnique({ where: { tokenHash: hashToken(token) } }))) {
      throw new FamilyFailure("family.enroll_required", "La TV doit d'abord passer aux profils");
    }
    throw pairingRequired(false);
  }
  const row = await prisma.pairedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.parentId || !row.profilesSince) throw pairingRequired(true);
  if (row.legacyTokenHash) {
    // Le nouveau jeton sert : l'ancien ne rejouera plus l'échange.
    await prisma.pairedDevice.update({ where: { id: row.id }, data: { legacyTokenHash: null, lastSeen: new Date() } });
    row.legacyTokenHash = null;
  }
  return row;
}
