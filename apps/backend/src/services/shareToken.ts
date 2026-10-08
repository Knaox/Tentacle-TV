import crypto from "crypto";

/**
 * Le jeton d'un lien de partage (liste ou statistiques) : 8 octets tirés au
 * hasard cryptographique, en hexadécimal. 2⁶⁴ possibilités, sous la limite
 * de débit des routes publiques : aucune énumération n'aboutit.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Le jeton tel qu'il est stocké (hexadécimal minuscule), quelle que soit la
 * casse de l'URL retapée : SQLite compare à la lettre, MariaDB ignorait la
 * casse (docs/sqlite/DECISION.md § 9).
 */
export function normalizeShareToken(token: string): string {
  return token.trim().toLowerCase();
}
