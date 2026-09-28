import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { useTitleState } from "@tentacle-tv/api-client";
import { titleKey, titleProvider, type TitleKey, type TitleMediaType, type TitleProvider, type TitleState } from "@tentacle-tv/shared";

/**
 * L'extension qui sait dire et faire quelque chose d'un titre hors
 * bibliothèque (champ `titles` du manifeste — Vigie), et la langue dans
 * laquelle elle doit répondre. `null` : aucune extension, aucun geste.
 */
export function useTitleProvider(): { provider: TitleProvider | null; lang: string } {
  const { i18n } = useTranslation();
  const plugins = useActivePluginsMeta();
  const provider = useMemo(() => titleProvider(plugins), [plugins]);
  return { provider, lang: (i18n.language || "fr").slice(0, 2) };
}

/** L'identité TMDB d'une carte hors bibliothèque — `null` quand le plugin ne l'a pas donnée. */
export interface ExternalTitle {
  mediaType: TitleMediaType;
  tmdbId: number;
}

export function externalTitleKey(title: ExternalTitle | null): TitleKey | null {
  return title ? titleKey(title.mediaType, title.tmdbId) : null;
}

/**
 * Où en est le titre d'une carte, selon l'extension — lu AU REPOS (la
 * pastille : « Demandé »…) et au survol (l'offre en tête du plateau). Les cartes
 * montées ensemble partent dans une seule requête (`useTitleState`).
 */
export function useExternalTitleState(title: ExternalTitle | null): TitleState | null {
  const { provider, lang } = useTitleProvider();
  return useTitleState(provider, externalTitleKey(title), lang);
}
