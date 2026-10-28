/**
 * Octave (web, bureau) — un lien SHAZAM collé dans la recherche : le coller VALIDE (le geste est le collage), la
 * recherche attend que le titre soit nommé (`useSharedTrackSearch`, la règle commune avec le mobile), puis
 * l'adresse prend le titre à la place du lien (`replace` : le retour arrière ne repasse pas par le lien). Les
 * recherches récentes gardent le titre, jamais le lien.
 */

import { useEffect } from "react";
import { useSharedTrackSearch, type SharedTrackSearch } from "@tentacle-tv/api-client";
import { findShazamLink } from "@tentacle-tv/shared/music";

/** Ce que la recherche doit faire, PUR : valider un lien collé, ou remplacer le lien par le titre nommé. */
export function sharedLinkSearchSteps(input: { query: string; draft: string; resolved: string | null }): { paste: string | null; replaceWith: string | null } {
  const paste = input.draft !== input.query && findShazamLink(input.draft) ? input.draft.trim() : null;
  return { paste, replaceWith: input.resolved && input.resolved !== input.query ? input.resolved : null };
}

export function useSharedLinkSearch(input: {
  query: string;
  draft: string;
  /** Pose `?q=` (le champ suit). */
  go: (text: string, replace: boolean) => void;
  remember: (text: string) => void;
}): SharedTrackSearch {
  const { query, draft, go, remember } = input;
  const shared = useSharedTrackSearch(query);
  const { paste, replaceWith } = sharedLinkSearchSteps({ query, draft, resolved: shared.isLink ? (shared.resolved?.query ?? null) : null });
  useEffect(() => {
    if (paste) go(paste, false);
  }, [go, paste]);
  useEffect(() => {
    if (!replaceWith) return;
    remember(replaceWith);
    go(replaceWith, true);
  }, [go, remember, replaceWith]);
  return shared;
}
