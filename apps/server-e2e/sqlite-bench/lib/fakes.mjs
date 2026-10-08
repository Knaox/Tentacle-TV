// Valeurs FACTICES de même forme que l'originale : même longueur, mêmes classes de
// caractères, même préfixe connu (`ExponentPushToken[`, `scrypt$…$`). Déterministes pour
// une clé de tirage donnée (HMAC) : une même valeur d'origine donne le même factice dans
// toutes les tables — un appareil, un jeton gardent leurs liens.
import crypto from "node:crypto";
import { promisify } from "node:util";

const KEEP_PREFIX = /^(ExponentPushToken\[|ExpoPushToken\[|scrypt\$\d+\$\d+\$\d+\$)/;

export function createFaker(seed = crypto.randomBytes(32)) {
  const stream = (value) => {
    let counter = 0;
    let pool = Buffer.alloc(0);
    return () => {
      if (pool.length === 0) {
        pool = crypto.createHmac("sha256", seed).update(`${value}\u0000${counter++}`).digest();
      }
      const b = pool[0];
      pool = pool.subarray(1);
      return b;
    };
  };

  /** Même forme, autre contenu. Les chiffres restent des chiffres, l'hexa reste hexa. */
  function sameShape(value) {
    const prefix = KEEP_PREFIX.exec(value)?.[0] ?? "";
    const next = stream(value);
    const hexOnly = /^[0-9a-f]+$/.test(value.slice(prefix.length));
    let out = prefix;
    for (const c of value.slice(prefix.length)) {
      const r = next();
      if (/[0-9]/.test(c)) out += hexOnly ? "0123456789abcdef"[r % 16] : String(r % 10);
      else if (/[a-f]/.test(c) && hexOnly) out += "0123456789abcdef"[r % 16];
      else if (/[a-z]/.test(c)) out += String.fromCharCode(97 + (r % 26));
      else if (/[A-Z]/.test(c)) out += String.fromCharCode(65 + (r % 26));
      else out += c; // ponctuation et séparateurs gardés : la forme reste lisible
    }
    // Une chance infime de retomber sur l'original : on la ferme.
    return out === value && value.length > prefix.length ? sameShape(`${value}\u0001`) : out;
  }

  return { sameShape };
}

const scrypt = promisify(crypto.scrypt);

/** Empreinte de PIN au format du cœur (`familyPins.hashPin`), pour un PIN du banc. */
export async function benchPinHash(pin) {
  const cost = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pin, salt, 32, cost);
  return `scrypt$${cost.N}$${cost.r}$${cost.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Forme sans tirets ↔ forme GUID d'un identifiant Jellyfin. */
export const dashed = (id) => `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
export const undashed = (id) => id.replace(/-/g, "").toLowerCase();

/** Échappe une chaîne pour une RegExp. */
export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
