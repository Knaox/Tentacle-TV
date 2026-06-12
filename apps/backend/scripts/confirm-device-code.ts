/**
 * Outil de dev : confirme un code de jumelage « device » (flux manuel TV)
 * comme le ferait POST /api/pair/device/confirm, en réutilisant l'utilisateur
 * du dernier appareil appairé en DB (pas besoin de session web).
 *
 *   pnpm exec tsx scripts/confirm-device-code.ts <CODE>
 */
import "dotenv/config";
import { getPrisma, initPrisma } from "../src/services/db";
import { detectAppState } from "../src/services/configStore";
import { signDeviceToken, hashToken } from "../src/services/jwt";
import crypto from "crypto";

async function main() {
  const code = (process.argv[2] ?? "").toUpperCase();
  if (code.length !== 4) {
    console.error("Usage: tsx scripts/confirm-device-code.ts <CODE-4-CARACTERES>");
    process.exit(1);
  }

  const ok = await initPrisma();
  if (!ok) {
    console.error("Connexion DB impossible (DATABASE_URL).");
    process.exit(1);
  }
  // Hydrate le cache configStore (jwt_secret !) — sans ça, signDeviceToken
  // régénère un secret et écrase celui du serveur.
  await detectAppState();
  const prisma = getPrisma();

  const record = await prisma.pairingCode.findUnique({ where: { code } });
  if (!record || record.status !== "device_pending" || record.expiresAt < new Date()) {
    console.error(`Code ${code} introuvable / non device_pending / expiré`, record?.status);
    process.exit(1);
  }

  // Reprend l'utilisateur du dernier appareil appairé (ou d'un code confirmé)
  const lastDevice = await prisma.pairedDevice.findFirst({ orderBy: { createdAt: "desc" } });
  if (!lastDevice) {
    console.error("Aucun appareil appairé en DB — impossible de déduire l'utilisateur.");
    process.exit(1);
  }

  const token = await signDeviceToken({
    userId: lastDevice.jellyfinUserId,
    username: lastDevice.username,
    isAdmin: true,
    deviceId: record.deviceId ?? crypto.randomUUID(),
  });

  await prisma.pairedDevice.create({
    data: {
      name: record.deviceName || "TV (dev script)",
      jellyfinUserId: lastDevice.jellyfinUserId,
      username: lastDevice.username,
      tokenHash: hashToken(token),
      jellyfinAccessToken: lastDevice.jellyfinAccessToken,
    },
  });

  await prisma.pairingCode.update({
    where: { id: record.id },
    data: {
      status: "device_confirmed",
      token,
      jellyfinUserId: lastDevice.jellyfinUserId,
      username: lastDevice.username,
    },
  });

  console.log(`Code ${code} confirmé pour ${lastDevice.username} (${lastDevice.jellyfinUserId})`);
  process.exit(0);
}

void main();
