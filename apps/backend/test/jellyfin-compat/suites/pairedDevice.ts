/**
 * Un téléviseur jumelé, comme le crée le jumelage : une ligne `paired_devices`
 * dans la base JETABLE du passage et son jeton d'appareil signé du secret du
 * serveur. Sans jeton Jellyfin propre — le cas où le proxy lui substitue la
 * clé admin et réécrit ses reports de lecture.
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ctx } from "./support";

let token: string | null = null;

export async function pairedDeviceToken(): Promise<string> {
  if (token) return token;
  const { user, backend } = ctx();
  const signed = jwt.sign({ userId: user.id, username: user.name, isAdmin: false, deviceId: "compat-tv", type: "paired_device" }, backend.jwtSecret);
  const prisma = new PrismaClient({ datasourceUrl: backend.databaseUrl });
  try {
    await prisma.pairedDevice.create({
      data: { name: "Téléviseur de la suite", jellyfinUserId: user.id, username: user.name, tokenHash: createHash("sha256").update(signed).digest("hex") },
    });
  } finally {
    await prisma.$disconnect();
  }
  token = signed;
  return signed;
}

/** Les en-têtes d'un téléviseur jumelé : son JWT, et l'identité qu'il annonce. */
export function tvHeaders(jwtToken: string): Record<string, string> {
  return {
    "X-Emby-Token": jwtToken,
    "X-Emby-Authorization": `MediaBrowser Client="Tentacle TV - TV", Device="AndroidTV", DeviceId="compat-tv", Version="1.9.0", Token="${jwtToken}"`,
  };
}
