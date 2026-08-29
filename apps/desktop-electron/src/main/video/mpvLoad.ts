/**
 * Essayer chaque libmpv candidate, retenir la première qui se CHARGE.
 *
 * L'existence d'un fichier ne dit pas qu'il s'ouvre : la chaîne vendorée a été
 * inchargeable un jour entier (libbz2.so.1.0, SONAME Debian-only — voir
 * `build-mpv-linux.sh`), et `existsSync` répondait oui pendant que `dlopen`
 * mourait. Ce module transforme cet échec silencieux en repli DIT : chaque
 * candidate écartée est rendue avec sa cause courte, et l'appelant décide du
 * bruit à en faire.
 *
 * Pur et sans dépendance : le chargeur (`koffi.load` en vrai) est injecté, ce
 * qui rend le comportement testable sans bibliothèque native.
 */

/** Une candidate refusée, et la première ligne de ce que `dlopen` en a dit. */
export interface CandidateFailure {
  path: string;
  cause: string;
}

/** La bibliothèque retenue, son chemin, et les candidates écartées avant elle. */
export interface LoadedLib<L> {
  lib: L;
  path: string;
  skipped: readonly CandidateFailure[];
}

/** La première ligne d'une erreur — celle qui porte le nom du `.so` manquant. */
function shortCause(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.split("\n")[0]?.trim() ?? "cause inconnue";
}

/**
 * Charge la première candidate qui s'ouvre, dans l'ordre donné.
 *
 * Lève si TOUTES échouent, avec un message qui liste chaque chemin et sa
 * cause : c'est ce message qui traverse l'IPC jusqu'au lecteur, il doit
 * suffire à comprendre sans venir lire le journal.
 */
export function loadFirstAvailable<L>(
  candidates: readonly string[],
  load: (path: string) => L,
): LoadedLib<L> {
  if (candidates.length === 0) throw new Error("aucune libmpv candidate");
  const skipped: CandidateFailure[] = [];
  for (const path of candidates) {
    try {
      return { lib: load(path), path, skipped };
    } catch (e) {
      skipped.push({ path, cause: shortCause(e) });
    }
  }
  const detail = skipped.map((e) => `  ${e.path} — ${e.cause}`).join("\n");
  throw new Error(`aucune libmpv chargeable :\n${detail}`);
}
