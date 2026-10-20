import { normalizeJellyfinId } from "../userRights/userRightsPatch";

/**
 * Les BIBLIOTHÈQUES du contrôle parental simplifié de la TV et du mobile —
 * module pur, partagé (tv-core le ré-exporte). Une
 * case par bibliothèque que le profil verrait sans la famille (`available` :
 * celles de son créateur pour un invité, sa base pour un membre) ; `allowed`
 * null = toutes, sans restriction familiale. C'est Jellyfin qui applique
 * (politique du profil) ; la TV n'envoie que la liste voulue.
 *
 * Tout coché s'envoie `null` (« toutes », celles d'après comprises) ; au moins
 * une case reste cochée — la dernière ne se décoche pas (`last`).
 */

export interface ParentalLibraryOption {
  id: string;
  name: string;
  collectionType: string | null;
}

export interface ParentalLibraryRow extends ParentalLibraryOption {
  checked: boolean;
}

export type ParentalLibrariesToggle = { kind: "set"; allowed: string[] | null } | { kind: "last" };

function same(a: string, b: string): boolean {
  return normalizeJellyfinId(a) === normalizeJellyfinId(b);
}

function isAllowed(allowed: readonly string[] | null, id: string): boolean {
  return allowed === null || allowed.some((entry) => same(entry, id));
}

/** Les lignes, dans l'ordre du serveur, chacune cochée ou non. */
export function parentalLibraryRows(available: readonly ParentalLibraryOption[], allowed: readonly string[] | null): ParentalLibraryRow[] {
  return available.map((library) => ({ ...library, checked: isAllowed(allowed, library.id) }));
}

/** Coche ou décoche une bibliothèque ; la liste à envoyer, ou le refus de vider la liste. */
export function toggleParentalLibrary(
  available: readonly ParentalLibraryOption[],
  allowed: readonly string[] | null,
  id: string,
): ParentalLibrariesToggle {
  // Dans l'ordre du serveur : la case visée bascule, les autres gardent leur état.
  const next = available
    .filter((library) => (same(library.id, id) ? !isAllowed(allowed, library.id) : isAllowed(allowed, library.id)))
    .map((library) => library.id);
  if (next.length === 0) return { kind: "last" };
  return { kind: "set", allowed: next.length === available.length ? null : next };
}

/** Combien de bibliothèques sur combien : le résumé d'une ligne (« 2 sur 4 »), null s'il n'y a rien à restreindre. */
export function parentalLibrariesCount(available: readonly ParentalLibraryOption[], allowed: readonly string[] | null): { on: number; total: number } | null {
  if (available.length === 0) return null;
  return { on: available.filter((library) => isAllowed(allowed, library.id)).length, total: available.length };
}
