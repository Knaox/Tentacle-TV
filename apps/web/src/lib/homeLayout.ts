import type { HomeRowDescriptor } from "@tentacle-tv/api-client";

export interface LibraryRef {
  id: string;
  name: string;
}

export interface ReconcileOptions {
  /** Insère les bibliothèques NOUVELLES à l'ancre (avant « Déjà visionné »)
   *  au lieu de la fin. Réservé au défaut serveur non stocké : y matérialiser
   *  l'ordre cible de l'accueil recommandé est notre design ; réordonner un
   *  layout que l'utilisateur a arrangé serait une réorganisation non
   *  sollicitée — là, l'ajout en fin reste prévisible. */
  anchorNewLibraries?: boolean;
}

/**
 * Réconcilie la mise en page stockée avec les bibliothèques RÉELLES du moment :
 * l'ordre stocké fait foi ; une bibliothèque nouvelle s'ajoute en fin (active)
 * — ou à l'ancre sur le défaut non stocké ; une bibliothèque disparue est
 * ignorée. Pur — aucune écriture : la mise en page ne se sauvegarde que sur
 * action de l'utilisateur (migration silencieuse).
 */
export function reconcileHomeRows(
  stored: HomeRowDescriptor[],
  libraries: LibraryRef[],
  opts: ReconcileOptions = {}
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

  const missing: HomeRowDescriptor[] = [];
  for (const lib of libraries) {
    const key = `library:${lib.id}`;
    if (!seen.has(key)) missing.push({ key, enabled: true });
  }
  if (missing.length === 0) return out;
  if (!opts.anchorNewLibraries) return [...out, ...missing];

  // Ancre : juste avant « Déjà visionné »/« Ma liste » — sur le défaut
  // serveur, cela donne l'ordre cible : reprise, prochains, Pour vous,
  // Derniers ajouts (×N), Déjà visionné, Ma liste, rangées éteintes.
  let at = out.findIndex((r) => r.key === "watched" || r.key === "watchlist");
  if (at < 0) {
    const forYou = out.findIndex((r) => r.key === "reco:forYou");
    at = forYou >= 0 ? forYou + 1 : out.length;
  }
  const next = [...out];
  next.splice(at, 0, ...missing);
  return next;
}

/** Déplace la rangée d'un cran (boutons monter/descendre + dépôt du glisser). */
export function moveRow(rows: HomeRowDescriptor[], from: number, to: number): HomeRowDescriptor[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
