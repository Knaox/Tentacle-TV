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

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
/** Une IPv6 plausible : des groupes hexadécimaux et des « : », rien d'autre — le serveur tranche. */
const IPV6_RE = /^[0-9a-f:]+$/i;

function isIpv4(value: string): boolean {
  const m = value.match(IPV4_RE);
  return m !== null && m.slice(1).every((octet) => Number(octet) <= 255);
}

/** Une adresse IPv4 ou IPv6, ou une plage IPv4 `a.b.c.d/n` — la même règle que le serveur. */
export function isValidIpOrCidr(entry: string): boolean {
  const value = entry.trim();
  const slash = value.indexOf("/");
  if (slash !== -1) {
    const bits = Number(value.slice(slash + 1));
    return isIpv4(value.slice(0, slash)) && Number.isInteger(bits) && bits >= 0 && bits <= 32;
  }
  return isIpv4(value) || (value.includes(":") && value.length >= 2 && IPV6_RE.test(value));
}
