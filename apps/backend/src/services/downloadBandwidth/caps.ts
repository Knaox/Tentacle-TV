/**
 * Les clés et les bornes du plafond de débit des téléchargements.
 *
 * Deux plafonds indépendants, en octets par seconde, dans la table de
 * configuration clé/valeur : un pour les clients extérieurs, un pour le
 * réseau local — la même distinction que la lecture directe (`isPrivateIp`).
 * Clé absente = illimité : c'est le défaut, rien ne change pour personne tant
 * que l'admin n'y touche pas.
 */

export type PoolId = "internal" | "external";

/** Octets par seconde ; `null` = illimité. */
export interface BandwidthCaps {
  internal: number | null;
  external: number | null;
}

export const DOWNLOAD_BANDWIDTH_KEYS: Record<PoolId, string> = {
  external: "download_bandwidth_external_bps",
  internal: "download_bandwidth_internal_bps",
};

/** 64 Kio/s : en dessous, un tick de 100 ms ne porte plus un bloc décent. */
export const MIN_CAP_BPS = 64 * 1024;
/** 10 Gio/s : au-delà, c'est une faute de frappe, pas un réglage. */
export const MAX_CAP_BPS = 10 * 1024 ** 3;

/** Clé absente, « 0 », vide ou illisible → illimité. */
export function parseCap(raw: string | undefined): number | null {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}
