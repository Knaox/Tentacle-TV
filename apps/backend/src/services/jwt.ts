import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getConfigValue, setConfigValue } from "./configStore";

export interface DeviceTokenPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  deviceId: string;
  type: "paired_device";
}

let cachedSecret: string | null = null;

export async function getOrCreateJwtSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const existing = getConfigValue("jwt_secret");
  if (existing) {
    cachedSecret = existing;
    // Log non-sensible : empreinte courte du secret, permet de vérifier (via les
    // logs serveur) que la même clé est rechargée à chaque redémarrage. Si
    // l'empreinte change → la persistance DB est cassée et tous les clients
    // verront leurs tokens invalidés. Ne PAS logger le secret entier.
    console.log(`[JWT] secret loaded from DB — fingerprint=${existing.substring(0, 8)}…`);
    return existing;
  }

  const secret = crypto.randomBytes(64).toString("hex");
  await setConfigValue("jwt_secret", secret);
  cachedSecret = secret;
  console.log(`[JWT] secret generated and persisted — fingerprint=${secret.substring(0, 8)}…`);
  return secret;
}

// Pas d'expiresIn : les sessions des appareils appairés n'expirent jamais dans
// le temps. La sécurité repose sur la révocation : chaque token correspond à une
// ligne pairedDevice (tokenHash) vérifiée à CHAQUE requête et supprimable depuis
// l'admin — révocation immédiate, contrairement à une expiration différée.
export async function signDeviceToken(payload: Omit<DeviceTokenPayload, "type">): Promise<string> {
  const secret = await getOrCreateJwtSecret();
  return jwt.sign({ ...payload, type: "paired_device" } satisfies DeviceTokenPayload, secret);
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenPayload | null> {
  try {
    const secret = await getOrCreateJwtSecret();
    // ignoreExpiration : les tokens 90j déjà distribués restent valides après
    // leur date (pas de re-pairing forcé) ; la révocation DB fait foi.
    const decoded = jwt.verify(token, secret, { ignoreExpiration: true }) as DeviceTokenPayload;
    if (decoded.type !== "paired_device") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
