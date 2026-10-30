/**
 * Octave — la recherche AVANT la frappe : les ambiances (emplacement), les
 * albums consultés récemment et les artistes récents (`recentShelves.ts`),
 * « Déjà écouté » (ce qu'on a écouté après ses recherches,
 * `searchHomeModel.ts`), et l'historique — recherches récentes, titres récemment recherchés
 * (`RecentSearchHistory`, celui du compte quand le serveur le garde). Dans la PAGE, jamais en liste flottante : rien ne
 * recouvre ni ne floute quoi que ce soit, et c'est lisible avant même de
 * toucher la barre.
 *
 * Rien n'apparaît ni ne se réordonne sous les yeux : les écoutes et
 * l'historique de la bibliothèque sont lus UNE fois, à l'arrivée (l'historique
 * seulement s'il est déjà en cache ; sinon il est demandé pour la prochaine
 * fois). Seul un geste (retirer une recherche, un titre, tout effacer) change la page.
 */

import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchHomeSnapshot, type OctaveSearchHistory } from "@tentacle-tv/api-client";
import type { OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import { ListenedCard } from "./ListenedCard";
import { octaveOwner } from "../cache/octaveOwner";
import { SearchHomeMoodsSlot } from "../home/ambianceSlots";
import { AlbumCard, ArtistCard, Shelf } from "../components/Cards";
import { CardRow } from "../components/CardRow";
import { RecentSearchHistory } from "./RecentSearchHistory";

const store: OctaveDeviceStore | null = typeof localStorage === "undefined" ? null : localStorage;

/** L'instantané d'arrivée (api-client `useSearchHomeSnapshot`, le même que le mobile) : stockage et identité du web. */
function useArrivalSnapshot(recents: readonly string[]) {
  const [owner] = useState(octaveOwner);
  return useSearchHomeSnapshot(recents, store, owner);
}

interface SearchHomeProps {
  recents: readonly string[];
  history: OctaveSearchHistory;
  onSearch: (text: string) => void;
}

export const SearchHome = memo(function SearchHome({ recents, history, onSearch }: SearchHomeProps) {
  const { t } = useTranslation("music");
  const { cards, shelves } = useArrivalSnapshot(recents);
  const noHistory = recents.length === 0 && history.history.tracks.length === 0;

  if (cards.length === 0 && noHistory && shelves.albums.length === 0 && shelves.artists.length === 0) {
    return (
      <div className="flex flex-col gap-10">
      <SearchHomeMoodsSlot onSearch={onSearch} />
      <div className="px-2 py-10">
        <h1 className="text-2xl font-bold text-content-primary">{t("search.emptyTitle")}</h1>
        <p className="mt-2 text-sm text-content-tertiary">{t("search.emptyHint")}</p>
      </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">{t("search.title")}</h1>
      <SearchHomeMoodsSlot onSearch={onSearch} />
      <RecentSearchHistory recents={recents} history={history} onSearch={onSearch} />
      {shelves.albums.length > 0 && (
        <Shelf title={t("octaveHome.viewedAlbums")}>
          <CardRow items={shelves.albums} render={(album) => <AlbumCard key={album.key} album={album} />} />
        </Shelf>
      )}
      {shelves.artists.length > 0 && (
        <Shelf title={t("octaveHome.viewedArtists")}>
          <CardRow items={shelves.artists} render={(artist) => <ArtistCard key={artist.key} artist={artist} />} />
        </Shelf>
      )}
      {cards.length > 0 && (
        <section aria-labelledby="octave-search-listened" className="flex flex-col gap-3">
          <div className="px-2">
            <h2 id="octave-search-listened" className="oc-heading text-xl text-content-primary">
              {t("search.listenedTitle")}
            </h2>
            <p className="mt-1 text-sm text-content-tertiary">{t("search.listenedHint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <ListenedCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
