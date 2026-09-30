import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * L'état VISUEL du focus d'un élément de la refonte — pas sa logique.
 *
 * Une vue de `redesign/` ne décide jamais où va le focus (ni guide, ni
 * `nextFocus*`, ni Retour, ni restauration) : elle dit seulement de quoi elle a
 * l'air quand elle le porte. Ce module lui donne cet état.
 *
 * Deux sources :
 * - le focus NATIF (`onFocus` / `onBlur` du Pressable) — l'app, et le banc
 *   piloté à la télécommande ;
 * - le focus FIGÉ du banc : une clé posée par `FocusPreviewProvider`. Tant
 *   qu'elle est posée, seul l'élément qui porte cette clé se dessine focalisé,
 *   et le focus natif est ignoré — sinon deux éléments auraient l'air
 *   focalisés à la fois (tvOS en focalise toujours un).
 *
 * Hors banc, aucun fournisseur : la vue suit le focus natif, rien d'autre.
 */

interface FocusPreviewValue {
  /** La clé de l'élément à dessiner focalisé ; `null` = focus natif. */
  forcedKey: string | null;
}

const FocusPreviewContext = createContext<FocusPreviewValue | null>(null);

export function FocusPreviewProvider({ forcedKey, children }: { forcedKey: string | null; children: ReactNode }) {
  const value = useMemo(() => ({ forcedKey }), [forcedKey]);
  return <FocusPreviewContext.Provider value={value}>{children}</FocusPreviewContext.Provider>;
}

export interface FocusVisual {
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * L'état focalisé d'un élément, et les deux gestionnaires à poser sur son
 * Pressable. `focusKey` est la clé que le banc peut figer : unique dans la
 * scène, stable d'un rendu à l'autre (ex. `row:continue:3`).
 */
export function useFocusVisual(focusKey?: string): FocusVisual {
  const preview = useContext(FocusPreviewContext);
  const [native, setNative] = useState(false);
  const onFocus = useCallback(() => setNative(true), []);
  const onBlur = useCallback(() => setNative(false), []);
  const forced = preview?.forcedKey ?? null;
  const focused = forced !== null ? focusKey !== undefined && forced === focusKey : native;
  return { focused, onFocus, onBlur };
}

/** Vrai quand le banc fige le focus : une vue peut alors taire ce qui dépend
 *  d'un focus natif réel (ex. une rangée qui recule parce qu'une voisine a le
 *  focus ne doit pas attendre un `onFocus` qui ne viendra pas). */
export function useIsFocusForced(): boolean {
  return (useContext(FocusPreviewContext)?.forcedKey ?? null) !== null;
}
