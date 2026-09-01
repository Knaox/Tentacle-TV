import type { HomeRowDescriptor } from "@tentacle-tv/api-client";

export interface LibraryRef {
  id: string;
  name: string;
}

/**
 * Réconcilie la mise en page stockée avec les bibliothèques RÉELLES du moment :
 * l'ordre stocké fait foi ; une bibliothèque nouvelle s'ajoute en fin (active,
 * comme l'accueil historique) ; une bibliothèque disparue est ignorée. Pur —
 * aucune écriture : la mise en page ne se sauvegarde que sur action de
 * l'utilisateur (migration silencieuse).
 */
export function reconcileHomeRows(
  stored: HomeRowDescriptor[],
  libraries: LibraryRef[]
): HomeRowDescriptor[] {
  const libraryIds = new Set(libraries.map((l) => l.id));
  const out: HomeRowDescriptor[] = [];
  const seen = new Set<string>();

  for (const row of stored) {
    if (seen.has(row.key)) continue;
    if (row.key.startsWith("library:")) {
      const id = row.key.slice("library:".length);
      if (!libraryIds.has(id)) continue;
    }
    seen.add(row.key);
    out.push(row);
  }

  for (const lib of libraries) {
    const key = `library:${lib.id}`;
    if (!seen.has(key)) out.push({ key, enabled: true });
  }

  return out;
}

/** Déplace la rangée d'un cran (boutons monter/descendre + dépôt du glisser). */
export function moveRow(rows: HomeRowDescriptor[], from: number, to: number): HomeRowDescriptor[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
