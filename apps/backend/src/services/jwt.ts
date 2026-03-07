import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getConfigValue, setConfigValue } from "./configStore";

const TOKEN_EXPIRY = "90d";

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
    return existing;
  }

  const secret = crypto.randomBytes(64).toString("hex");
  await setConfigValue("jwt_secret", secret);
  cachedSecret = secret;
  return secret;
}

export async function signDeviceToken(payload: Omit<DeviceTokenPayload, "type">): Promise<string> {
  const secret = await getOrCreateJwtSecret();
  return jwt.sign({ ...payload, type: "paired_device" } satisfies DeviceTokenPayload, secret, {
    expiresIn: TOKEN_EXPIRY,
  });
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenPayload | null> {
  try {
    const secret = await getOrCreateJwtSecret();
    const decoded = jwt.verify(token, secret) as DeviceTokenPayload;
    if (decoded.type !== "paired_device") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
