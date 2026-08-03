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
const DEVICE_SECRET_KEY = "device_id_secret";

/** Sépare les composantes hachées. Le caractère nul ne peut apparaître dans
 *  aucune d'elles, ce qui écarte les collisions par concaténation ambiguë :
 *  sans lui, ("ab", "c") et ("a", "bc") donneraient le même identifiant. */
const PART_SEPARATOR = "\u0000";

export type IdentityKind = "web" | "setup" | "provisioning" | "backend";

/** Mémoïsation de la PROMESSE (pas de la valeur) : deux appels concurrents au
 *  démarrage ne doivent pas générer deux valeurs concurrentes. */
const promises = new Map<string, Promise<string>>();
const values = new Map<string, string>();

/**
 * Valeur aléatoire persistée dans `server_config`. Créée à la première demande,
 * stable ensuite pour toute la vie de la base.
 *
 * La lecture tape la base DIRECTEMENT plutôt que `getConfigValue` : le cache de
 * `configStore` n'est hydraté que par `detectAppState()`, et lire trop tôt
 * renverrait `undefined` — on générerait alors une nouvelle valeur qui
 * écraserait celle du serveur. C'est exactement le piège documenté pour
 * `jwt_secret` (cf. `scripts/confirm-device-code.ts`). L'écriture, elle, passe
 * par `setConfigValue` pour garder le cache cohérent.
 */
async function ensurePersistedRandom(key: string, bytes: number, label: string): Promise<string> {
  const cached = values.get(key);
  if (cached) return cached;

  let pending = promises.get(key);
  if (!pending) {
    pending = resolvePersistedRandom(key, bytes, label).catch((err) => {
      promises.delete(key); // base indisponible : réessayer au prochain appel
      throw err;
    });
    promises.set(key, pending);
  }
  return pending;
}

async function resolvePersistedRandom(key: string, bytes: number, label: string): Promise<string> {
  const prisma = getPrisma();
  const existing = await prisma.serverConfig.findUnique({ where: { key } });
  if (existing?.value) {
    values.set(key, existing.value);
    return existing.value;
  }

  const generated = crypto.randomBytes(bytes).toString("hex");
  await setConfigValue(key, generated);
  values.set(key, generated);
  // L'identifiant d'installation n'est pas secret (il part dans le DeviceId) — on
  // le journalise pour pouvoir relier une entrée Jellyfin à un serveur. Le secret
  // de hachage, lui, ne doit JAMAIS apparaître dans les logs.
  const trace = key === INSTALL_ID_KEY ? ` — ${generated}` : "";
  console.log(`[Identity] ${label} generated and persisted${trace}`);
  return generated;
}

/** Identifiant d'installation — public, il figure en clair dans le DeviceId. */
export async function ensureInstallId(): Promise<string> {
  return ensurePersistedRandom(INSTALL_ID_KEY, 6, "install id");
}

/** Clé de hachage des discriminants fournis par le client. SECRÈTE : c'est elle
 *  qui empêche un utilisateur de fabriquer le DeviceId d'un autre. */
function ensureDeviceSecret(): Promise<string> {
  return ensurePersistedRandom(DEVICE_SECRET_KEY, 32, "device id secret");
}

/** Vide la mémoïsation (tests). */
export function resetInstallIdCache(): void {
  promises.clear();
  values.clear();
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

/** DeviceId complet, identifiant d'installation résolu au passage. Pour les
 *  discriminants que le SERVEUR choisit (nom d'un compte à provisionner, par
 *  exemple) : ils restent lisibles dans le dashboard Jellyfin. */
export async function deviceIdFor(kind: IdentityKind, discriminant?: string): Promise<string> {
  return buildDeviceId(await ensureInstallId(), kind, discriminant);
}

/** Discriminant opaque : HMAC-SHA256 tronqué à 64 bits. PURE, testable sans base. */
export function buildOpaqueDiscriminant(secret: string, parts: string[]): string {
  return crypto
    .createHmac("sha256", secret)
    .update(parts.join(PART_SEPARATOR))
    .digest("hex")
    .slice(0, 16);
}

/**
 * DeviceId dont le discriminant vient (au moins en partie) du CLIENT.
 *
 * Le hachage par une clé secrète propre au serveur est ce qui empêche un
 * utilisateur authentifié de fabriquer le DeviceId d'un autre : Jellyfin révoque
 * tous les tokens portant un DeviceId donné dès qu'un autre compte s'y
 * authentifie, si bien qu'un identifiant devinable offrirait une déconnexion
 * ciblée à qui connaîtrait l'appareil de sa victime. Le compte fait partie des
 * composantes hachées, précisément pour que deux comptes ne puissent jamais
 * retomber sur le même identifiant.
 */
export async function deviceIdForOpaque(kind: IdentityKind, ...parts: string[]): Promise<string> {
  const [installId, secret] = await Promise.all([ensureInstallId(), ensureDeviceSecret()]);
  return buildDeviceId(installId, kind, buildOpaqueDiscriminant(secret, parts));
}

/**
 * Variante synchrone, pour les chemins qui ne peuvent pas attendre — ils ne
 * s'AUTHENTIFIENT pas, ils portent un token déjà obtenu, donc ne déclenchent
 * aucune révocation. Repli `unset` tant que `ensureInstallId()` n'a pas tourné
 * (appelé au démarrage, dans `index.ts`).
 */
export function deviceIdForSync(kind: IdentityKind, discriminant?: string): string {
  return buildDeviceId(values.get(INSTALL_ID_KEY) ?? "unset", kind, discriminant);
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

/** Alphabet d'un identifiant : celui que produit `encodeURIComponent`, espaces
 *  exclus. Redondant avec `buildDeviceId` pour les appelants d'aujourd'hui, et
 *  c'est le but — un futur appelant qui passerait une valeur brute venue du
 *  client ne doit pas pouvoir refermer le guillemet et greffer un `Token="…"`. */
function asciiId(value: string): string {
  return value.replace(/[^A-Za-z0-9%._~!*'()-]/g, "");
}

/** En-tête `MediaBrowser …`, schéma d'auth pérenne (les X-Emby-* sont dépréciés
 *  depuis Jellyfin 10.11). Source unique des quatre gabarits qui coexistaient. */
export function buildAuthHeader({ device, deviceId, client, token }: AuthHeaderParts): string {
  const parts = [
    `MediaBrowser Client="${asciiLabel(client ?? "Tentacle TV")}"`,
    `Device="${asciiLabel(device)}"`,
    `DeviceId="${asciiId(deviceId)}"`,
    `Version="${BACKEND_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return parts.join(", ");
}
