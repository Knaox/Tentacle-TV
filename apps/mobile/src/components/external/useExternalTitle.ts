import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useIsWatchlistPending, useRequestTitle, useTitleState, useWatchlistByTmdb, type RatingIdentity } from "@tentacle-tv/api-client";
import { titleKey, titleProvider, type TitleMediaType, type TitleProvider, type TitleState } from "@tentacle-tv/shared";
import { useActivePlugins } from "@/hooks/useActivePlugins";

/** L'identité TMDB d'une carte hors bibliothèque. */
export interface ExternalTitle {
  mediaType: TitleMediaType;
  tmdbId: number;
}

/** L'extension qui sait dire et faire quelque chose d'un titre absent (Vigie), et sa langue. */
export function useTitleProvider(): { provider: TitleProvider | null; lang: string } {
  const { i18n } = useTranslation();
  const { data: plugins } = useActivePlugins();
  const provider = useMemo(() => titleProvider(plugins ?? []), [plugins]);
  return { provider, lang: (i18n.language || "fr").slice(0, 2) };
}

/** Où en est le titre d'une carte (sa pastille : « Demandé »…) — les cartes d'une rangée partent ensemble. */
export function useExternalTitleState(title: ExternalTitle | null): TitleState | null {
  const { provider, lang } = useTitleProvider();
  return useTitleState(provider, title ? titleKey(title.mediaType, title.tmdbId) : null, lang);
}

export interface ExternalTitleActions {
  state: TitleState | null;
  requesting: boolean;
  request: () => void;
  /** La phrase de l'extension après une demande — sur place, sans toast au téléphone. */
  outcome: { ok: boolean; message: string } | null;
  pending: boolean;
  toggleWatchlist: () => void;
  ratingIdentity: RatingIdentity;
}

/**
 * Les gestes d'une carte hors bibliothèque au téléphone — la même logique que
 * le survol du web (`externalCardOverlay.ts`) : « Demander » sur place (un
 * film) ou dans la page de l'extension (les saisons d'une série), « Ma liste
 * à l'arrivée », et la note par le tmdb. Ne monter qu'à l'ouverture de la
 * feuille : rien de tout cela n'a à vivre sur une rangée au repos.
 */
export function useExternalTitleActions(
  title: ExternalTitle,
  /**
   * Ouvre une page de l'extension — celle de l'appelant quand il en sait plus
   * (depuis la recherche, une MODALE qu'il faut refermer d'abord) ; sinon, on
   * empile la page.
   */
  openHref?: (href: string) => void,
  /** La feuille se referme avant de quitter l'écran. */
  onLeave?: () => void,
): ExternalTitleActions {
  const { t } = useTranslation("cards");
  const router = useRouter();
  const { provider, lang } = useTitleProvider();
  const key = titleKey(title.mediaType, title.tmdbId);
  const state = useTitleState(provider, key, lang);
  const requestTitle = useRequestTitle(provider, lang);
  const pending = useIsWatchlistPending(key);
  const watchlist = useWatchlistByTmdb();
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  // La page de l'extension, par sa route (`/discover?request=tv:1399`) : chemin et requête séparés.
  const openPlugin = useCallback((href: string) => {
    onLeave?.();
    if (openHref) {
      openHref(href);
      return;
    }
    if (!provider) return;
    const at = href.indexOf("?");
    const path = at < 0 ? href : href.slice(0, at);
    const query = at < 0 ? undefined : href.slice(at);
    router.push({ pathname: "/plugin/[pluginId]", params: { pluginId: provider.pluginId, path, ...(query ? { query } : {}) } });
  }, [provider, router, onLeave, openHref]);

  const request = () => {
    const offer = state?.request;
    if (!offer || requestTitle.isPending) return;
    if (offer.mode === "open" && offer.href) {
      openPlugin(offer.href);
      return;
    }
    requestTitle.mutate(key, {
      onSuccess: (res) => {
        if (res.kind === "open") openPlugin(res.href);
        else setOutcome({ ok: res.ok, message: res.message ?? t(res.ok ? "requestSent" : "requestFailed") });
      },
      onError: () => setOutcome({ ok: false, message: t("requestFailed") }),
    });
  };

  const toggleWatchlist = () => {
    if (pending) watchlist.remove.mutate(title);
    else watchlist.add.mutate(title);
  };

  return {
    state,
    requesting: requestTitle.isPending,
    request,
    outcome,
    pending,
    toggleWatchlist,
    ratingIdentity: { mediaType: title.mediaType === "tv" ? "series" : "movie", tmdbId: title.tmdbId },
  };
}
