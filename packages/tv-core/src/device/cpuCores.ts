/**
 * Les cœurs FAIBLES d'un processeur ARM, reconnus par leur identité
 * (`CPU implementer` : `CPU part` de `/proc/cpuinfo`) — des cœurs « in
 * order » ou d'entrée de gamme, ceux des box et des téléviseurs bon marché.
 *
 * Un cœur absent de la table n'est PAS faible : la règle ne dit « tous les
 * cœurs faibles » que si elle les reconnaît TOUS (`allCoresWeak`). Un cœur
 * inconnu ne fait jamais passer un appareil en Lite — le micro-test s'en
 * charge s'il le faut.
 */

/** Une identité de cœur : `0x41:0xd03` (fabricant ARM, Cortex-A53). */
export type CoreId = string;

/** Les cœurs faibles, et leur nom pour les journaux et la raison affichée. */
export const WEAK_CORES: Readonly<Record<CoreId, string>> = {
  // ARM (0x41) : la famille « LITTLE » et les anciens 32 bits.
  "0x41:0xc05": "Cortex-A5",
  "0x41:0xc07": "Cortex-A7",
  "0x41:0xc08": "Cortex-A8",
  "0x41:0xc09": "Cortex-A9",
  "0x41:0xd01": "Cortex-A32",
  "0x41:0xd03": "Cortex-A53",
  "0x41:0xd04": "Cortex-A35",
  "0x41:0xd05": "Cortex-A55",
  "0x41:0xd46": "Cortex-A510",
  "0x41:0xd80": "Cortex-A520",
  // Broadcom (0x42) : Brahma-B53, l'A53 des SoC de box (BCM7271 de la net+).
  "0x42:0x100": "Brahma-B53",
  // Qualcomm (0x51) : les cœurs « Silver » des Kryo (dérivés d'A53 / A55).
  "0x51:0x801": "Kryo Silver (A53)",
  "0x51:0x803": "Kryo 385 Silver (A55)",
  "0x51:0x805": "Kryo 4xx Silver (A55)",
};

/** Quelques cœurs CAPABLES, nommés seulement pour les journaux. */
const KNOWN_CORES: Readonly<Record<CoreId, string>> = {
  "0x41:0xd07": "Cortex-A57",
  "0x41:0xd08": "Cortex-A72",
  "0x41:0xd09": "Cortex-A73",
  "0x41:0xd0a": "Cortex-A75",
  "0x41:0xd0b": "Cortex-A76",
  "0x41:0xd0d": "Cortex-A77",
  "0x41:0xd41": "Cortex-A78",
  "0x4e:0x004": "Denver 2",
};

/** Normalise une identité lue (`0X41:0XD03`, `65:3331`…) en `0x41:0xd03`. */
export function normalizeCoreId(raw: string): CoreId | null {
  const parts = raw.trim().toLowerCase().split(":");
  if (parts.length !== 2) return null;
  // Le fabricant sur deux chiffres, le cœur sur trois : la forme du noyau.
  const hex = parts.map((part, index) => {
    const value = part.startsWith("0x") ? Number.parseInt(part.slice(2), 16) : Number.parseInt(part, 10);
    return Number.isFinite(value) && value >= 0 ? `0x${value.toString(16).padStart(index === 0 ? 2 : 3, "0")}` : null;
  });
  return hex[0] && hex[1] ? `${hex[0]}:${hex[1]}` : null;
}

/** Le nom d'un cœur, ou son identité brute. */
export function coreName(id: CoreId): string {
  return WEAK_CORES[id] ?? KNOWN_CORES[id] ?? id;
}

/**
 * Vrai quand TOUS les cœurs de l'appareil sont reconnus faibles. Il faut
 * l'identité de chacun : un `/proc/cpuinfo` qui n'en montre qu'une partie
 * (les grands cœurs d'un big.LITTLE éteints au moment de la lecture) ne dit
 * rien — sinon un appareil puissant passerait en Lite sur ses seuls petits
 * cœurs (faux positif).
 */
export function allCoresWeak(parts: readonly CoreId[] | undefined, coreCount: number | undefined): boolean {
  if (!parts || parts.length === 0) return false;
  if (coreCount !== undefined && parts.length < coreCount) return false;
  return parts.every((id) => id in WEAK_CORES);
}

/** « 4 × Cortex-A53 », « 4 × Cortex-A53 + 4 × Cortex-A73 » : pour les journaux. */
export function describeCores(parts: readonly CoreId[] | undefined): string | null {
  if (!parts || parts.length === 0) return null;
  const counts = new Map<string, number>();
  for (const id of parts) counts.set(coreName(id), (counts.get(coreName(id)) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${count} × ${name}`).join(" + ");
}
