/**
 * Octave — l'HISTORIQUE de la recherche avant la frappe (`useOctaveSearchHistory`) : les recherches récentes
 * (relancer, retirer) et les titres récemment recherchés (pochette ; un clic les relit, ✕ les retire), le même que
 * celui du mobile quand le serveur le garde. « Tout effacer » demande une confirmation sur place (deuxième clic dans
 * les quatre secondes), jamais une fenêtre.
 */

import { memo, useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OctaveSearchHistory } from "@tentacle-tv/api-client";
import { recentTracksOf } from "@tentacle-tv/shared/octave";
import { Artwork } from "../components/Artwork";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";
const CONFIRM_MS = 4_000;
const FORGET = `mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary ${FOCUS}`;

function ClearAllButton({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation("music");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? (setArmed(false), onClear()) : setArmed(true))}
      title={armed ? t("searchHistory.clearTitle") : undefined}
      className={`min-h-9 cursor-pointer rounded-full px-3 text-sm transition-colors duration-150 ${armed ? "bg-octave-hover font-semibold text-content-primary" : "text-content-tertiary hover:text-content-primary"} ${FOCUS}`}
    >
      {armed ? t("searchHistory.clearConfirm") : t("searchHistory.clearAll")}
    </button>
  );
}

interface Props {
  recents: readonly string[];
  history: OctaveSearchHistory;
  onSearch: (text: string) => void;
}

export const RecentSearchHistory = memo(function RecentSearchHistory({ recents, history, onSearch }: Props) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const tracks = recentTracksOf(history.history);
  if (recents.length === 0 && tracks.length === 0) return null;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {recents.length > 0 && (
        <section aria-labelledby="octave-search-recent" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-2">
            <h2 id="octave-search-recent" className="oc-heading text-xl text-content-primary">
              {t("search.recentTitle")}
            </h2>
            <ClearAllButton onClear={history.clearAll} />
          </div>
          <ul className="flex flex-col">
            {recents.map((query) => (
              <li key={query} className="flex items-center gap-1 rounded-md transition-colors duration-150 hover:bg-octave-hover">
                <button
                  type="button"
                  onClick={() => onSearch(query)}
                  className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm text-content-primary ${FOCUS}`}
                >
                  <Clock className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
                  <span className="truncate">{query}</span>
                </button>
                <button type="button" onClick={() => history.forgetQuery(query)} aria-label={t("search.forget", { query })} className={FORGET}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tracks.length > 0 && (
        <section aria-labelledby="octave-search-recent-tracks" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-2">
            <h2 id="octave-search-recent-tracks" className="oc-heading text-xl text-content-primary">
              {t("searchHistory.tracksTitle")}
            </h2>
            {recents.length === 0 && <ClearAllButton onClear={history.clearAll} />}
          </div>
          <ul className="flex flex-col">
            {tracks.map(({ track }) => (
              <li key={track.key} className="flex items-center gap-1 rounded-md transition-colors duration-150 hover:bg-octave-hover">
                <button
                  type="button"
                  onClick={() => player.playList([track], 0, null)}
                  aria-label={t("track.play", { title: track.title })}
                  className={`flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-left ${FOCUS}`}
                >
                  <Artwork url={track.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded-[var(--oc-radius-art-sm)] shadow-[var(--oc-shadow-art)]" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-content-primary">{track.title}</span>
                    <span className="truncate text-[13px] text-content-tertiary">{track.artists.map((a) => a.name).join(", ")}</span>
                  </span>
                </button>
                <button type="button" onClick={() => history.forgetTrack(track.key)} aria-label={t("searchHistory.forgetTrack", { title: track.title })} className={FORGET}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});
