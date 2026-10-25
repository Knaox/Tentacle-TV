/**
 * Octave — la recherche AVANT la frappe : « Déjà écouté » (ce qu'on a écouté
 * après ses recherches, `searchHomeModel.ts`), puis les recherches récentes
 * (relancer, retirer). Dans la PAGE, jamais en liste flottante : rien ne
 * recouvre ni ne floute quoi que ce soit, et c'est lisible avant même de
 * toucher la barre.
 *
 * Rien n'apparaît ni ne se réordonne sous les yeux : les écoutes et
 * l'historique de la bibliothèque sont lus UNE fois, à l'arrivée (l'historique
 * seulement s'il est déjà en cache ; sinon il est demandé pour la prochaine
 * fois). Seul un geste (retirer une recherche) change la page.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { musicApi, musicKeys, useMusicCapability } from "@tentacle-tv/api-client";
import type { MusicHomeResponse } from "@tentacle-tv/shared/music";
import { ListenedCard } from "./ListenedCard";
import { buildListenedCards } from "./searchHomeModel";
import { readSearchListens } from "./searchListens";

/** L'instantané d'arrivée : ce que l'appareil a noté, et l'historique déjà connu de la bibliothèque. */
function useListenedCards(recents: readonly string[]) {
  const qc = useQueryClient();
  const capable = useMusicCapability();
  const [snapshot] = useState(() => ({
    listens: readSearchListens(),
    history: qc.getQueryData<MusicHomeResponse>(musicKeys.home())?.recentlyPlayed ?? [],
  }));
  useEffect(() => {
    if (!capable || qc.getQueryData(musicKeys.home())) return;
    void qc.prefetchQuery({ queryKey: musicKeys.home(), queryFn: ({ signal }) => musicApi.home(signal), staleTime: 30_000 });
  }, [capable, qc]);
  return useMemo(() => buildListenedCards({ recents, listens: snapshot.listens, history: snapshot.history }), [recents, snapshot]);
}

interface SearchHomeProps {
  recents: readonly string[];
  onSearch: (text: string) => void;
  onForget: (text: string) => void;
}

export const SearchHome = memo(function SearchHome({ recents, onSearch, onForget }: SearchHomeProps) {
  const { t } = useTranslation("music");
  const cards = useListenedCards(recents);

  if (cards.length === 0 && recents.length === 0) {
    return (
      <div className="px-2 py-10">
        <h1 className="text-2xl font-bold text-content-primary">{t("search.emptyTitle")}</h1>
        <p className="mt-2 text-sm text-content-tertiary">{t("search.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">{t("search.title")}</h1>
      {cards.length > 0 && (
        <section aria-labelledby="octave-search-listened" className="flex flex-col gap-3">
          <div className="px-2">
            <h2 id="octave-search-listened" className="oc-heading text-xl text-content-primary">
              {t("search.listenedTitle")}
            </h2>
            <p className="mt-1 text-sm text-content-tertiary">{t("search.listenedHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <ListenedCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}
      {recents.length > 0 && (
        <section aria-labelledby="octave-search-recent" className="flex max-w-2xl flex-col gap-2">
          <h2 id="octave-search-recent" className="oc-heading px-2 text-xl text-content-primary">
            {t("search.recentTitle")}
          </h2>
          <ul className="flex flex-col">
            {recents.map((query) => (
              <li key={query} className="group flex items-center gap-1 rounded-md transition-colors duration-150 hover:bg-octave-hover">
                <button
                  type="button"
                  onClick={() => onSearch(query)}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
                  <Clock className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
                  <span className="truncate">{query}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onForget(query)}
                  aria-label={t("search.forget", { query })}
                  className="mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
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
