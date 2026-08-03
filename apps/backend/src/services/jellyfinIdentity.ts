import crypto from "crypto";
import { getPrisma } from "./db";
import { setConfigValue } from "./configStore";
import { BACKEND_VERSION } from "./version";

/**
 * Identité que ce serveur Tentacle présente à Jellyfin.
 *
 * POURQUOI CE FICHIER EXISTE — Jellyfin indexe ses sessions sur le DeviceId.
 * À chaque `AuthenticateByName`, `SessionManager.GetAuthorizationToken` fait
 * deux choses lourdes de conséquences :
 *   1. il RÉVOQUE (Logout) tous les tokens portant ce DeviceId qui
 *      n'appartiennent pas au couple (utilisateur, appareil) courant ;
 *   2. il RÉÉMET le token existant quand ce couple est déjà connu.
 *
 * Nos DeviceId étaient entièrement déterministes (`tentacle-server-<user>`,
 * `tentacle-setup`, `tentacle-backend`). Deux serveurs Tentacle branchés sur le
 * même Jellyfin — un de développement et un de production, typiquement —
 * partageaient donc le même espace d'appareils et se déconnectaient
 * mutuellement. D'où l'identifiant d'installation ci-dessous : une entropie
 * propre à chaque base de données, donc à chaque déploiement.
 */

const INSTALL_ID_KEY = "install_id";

export type IdentityKind = "web" | "setup" | "provisioning" | "backend";

/** Mémoïsation de la PROMESSE (pas de la valeur) : deux appels concurrents au
 *  démarrage ne doivent pas générer deux identifiants concurrents. */
let installIdPromise: Promise<string> | null = null;
let installIdCache: string | null = null;

/**
 * Identifiant d'installation, persisté dans `server_config`. Créé à la première
 * demande, stable ensuite pour toute la vie de la base.
 *
 * La lecture tape la base DIRECTEMENT plutôt que `getConfigValue` : le cache de
 * `configStore` n'est hydraté que par `detectAppState()`, et lire trop tôt
 * renverrait `undefined` — on générerait alors un nouvel identifiant qui
 * écraserait celui du serveur. C'est exactement le piège documenté pour
 * `jwt_secret` (cf. `scripts/confirm-device-code.ts`). L'écriture, elle, passe
 * par `setConfigValue` pour garder le cache cohérent.
 */
export async function ensureInstallId(): Promise<string> {
  if (installIdCache) return installIdCache;
  if (!installIdPromise) {
    installIdPromise = resolveInstallId().catch((err) => {
      installIdPromise = null; // base indisponible : réessayer au prochain appel
      throw err;
    });
  }
  return installIdPromise;
}

async function resolveInstallId(): Promise<string> {
  const prisma = getPrisma();
  const existing = await prisma.serverConfig.findUnique({ where: { key: INSTALL_ID_KEY } });
  if (existing?.value) {
    installIdCache = existing.value;
    return existing.value;
  }

  const generated = crypto.randomBytes(6).toString("hex");
  await setConfigValue(INSTALL_ID_KEY, generated);
  installIdCache = generated;
  console.log(`[Identity] install id generated and persisted — ${generated}`);
  return generated;
}

/** Vide la mémoïsation (tests). */
export function resetInstallIdCache(): void {
  installIdPromise = null;
  installIdCache = null;
}

/**
 * Fabrique un DeviceId Jellyfin. Fonction PURE, séparée de la résolution de
 * l'identifiant d'installation pour rester testable sans base de données.
 *
 * Le discriminant est encodé : les en-têtes HTTP doivent être ASCII, et Kestrel
 * (le serveur de Jellyfin) rejette la requête en 400 sinon — ce qui se
 * traduisait par un faux « Identifiants invalides » pour tout compte au nom
 * accentué (cf. commit cde9bd5).
 */
export function buildDeviceId(installId: string, kind: IdentityKind, discriminant?: string): string {
  const base = `tentacle-${installId}-${kind}`;
  return discriminant ? `${base}-${encodeURIComponent(discriminant)}` : base;
}

/** DeviceId complet, identifiant d'installation résolu au passage. */
export async function deviceIdFor(kind: IdentityKind, discriminant?: string): Promise<string> {
  return buildDeviceId(await ensureInstallId(), kind, discriminant);
}

/**
 * Variante synchrone, pour les chemins qui ne peuvent pas attendre — ils ne
 * s'AUTHENTIFIENT pas, ils portent un token déjà obtenu, donc ne déclenchent
 * aucune révocation. Repli `unset` tant que `ensureInstallId()` n'a pas tourné
 * (appelé au démarrage, dans `index.ts`).
 */
export function deviceIdForSync(kind: IdentityKind, discriminant?: string): string {
  return buildDeviceId(installIdCache ?? "unset", kind, discriminant);
}

export interface AuthHeaderParts {
  /** Nom lisible affiché par le dashboard Jellyfin (Web, Setup, Provisioning…). */
  device: string;
  deviceId: string;
  client?: string;
  /** Présent uniquement quand on porte un token déjà obtenu. */
  token?: string;
}

/** Retire ce qui casserait l'en-tête : hors-ASCII (rejeté en 400 par Kestrel) et
 *  guillemets (qui refermeraient la valeur). Les espaces restent — ils sont
 *  légitimes dans un nom lisible comme « Tentacle Backend ». */
function asciiLabel(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "");
}

/** En-tête `MediaBrowser …`, schéma d'auth pérenne (les X-Emby-* sont dépréciés
 *  depuis Jellyfin 10.11). Source unique des quatre gabarits qui coexistaient. */
export function buildAuthHeader({ device, deviceId, client, token }: AuthHeaderParts): string {
  const parts = [
    `MediaBrowser Client="${asciiLabel(client ?? "Tentacle TV")}"`,
    `Device="${asciiLabel(device)}"`,
    `DeviceId="${deviceId}"`,
    `Version="${BACKEND_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return parts.join(", ");
}
