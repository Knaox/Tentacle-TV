import { useCallback, useMemo, useState } from "react";
import { Keyboard } from "react-native";
import type { ExternalKind } from "@tentacle-tv/shared";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { completionFor } from "./searchSuggestionModel";
import { useSearchSuggestions, type SearchSuggestions } from "./useSearchSuggestions";

/** Le moteur répond en millisecondes : on n'attend que la fin de la rafale. */
const SUGGEST_DEBOUNCE_MS = 110;
/** Le panneau s'ouvre à deux lettres, comme le filtre de la page. */
const MIN_CHARS = 2;

export interface SearchAssist {
  value: string;
  onChange: (value: string) => void;
  focused: boolean;
  /** Le panneau des suggestions prend la place de la page : champ actif, deux lettres. */
  open: boolean;
  /** La saisie une fois la rafale passée — ce que le moteur a reçu. */
  settled: string;
  /** La suite du meilleur titre, à afficher en gris après la saisie. */
  completion: string | null;
  suggestions: SearchSuggestions;
  onFocus: () => void;
  onBlur: () => void;
  /** ⇥ tactile : la suite grise rejoint la saisie. */
  accept: () => void;
  /** Reprendre une requête proposée : elle remplace la saisie et la page filtrée revient. */
  pick: (query: string) => void;
}

/**
 * L'assistance d'une barre de recherche LOCALE (bibliothèque, Ma liste, Mes
 * favoris) : pendant la frappe, le moteur du serveur propose — requêtes
 * complètes, meilleurs résultats, complétion en ligne — et les extensions qui
 * savent chercher (Vigie) disent ce qui n'est pas encore sur le serveur.
 *
 * Partagée entre le champ et l'écran : l'écran montre le panneau À LA PLACE de
 * sa grille tant que `open` — un calque par-dessus sortirait des limites de
 * son parent, où Android ne livre plus les touchers.
 */
export function useSearchAssist(
  value: string,
  onChange: (value: string) => void,
  { kind = null, external = true }: { kind?: ExternalKind | null; external?: boolean } = {},
): SearchAssist {
  const [focused, setFocused] = useState(false);
  const settled = useDebouncedValue(value, SUGGEST_DEBOUNCE_MS);
  const open = focused && value.trim().length >= MIN_CHARS;
  const found = useSearchSuggestions(settled, { kind, enabled: open, people: false });
  const suggestions = useMemo(
    () => (external ? found : { ...found, external: [] }),
    [found, external],
  );
  const completion = open ? completionFor(value, suggestions) : null;

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const accept = useCallback(() => {
    if (completion !== null) onChange(value + completion);
  }, [completion, onChange, value]);
  const pick = useCallback((query: string) => {
    onChange(query);
    Keyboard.dismiss();
  }, [onChange]);

  return { value, onChange, focused, open, settled, completion, suggestions, onFocus, onBlur, accept, pick };
}
