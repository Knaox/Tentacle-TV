/**
 * La sélection des bibliothèques d'un profil de la famille, en cours de
 * réglage (dialogue « Bibliothèques », serveur 1.30.0). Module pur
 * (`familyLibrariesModel.test.ts`). `null` : toutes les bibliothèques du
 * plafond, celles qui viendront comprises ; une liste : celles-là seulement.
 * Le serveur revérifie tout (au moins une, toutes dans `available`).
 */

export type LibrariesDraft = string[] | null;

/** Le brouillon de départ : la liste du serveur, réduite à ce que le profil peut encore voir. */
export function initialDraft(allowed: string[] | null, available: readonly { id: string }[]): LibrariesDraft {
  if (allowed === null) return null;
  const ids = new Set(available.map((library) => library.id));
  return allowed.filter((id) => ids.has(id));
}

/** « Toutes les bibliothèques » : coché → null ; décoché → chacune cochée, à décocher ensuite. */
export function toggleAll(draft: LibrariesDraft, available: readonly { id: string }[]): LibrariesDraft {
  return draft === null ? available.map((library) => library.id) : null;
}

/** Une bibliothèque cochée ou décochée (sans effet sous « Toutes »). */
export function toggleLibrary(draft: LibrariesDraft, id: string): LibrariesDraft {
  if (draft === null) return null;
  return draft.includes(id) ? draft.filter((entry) => entry !== id) : [...draft, id];
}

export function isChecked(draft: LibrariesDraft, id: string): boolean {
  return draft === null || draft.includes(id);
}

function sameDraft(a: LibrariesDraft, b: LibrariesDraft): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Ce qu'« Enregistrer » enverrait, ou pourquoi il ne le peut pas. */
export function draftVerdict(draft: LibrariesDraft, initial: LibrariesDraft): "unchanged" | "empty" | "ready" {
  if (sameDraft(draft, initial)) return "unchanged";
  return draft !== null && draft.length === 0 ? "empty" : "ready";
}
