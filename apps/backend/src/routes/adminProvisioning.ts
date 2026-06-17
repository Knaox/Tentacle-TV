import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { getPublicUrl } from "../services/configStore";
import { authenticateJellyfinUser } from "../services/jellyfin";
import { signDeviceToken, hashToken } from "../services/jwt";
import { seedProvisioningCode, deleteProvisioningCode } from "../services/relayProvision";

const PAIR_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12; // code long : résiste au brute-force (permanent + réutilisable)

function generateLongCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => PAIR_CHARS[b % PAIR_CHARS.length])
    .join("");
}

/** Récupère (ou crée) la ligne singleton du code de provisionnement. */
async function getOrCreateRow() {
  const prisma = getPrisma();
  const existing = await prisma.provisioningCode.findFirst();
  if (existing) return existing;
  return prisma.provisioningCode.create({ data: { code: generateLongCode() } });
}

/** État exposé au front (jamais le token/JWT brut). */
function toState(row: {
  code: string;
  enabled: boolean;
  expiresAt: Date | null;
  username: string | null;
}) {
  return {
    code: row.code,
    enabled: row.enabled,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    account: row.username ?? "",
    publicUrl: getPublicUrl() ?? "",
  };
}

const putSchema = z.object({
  enabled: z.boolean(),
  expiresAt: z.string().datetime().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export const adminProvisioningRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/provisioning — État courant du code de provisionnement. */
  app.get("/provisioning", async () => {
    const row = await getOrCreateRow();
    return toState(row);
  });

  /** POST /api/admin/provisioning/regenerate — Nouveau code, désactivé. */
  app.post("/provisioning/regenerate", async () => {
    const prisma = getPrisma();
    const row = await getOrCreateRow();

    // Révoque l'appareil et l'entrée relay liés à l'ancien code
    if (row.token) {
      await prisma.pairedDevice
        .deleteMany({ where: { tokenHash: hashToken(row.token) } })
        .catch(() => {});
    }
    await deleteProvisioningCode(row.code);

    const updated = await prisma.provisioningCode.update({
      where: { id: row.id },
      data: { code: generateLongCode(), enabled: false, token: null, expiresAt: null },
    });
    return toState(updated);
  });

  /** PUT /api/admin/provisioning — Activer/désactiver + date d'expiration + compte dédié. */
  app.put("/provisioning", async (request, reply) => {
    const parsed = putSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Requête invalide" });
    }
    const body = parsed.data;
    const prisma = getPrisma();
    const row = await getOrCreateRow();

    // 1. Mise à jour du compte de provisioning si identifiants fournis
    let account = {
      jellyfinUserId: row.jellyfinUserId,
      username: row.username,
      jellyfinAccessToken: row.jellyfinAccessToken,
    };
    if (body.username && body.password) {
      try {
        const auth = await authenticateJellyfinUser(body.username, body.password);
        account = {
          jellyfinUserId: auth.userId,
          username: auth.username,
          jellyfinAccessToken: auth.accessToken,
        };
      } catch {
        return reply.status(400).send({ message: "Identifiants du compte de provisioning invalides" });
      }
    }

    if (body.enabled) {
      // 2a. Activation — validations
      if (!body.expiresAt) {
        return reply.status(400).send({ message: "Une date d'expiration est requise pour activer le code" });
      }
      const expiresAt = new Date(body.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return reply.status(400).send({ message: "La date d'expiration doit être dans le futur" });
      }
      if (!account.jellyfinAccessToken || !account.jellyfinUserId) {
        return reply.status(400).send({ message: "Un compte de provisioning est requis" });
      }
      const serverUrl = getPublicUrl();
      if (!serverUrl) {
        return reply.status(400).send({ message: "L'URL publique du serveur doit être configurée" });
      }

      // Révoque l'éventuel appareil précédent (rotation du JWT)
      if (row.token) {
        await prisma.pairedDevice
          .deleteMany({ where: { tokenHash: hashToken(row.token) } })
          .catch(() => {});
      }

      // Mint d'un JWT device pour le compte dédié + PairedDevice (autorise le proxy
      // de streaming à l'identique du flux relay /tv-token). isAdmin: false (compte dédié).
      const deviceId = crypto.randomUUID();
      const token = await signDeviceToken({
        userId: account.jellyfinUserId,
        username: account.username!,
        isAdmin: false,
        deviceId,
      });
      await prisma.pairedDevice.create({
        data: {
          name: "Provisioning",
          jellyfinUserId: account.jellyfinUserId,
          username: account.username!,
          tokenHash: hashToken(token),
          jellyfinAccessToken: account.jellyfinAccessToken,
        },
      });

      // Grave l'entrée pré-confirmée dans le relay
      const expiresInSec = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      try {
        await seedProvisioningCode({
          code: row.code,
          serverUrl,
          token,
          user: { id: account.jellyfinUserId, name: account.username! },
          expiresInSec,
        });
      } catch (err) {
        await prisma.pairedDevice
          .deleteMany({ where: { tokenHash: hashToken(token) } })
          .catch(() => {});
        const msg = err instanceof Error ? err.message : "Échec du relay";
        return reply.status(502).send({ message: msg });
      }

      const updated = await prisma.provisioningCode.update({
        where: { id: row.id },
        data: { enabled: true, expiresAt, token, ...account },
      });
      return toState(updated);
    }

    // 2b. Désactivation — révoque l'appareil + l'entrée relay
    if (row.token) {
      await prisma.pairedDevice
        .deleteMany({ where: { tokenHash: hashToken(row.token) } })
        .catch(() => {});
    }
    await deleteProvisioningCode(row.code);
    const updated = await prisma.provisioningCode.update({
      where: { id: row.id },
      data: { enabled: false, token: null, ...account },
    });
    return toState(updated);
  });
};
