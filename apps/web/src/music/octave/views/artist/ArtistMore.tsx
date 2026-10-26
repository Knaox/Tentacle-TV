/**
 * Octave — la seconde moitié de la page d'un artiste (mission 3), montée SOUS ce que la page montre déjà :
 *
 * - artiste de la bibliothèque : ce que l'extension connaît de lui et que la bibliothèque n'a pas (titres phares,
 *   parutions rangées comme au-dessus), avec les gestes habituels de chaque rangée et carte ;
 * - artiste d'ailleurs : les albums de la bibliothèque que la page ne montre pas encore.
 *
 * Chargée à l'APPROCHE (la section entre dans l'écran, à 600 px près) ; tant qu'on cherche, sa place est réservée
 * dessous — rien au-dessus ne bouge ; rien trouvé : elle s'efface. Jamais un doublon (`artistMatch.ts`).
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MusicAlbum, MusicArtist, MusicTrack } from "@tentacle-tv/shared/music";
import { AlbumCard, CardGrid, Shelf } from "../../components/Cards";
import { TrackList, rowsOf } from "../../components/TrackList";
import { RowsSkeleton } from "../../components/ViewStates";
import type { ShownAlbum } from "../../library/ownedItems";
import { useOwnedAlbums } from "../../library/useOwnedAlbums";
import { useOwnedTracks } from "../../library/useOwnedTracks";
import { albumsElsewhere, libraryAlbumsMissing, tracksElsewhere } from "./artistMatch";
import { useArtistCounterpart } from "./useArtistCounterpart";

type Groups = { group: string; albums: ShownAlbum[] }[];

interface ArtistMoreProps {
  artist: MusicArtist;
  /** Les parutions déjà montrées au-dessus (ce que la bibliothèque a, rangé). */
  shown: readonly ShownAlbum[];
  /** Le rangement de la page (`groupReleases` d'`ArtistView`) : la même règle au-dessus et dessous. */
  groupOf: (albums: readonly ShownAlbum[]) => Groups;
  contextId: string;
}

const TOP_MAX = 10;
const NO_TRACKS: MusicTrack[] = [];
const NO_ALBUMS: MusicAlbum[] = [];

/** Vrai dès que l'élément approche de l'écran (une fois pour toutes). */
function useNear(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (near || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

export const ArtistMore = memo(function ArtistMore({ artist, shown, groupOf, contextId }: ArtistMoreProps) {
  const { t } = useTranslation(["octaveShell", "music"]);
  const [sentinel, near] = useNear();
  const counterpart = useArtistCounterpart(artist, near);

  // Bibliothèque → ailleurs : seulement ce que la bibliothèque n'a pas.
  const outsideTop = useMemo(() => (counterpart.elsewhere?.topTracks ?? NO_TRACKS).slice(0, TOP_MAX), [counterpart.elsewhere]);
  const ownedTop = useOwnedTracks(outsideTop);
  const top = useMemo(() => tracksElsewhere(ownedTop.tracks), [ownedTop.tracks]);
  const ownedOutside = useOwnedAlbums(counterpart.elsewhere?.albums ?? NO_ALBUMS);
  // Ailleurs → bibliothèque : ses albums que la page ne montre pas.
  const albums = useMemo(
    () => (counterpart.library ? libraryAlbumsMissing(counterpart.library.albums, shown) : albumsElsewhere(ownedOutside)),
    [counterpart.library, shown, ownedOutside],
  );
  const groups = useMemo(() => groupOf(albums), [groupOf, albums]);
  const rows = useMemo(() => rowsOf(top), [top]);
  const fromLibrary = artist.jellyfinId !== null;
  const empty = top.length === 0 && groups.length === 0;

  return (
    <div ref={sentinel} className="flex flex-col gap-10" data-octave-artist-more={fromLibrary ? "elsewhere" : "library"}>
      {counterpart.pending && empty && <RowsSkeleton rows={5} />}
      {!empty && (
        <>
          <p className="oc-eyebrow px-2">{t(fromLibrary ? "artistMore.elsewhere" : "artistMore.library")}</p>
          {top.length > 0 && (
            <Shelf title={t("music:artist.top")}>
              <TrackList rows={rows} queueTracks={top} contextId={`${contextId}:more`} showArtwork label={t("music:artist.top")} />
            </Shelf>
          )}
          {groups.map(({ group, albums: list }) => (
            <Shelf key={group} title={t(`music:artist.${group}`)}>
              <CardGrid>
                {list.map(({ album, ownership }) => (
                  <AlbumCard key={album.key} album={album} ownership={ownership} />
                ))}
              </CardGrid>
            </Shelf>
          ))}
        </>
      )}
    </div>
  );
});
