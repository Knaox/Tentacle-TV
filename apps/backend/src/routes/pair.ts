import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../services/db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { signDeviceToken, hashToken } from "../services/jwt";

const PAIR_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => PAIR_CHARS[b % PAIR_CHARS.length])
    .join("");
}

const generateSchema = z.object({
  deviceName: z.string().max(100).optional(),
  deviceId: z.string().max(255).optional(),
});

const confirmSchema = z.object({
  code: z
    .string()
    .length(4)
    .transform((s) => s.toUpperCase()),
});

export const pairRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /generate — TV requests a pairing code (no auth) ──
  app.post(
    "/generate",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const body = generateSchema.parse(request.body ?? {});
      const prisma = getPrisma();

      // Clean expired codes opportunistically
      await prisma.pairingCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      // Generate unique code (retry on collision)
      let code = "";
      for (let i = 0; i < 10; i++) {
        const candidate = generateCode();
        const existing = await prisma.pairingCode.findUnique({
          where: { code: candidate },
        });
        if (!existing) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        return reply
          .status(503)
          .send({ message: "Impossible de générer un code, réessayez." });
      }

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await prisma.pairingCode.create({
        data: {
          code,
          deviceName: body.deviceName ?? "TV",
          deviceId: body.deviceId,
          expiresAt,
        },
      });

      return { code, expiresAt: expiresAt.toISOString() };
    },
  );

  // ── GET /status/:code — TV polls for confirmation (no auth) ──
  app.get("/status/:code", async (request) => {
    const { code } = request.params as { code: string };
    const prisma = getPrisma();

    const record = await prisma.pairingCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!record) {
      return { status: "expired" };
    }

    if (record.expiresAt < new Date()) {
      // Clean up expired code
      await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});
      return { status: "expired" };
    }

    if (record.status === "confirmed" && record.token) {
      const { token, jellyfinUserId, username } = record;

      // Delete the code (single-use)
      await prisma.pairingCode.delete({ where: { id: record.id } }).catch(() => {});

      return {
        status: "confirmed",
        token,
        userId: jellyfinUserId,
        username,
      };
    }

    return { status: record.status };
  });

  // ── POST /confirm — Web user confirms pairing (auth required) ──
  app.post(
    "/confirm",
    {
      preHandler: [requireAuth],
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const user = (request as any).user as JellyfinUser;
      const body = confirmSchema.parse(request.body);
      const prisma = getPrisma();

      const record = await prisma.pairingCode.findUnique({
        where: { code: body.code },
      });

      if (!record || record.expiresAt < new Date()) {
        return reply.status(400).send({ message: "Code invalide ou expiré" });
      }

      if (record.status !== "pending") {
        return reply.status(409).send({ message: "Code déjà utilisé" });
      }

      // Generate long-lived JWT for the TV
      const deviceId = record.deviceId || crypto.randomUUID();
      const token = await signDeviceToken({
        userId: user.userId,
        username: user.username,
        isAdmin: user.isAdmin,
        deviceId,
      });

      // Register the paired device
      await prisma.pairedDevice.create({
        data: {
          name: record.deviceName || "TV",
          jellyfinUserId: user.userId,
          username: user.username,
          tokenHash: hashToken(token),
        },
      });

      // Update pairing code so the TV can pick up the token
      await prisma.pairingCode.update({
        where: { id: record.id },
        data: {
          status: "confirmed",
          jellyfinUserId: user.userId,
          username: user.username,
          token,
        },
      });

      return { success: true, deviceName: record.deviceName };
    },
  );

  // ── GET /devices — List paired devices (admin only) ──
  app.get("/devices", { preHandler: [requireAdmin] }, async () => {
    const prisma = getPrisma();
    const devices = await prisma.pairedDevice.findMany({
      orderBy: { createdAt: "desc" },
    });
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      jellyfinUserId: d.jellyfinUserId,
      lastSeen: d.lastSeen,
      createdAt: d.createdAt,
    }));
  });

  // ── DELETE /devices/:id — Revoke a paired device (admin only) ──
  app.delete(
    "/devices/:id",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const prisma = getPrisma();

      const device = await prisma.pairedDevice.findUnique({ where: { id } });
      if (!device) {
        return reply.status(404).send({ message: "Appareil introuvable" });
      }

      await prisma.pairedDevice.delete({ where: { id } });
      return { success: true };
    },
  );
};
