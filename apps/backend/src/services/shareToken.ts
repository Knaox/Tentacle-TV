import crypto from "crypto";

/**
 * Le jeton d'un lien de partage (liste ou statistiques) : 8 octets tirés au
 * hasard cryptographique, en hexadécimal. 2⁶⁴ possibilités, sous la limite
 * de débit des routes publiques : aucune énumération n'aboutit.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(8).toString("hex");
}
