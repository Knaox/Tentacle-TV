import type { HomeRowDescriptor } from "../hooks/useHomeLayout";

/**
 * La réconciliation des rangées de l'accueil — PURE, partagée par le web, le
 * mobile et la TV : c'est elle qui garantit que les trois plateformes rendent
 * le même ordre et les mêmes rangées depuis la même mise en page stockée.
 */
export interface LibraryRef {
  id: string;
  name: string;
}

export interface ReconcileHomeRowsOptions {
  /** Insère les bibliothèques NOUVELLES à l'ancre (avant « Déjà visionné »)
   *  au lieu de la fin. Réservé au défaut serveur non stocké : y matérialiser
   *  l'ordre cible de l'accueil recommandé est notre design ; réordonner un
   *  layout que l'utilisateur a arrangé serait une réorganisation non
   *  sollicitée — là, l'ajout en fin reste prévisible. */
  anchorNewLibraries?: boolean;
  /** Le catalogue servi par le serveur (les rangées statiques qu'il sait
   *  afficher). Ses clés absentes de la mise en page stockée s'ajoutent en
   *  fin, éteintes — sans ça, un compte à layout enregistré ne verrait jamais
   *  une rangée née après dans l'éditeur. Absent (chargement, vieux serveur) :
   *  rien n'est ajouté ni filtré. */
  catalog?: readonly HomeRowDescriptor[];
}

const LIBRARY_PREFIX = "library:";

/**
 * Réconcilie la mise en page stockée avec les bibliothèques RÉELLES du moment
 * et le catalogue du serveur : l'ordre stocké fait foi ; une bibliothèque
 * nouvelle s'ajoute en fin (active) — ou à l'ancre sur le défaut non stocké ;
 * une bibliothèque disparue est ignorée ; une rangée du catalogue absente
 * s'ajoute en fin, éteinte. AUCUNE autre clé stockée n'est retirée : une
 * rangée que le serveur ne sait plus servir (plugin Vigie coupé, clé TMDB
 * retirée) garde sa place et son état — `visibleHomeRows` la cache, et elle
 * reprend vie telle quelle quand la capacité revient. Pur — aucune écriture :
 * la mise en page ne se sauvegarde que sur action de l'utilisateur.
 */
export function reconcileHomeRows(
  stored: readonly HomeRowDescriptor[],
  libraries: readonly LibraryRef[],
  opts: ReconcileHomeRowsOptions = {}
): HomeRowDescriptor[] {
  const libraryIds = new Set(libraries.map((l) => l.id));
  const out: HomeRowDescriptor[] = [];
  const seen = new Set<string>();

  for (const row of stored) {
    if (seen.has(row.key)) continue;
    if (row.key.startsWith(LIBRARY_PREFIX) && !libraryIds.has(row.key.slice(LIBRARY_PREFIX.length))) continue;
    seen.add(row.key);
    out.push(row);
  }

  const missing: HomeRowDescriptor[] = [];
  for (const lib of libraries) {
    const key = `${LIBRARY_PREFIX}${lib.id}`;
    if (!seen.has(key)) missing.push({ key, enabled: true });
  }
  const appended: HomeRowDescriptor[] = (opts.catalog ?? [])
    .filter((row) => !seen.has(row.key))
    .map((row) => ({ key: row.key, enabled: false }));
  return [...placeLibraries(out, missing, opts), ...appended];
}

function placeLibraries(
  out: HomeRowDescriptor[],
  missing: HomeRowDescriptor[],
  opts: ReconcileHomeRowsOptions
): HomeRowDescriptor[] {
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

/** Une rangée s'affiche si le serveur sait la servir : clé du catalogue, ou
 *  bibliothèque (dynamique, hors catalogue). Sans catalogue, tout s'affiche. */
export function isHomeRowAvailable(key: string, catalog?: readonly HomeRowDescriptor[]): boolean {
  return !catalog || key.startsWith(LIBRARY_PREFIX) || catalog.some((row) => row.key === key);
}

/** Les rangées à RENDRE (accueil) ou à PROPOSER (éditeur) : celles que le
 *  serveur sait servir. Identité sans catalogue. */
export function visibleHomeRows(
  rows: HomeRowDescriptor[],
  catalog?: readonly HomeRowDescriptor[]
): HomeRowDescriptor[] {
  if (!catalog) return rows;
  return rows.filter((row) => isHomeRowAvailable(row.key, catalog));
}

/**
 * L'éditeur travaille sur la liste VISIBLE ; à la sauvegarde, les rangées
 * cachées (hors catalogue du moment) reprennent leur place : chacune se
 * raccroche à la rangée visible qui la précédait dans la liste complète — en
 * tête s'il n'y en avait pas. Rien de caché : `visible` tel quel.
 */
export function mergeHiddenHomeRows(
  full: readonly HomeRowDescriptor[],
  visible: HomeRowDescriptor[],
  catalog?: readonly HomeRowDescriptor[]
): HomeRowDescriptor[] {
  const hidden = full.filter((row) => !isHomeRowAvailable(row.key, catalog));
  if (hidden.length === 0) return visible;

  const anchorOf = new Map<string, string | null>();
  let lastVisible: string | null = null;
  for (const row of full) {
    if (isHomeRowAvailable(row.key, catalog)) lastVisible = row.key;
    else anchorOf.set(row.key, lastVisible);
  }

  const out: HomeRowDescriptor[] = hidden.filter((row) => anchorOf.get(row.key) === null);
  for (const row of visible) {
    out.push(row);
    for (const h of hidden) if (anchorOf.get(h.key) === row.key) out.push(h);
  }
  // Ancre retirée de la liste visible entre-temps : la cachée ferme la marche.
  const placed = new Set(out.map((row) => row.key));
  for (const h of hidden) if (!placed.has(h.key)) out.push(h);
  return out;
}

/**
 * La rangée reco de l'accueil qui porte la puce du filtre : la première, dans
 * l'ordre de l'accueil, que la page servie contient RÉELLEMENT — sous un
 * filtre strict, la première de la mise en page peut avoir été écartée
 * (rangée mince), et la puce disparaîtrait juste quand on en a besoin.
 */
export function firstServedRecoRowKey(
  rows: readonly HomeRowDescriptor[],
  servedRowKeys: readonly string[]
): string | null {
  const served = new Set(servedRowKeys.map((key) => `reco:${key}`));
  return rows.find((row) => row.enabled && served.has(row.key))?.key ?? null;
}

/** Déplace la rangée d'un cran (boutons monter/descendre + dépôt du glisser). */
export function moveRow(rows: HomeRowDescriptor[], from: number, to: number): HomeRowDescriptor[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
