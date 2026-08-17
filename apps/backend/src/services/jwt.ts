import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getConfigValue } from "./configStore";
import { getPrisma, hasPrisma } from "./db";

export interface DeviceTokenPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  deviceId: string;
  type: "paired_device";
}

export interface ImpersonationTokenPayload {
  /** Utilisateur Jellyfin ciblé (celui dont on voit l'app). */
  userId: string;
  username: string;
  /** Toujours false : une session impersonée ne doit jamais avoir les droits admin. */
  isAdmin: false;
  /** Admin à l'origine de l'impersonation (traçabilité). */
  adminUserId: string;
  adminUsername: string;
  type: "impersonation";
}

let cachedSecret: string | null = null;
// Single-flight : deux requêtes concurrentes pendant la fenêtre froide (cache
// configStore vidé/pas encore hydraté) ne doivent JAMAIS générer deux secrets.
let secretEnVol: Promise<string> | null = null;

export function getOrCreateJwtSecret(): Promise<string> {
  if (cachedSecret) return Promise.resolve(cachedSecret);
  if (secretEnVol) return secretEnVol;
  secretEnVol = resolveJwtSecret().finally(() => { secretEnVol = null; });
  return secretEnVol;
}

// Un secret régénéré à tort invalide TOUS les jumelages d'un coup (TVs, mobiles) :
// la résolution est donc paranoïaque. Ordre : mémo module → cache configStore →
// lecture DB DIRECTE (parade à la fenêtre `cache.clear()` de detectAppState et aux
// routes servies avant hydratation, ex. /api/ws) → génération UNIQUEMENT si la DB a
// répondu « aucune ligne », via create (jamais d'écrasement ; course P2002 → on
// adopte le secret du gagnant). DB injoignable → throw : pas de secret éphémère.
async function resolveJwtSecret(): Promise<string> {
  const fromCache = getConfigValue("jwt_secret");
  if (fromCache) {
    cachedSecret = fromCache;
    // Log non-sensible : empreinte courte, permet de vérifier (logs serveur) que la
    // même clé est rechargée à chaque redémarrage. Si l'empreinte change → la
    // persistance DB est cassée et tous les clients verront leurs tokens invalidés.
    console.log(`[JWT] secret loaded from DB — fingerprint=${fromCache.substring(0, 8)}…`);
    return fromCache;
  }
  if (!hasPrisma()) throw new Error("jwt_secret indisponible : base non connectée");
  const prisma = getPrisma();
  const row = await prisma.serverConfig.findUnique({ where: { key: "jwt_secret" } });
  if (row?.value) {
    cachedSecret = row.value;
    console.log(`[JWT] secret loaded from DB (direct) — fingerprint=${row.value.substring(0, 8)}…`);
    return row.value;
  }
  const secret = crypto.randomBytes(64).toString("hex");
  try {
    await prisma.serverConfig.create({ data: { key: "jwt_secret", value: secret } });
  } catch {
    // Course perdue (contrainte unique) ou DB tombée entre-temps : relire — si un
    // autre worker a gagné, son secret fait foi ; sinon on échoue franchement.
    const again = await prisma.serverConfig.findUnique({ where: { key: "jwt_secret" } });
    if (again?.value) {
      cachedSecret = again.value;
      console.log(`[JWT] secret adopted after race — fingerprint=${again.value.substring(0, 8)}…`);
      return again.value;
    }
    throw new Error("jwt_secret : écriture impossible");
  }
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

// Contrairement aux tokens d'appareils, les tokens d'impersonation EXPIRENT
// (8h) : pas de ligne DB de révocation, la fenêtre courte fait office de
// garde-fou. L'admin quitte le mode bien avant dans la pratique.
const IMPERSONATION_TTL = "8h";

export async function signImpersonationToken(
  payload: Omit<ImpersonationTokenPayload, "type" | "isAdmin">,
): Promise<string> {
  const secret = await getOrCreateJwtSecret();
  return jwt.sign(
    { ...payload, isAdmin: false, type: "impersonation" } satisfies ImpersonationTokenPayload,
    secret,
    { expiresIn: IMPERSONATION_TTL },
  );
}

export async function verifyImpersonationToken(token: string): Promise<ImpersonationTokenPayload | null> {
  try {
    const secret = await getOrCreateJwtSecret();
    // Expiration respectée (pas d'ignoreExpiration) : seule protection sans révocation DB.
    const decoded = jwt.verify(token, secret) as ImpersonationTokenPayload;
    if (decoded.type !== "impersonation") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
