/**
 * Octave — les SUGGESTIONS de la barre, pendant la frappe. Règle pure : trois
 * sources sans le moindre coût réseau vers l'extérieur — les recherches
 * récentes de l'appareil, la bibliothèque (index local du serveur), et les
 * suggestions LOCALES de l'extension (`music.suggest`, ses index) — en UNE
 * liste, dans l'ordre que parcourent les flèches. Une suggestion n'est qu'un
 * TEXTE à chercher : la choisir lance la recherche complète, jamais une lecture.
 */

import { searchTokens } from "@tentacle-tv/shared";

export type SuggestionKind = "recent" | "artist" | "track" | "album";

export interface OctaveSuggestion {
  /** Stable d'une frappe à l'autre (clé React, `aria-activedescendant`). */
  id: string;
  kind: SuggestionKind;
  /** Ce qui part dans la recherche quand on la choisit. */
  text: string;
  title: string;
  subtitle: string | null;
}

/** Une suggestion venue d'une source (bibliothèque, extension), avant fusion. */
export interface SuggestionInput {
  kind: Exclude<SuggestionKind, "recent">;
  title: string;
  subtitle: string | null;
  /** Le texte cherché (par défaut : le titre, suivi de l'artiste pour un titre ou un album). */
  text?: string;
}

export interface SuggestionSources {
  draft: string;
  recents: readonly string[];
  library: readonly SuggestionInput[];
  extension: readonly SuggestionInput[];
}

export const SUGGESTIONS_MAX = 8;
const PER_KIND: Record<SuggestionKind, number> = { recent: 3, artist: 3, track: 4, album: 2 };
const KIND_ORDER: SuggestionKind[] = ["recent", "artist", "track", "album"];

/** Chaque mot tapé commence un mot de la suggestion (le dernier peut être inachevé). */
export function matchesDraft(draftWords: readonly string[], text: string): boolean {
  if (draftWords.length === 0) return true;
  const words = searchTokens(text);
  return draftWords.every((w) => words.some((x) => x.startsWith(w)));
}

function textOf(s: SuggestionInput): string {
  if (s.text) return s.text;
  return s.kind === "artist" || !s.subtitle ? s.title : `${s.title} ${s.subtitle}`;
}

export function buildSuggestions({ draft, recents, library, extension }: SuggestionSources): OctaveSuggestion[] {
  const words = searchTokens(draft);
  // Barre vide : AUCUNE liste. Les récentes et le « déjà écouté » sont DANS la page (`SearchHome`) — une
  // liste flottante ouverte dès l'arrivée recouvrait le titre de la page et le floutait (O5, 25/10).
  if (words.length === 0) return [];
  const seen = new Set<string>();
  const byKind = new Map<SuggestionKind, OctaveSuggestion[]>(KIND_ORDER.map((k) => [k, []]));
  const add = (kind: SuggestionKind, title: string, subtitle: string | null, text: string) => {
    const folded = searchTokens(text).join(" ");
    const bucket = byKind.get(kind);
    if (!folded || seen.has(folded) || !bucket || bucket.length >= PER_KIND[kind]) return;
    seen.add(folded);
    bucket.push({ id: `${kind}:${folded}`, kind, text, title, subtitle });
  };
  for (const r of recents) if (matchesDraft(words, r)) add("recent", r, null, r);
  // La bibliothèque d'abord : ce qu'on a déjà, puis ce que l'extension propose.
  for (const s of [...library, ...extension]) {
    if (matchesDraft(words, `${s.title} ${s.subtitle ?? ""}`)) add(s.kind, s.title, s.subtitle, textOf(s));
  }
  return KIND_ORDER.flatMap((k) => byKind.get(k) ?? []).slice(0, SUGGESTIONS_MAX);
}

/** La suggestion suivante (flèches) : de la saisie (-1) au dernier, puis retour à la saisie. */
export function moveActive(active: number, count: number, step: 1 | -1): number {
  if (count === 0) return -1;
  const next = active + step;
  if (next >= count) return -1;
  if (next < -1) return count - 1;
  return next;
}
