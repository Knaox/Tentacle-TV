/**
 * Les conversions du formulaire de plafond de débit. L'admin saisit des
 * Mio/s — l'unité que la ligne de transfert des clients affiche déjà (« 3
 * Mio/s ») —, le serveur stocke des octets par seconde entiers. Pur, testé
 * seul.
 */

export const MIB = 1024 * 1024;
/** Bornes de saisie, en Mio/s : 0,1 (≈ 100 Kio/s) à 10 240 (10 Gio/s). */
export const MIN_MIB_PER_S = 0.1;
export const MAX_MIB_PER_S = 10_240;

export interface CapDraft {
  enabled: boolean;
  /** Le texte du champ, tel que saisi — la virgule est acceptée. */
  mib: string;
}

/** Une décimale au plus, sans zéro inutile : 6 → « 6 », 6,5 → « 6.5 ». */
export function formatMib(bps: number): string {
  return (Math.round((bps / MIB) * 10) / 10).toString();
}

export function toDraft(bps: number | null): CapDraft {
  return { enabled: bps !== null, mib: bps === null ? "" : formatMib(bps) };
}

/** `null` = illimité ; `undefined` = saisie invalide, rien à envoyer. */
export function toBps(draft: CapDraft): number | null | undefined {
  if (!draft.enabled) return null;
  const value = Number(draft.mib.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < MIN_MIB_PER_S || value > MAX_MIB_PER_S) return undefined;
  return Math.round(value * MIB);
}
