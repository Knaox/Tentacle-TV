/**
 * Les rangées dont l'entrée s'est déjà jouée pendant cette session, par leur
 * CONTENU (titre et titres de tête) — la règle, pure ; `useRowEntrance` la lit.
 *
 * L'entrée (`rowEntrance`) se joue « une fois dans la vie d'une rangée ». Mais
 * changer de page remonte les rangées : chaque retour sur l'accueil ou sur
 * « Pour vous » retenait de nouveau les affiches, invisibles ≈ 600 ms alors
 * qu'elles étaient déjà décodées, puis les refaisait monter en cascade — un des
 * deux visages du clignotement mesuré le 25/10 (l'autre : `lib/seenImages`).
 *
 * Désormais une rangée déjà entrée ne rejoue rien quand elle revient AVEC LE
 * MÊME CONTENU ; une rangée nouvelle, ou dont la tête a changé, entre comme
 * avant. Borné, mémoire du module seulement.
 */

export const ROW_ENTRANCE_MEMORY_MAX = 200;
/** Les titres de tête qui font l'identité : la première vue, au plus large. */
const HEAD_KEYS = 12;

const played = new Set<string>();

/** L'identité d'une rangée pour son entrée : son titre et ses premiers titres. */
export function rowEntranceId(title: string, keys: readonly string[]): string {
  return `${title}\u0000${keys.slice(0, HEAD_KEYS).join("\u0001")}`;
}

export function hasRowEntered(id: string | undefined): boolean {
  return id !== undefined && played.has(id);
}

export function markRowEntered(id: string | undefined): void {
  if (id === undefined) return;
  played.delete(id);
  played.add(id);
  if (played.size > ROW_ENTRANCE_MEMORY_MAX) {
    const oldest = played.values().next().value;
    if (oldest !== undefined) played.delete(oldest);
  }
}

/** Pour les tests. */
export function resetRowEntranceMemoryForTests(): void {
  played.clear();
}
