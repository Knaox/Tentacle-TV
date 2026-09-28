import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useIsWatchlistPending, useRequestTitle, useTitleState, useWatchlistByTmdb } from "@tentacle-tv/api-client";
import type { RatingIdentity } from "@tentacle-tv/api-client";
import type { TitleState } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { externalTitleKey, useTitleProvider, type ExternalTitle } from "./useTitleProvider";

export interface ExternalTitleActions {
  /** Ce que l'extension dit du titre, et le geste qu'elle offre. */
  state: TitleState | null;
  /** La demande est en route vers l'extension. */
  requesting: boolean;
  request: () => void;
  /** Le titre attend son arrivée pour entrer dans Ma liste. */
  pending: boolean;
  toggleWatchlist: () => void;
  /** Ce que notent les étoiles : le tmdb du titre. */
  ratingIdentity: RatingIdentity;
}

/**
 * Les gestes d'une carte hors bibliothèque — la logique UNIQUE du survol web
 * et de la feuille d'appui long du miroir (cf. `externalCardOverlay.ts`) :
 *
 *   • « Demander » : sur place quand l'extension le fait d'un geste (un
 *     film), sinon sa page, pour le choix qu'elle réclame (les saisons) ;
 *   • « Ma liste à l'arrivée » : mis de côté, le titre entre dans Ma liste
 *     dès qu'il arrive — tout de suite s'il est déjà là ;
 *   • la note, par le tmdb (les étoiles la posent elles-mêmes).
 *
 * À ne monter qu'au survol ou à l'ouverture d'une feuille : l'état de Ma
 * liste et la mutation n'ont rien à faire sur quatre-vingts cartes au repos.
 */
export function useExternalTitleActions(title: ExternalTitle): ExternalTitleActions {
  const { t } = useTranslation("cards");
  const toast = useToast();
  const navigate = useNavigate();
  const { provider, lang } = useTitleProvider();
  const key = externalTitleKey(title);
  const state = useTitleState(provider, key, lang);
  const requestTitle = useRequestTitle(provider, lang);
  const pending = useIsWatchlistPending(key);
  const watchlist = useWatchlistByTmdb();

  const request = () => {
    const offer = state?.request;
    if (!offer || !key || requestTitle.isPending) return;
    // Un choix à faire (les saisons d'une série) : c'est la page de l'extension qui le propose.
    if (offer.mode === "open" && offer.href) {
      navigate(offer.href);
      return;
    }
    requestTitle.mutate(key, {
      onSuccess: (outcome) => {
        if (outcome.kind === "open") navigate(outcome.href);
        else toast.show(outcome.ok ? "success" : "error", outcome.message ?? t(outcome.ok ? "requestSent" : "requestFailed"));
      },
      onError: () => toast.show("error", t("requestFailed")),
    });
  };

  const toggleWatchlist = () => {
    if (pending) {
      watchlist.remove.mutate(title);
      return;
    }
    watchlist.add.mutate(title, {
      onSuccess: (res) => toast.show("success", t(res.state === "listed" ? "watchlistAdded" : "watchlistOnArrivalAdded")),
      onError: () => toast.show("error", t("watchlistFailed")),
    });
  };

  return {
    state,
    requesting: requestTitle.isPending,
    request,
    pending,
    toggleWatchlist,
    ratingIdentity: { mediaType: title.mediaType === "tv" ? "series" : "movie", tmdbId: title.tmdbId },
  };
}
