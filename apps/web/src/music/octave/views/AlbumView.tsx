/**
 * Octave — un album : pochette, type, artistes, année, nombre de titres,
 * durée, qualité de la parution (la meilleure de ses pistes), puis ses titres,
 * disque par disque. La date complète et le label ferment la page, comme au
 * dos d'une pochette — la ligne de tête reste courte —, puis les notes de
 * l'album (sa description Jellyfin : mentions, licence, source), `AlbumNotes`.
 *
 * Un album d'AILLEURS que la bibliothèque a en entier ouvre la vue de la
 * bibliothèque (à sa place dans l'historique) ; en partie, ses titres présents
 * sont ceux de la bibliothèque, marqués, et la tête dit combien
 * (`useAlbumOwnership`).
 */

import { useMemo } from "react";
import { Library } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { KeepCollectionButton } from "../offline/KeepCollectionButton";
import { KeptSizeMeta } from "../offline/KeptSizeMeta";
import { TrackList, rowsOf } from "../components/TrackList";
import { ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useAlbumEntity } from "../data/useEntityQueries";
import { ownedCount } from "../library/ownedItems";
import { useAlbumOwnership } from "../library/useAlbumOwnership";
import { entityTarget, octavePaths } from "../octavePaths";
import { bestFormat, inDiscOrder, longReleaseDate, queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { FormatBadge } from "../shell/FormatBadge";
import { useRecordVisit } from "../search/recentVisits";
import { AlbumNotes } from "./AlbumNotes";
import { ImportedAlbumMeta } from "../releases/ImportedAlbumMeta";
import { ImportedCover } from "../releases/ImportedCover";
import { useImportedLibraryWatch } from "../releases/useImportedLibraryWatch";
import { importedLibraryState, useImportedLibraryAlbum } from "@tentacle-tv/api-client";

// Les règles de la page (qualité, ordre des disques, date longue) sont partagées avec le mobile.
export { bestFormat, longReleaseDate } from "@tentacle-tv/shared/octave";

export function AlbumView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const album = useAlbumEntity(id);
  const { ordered, discs } = useMemo(() => inDiscOrder(album.data?.tracks ?? []), [album.data]);
  const ownership = useAlbumOwnership(album.data, ordered, album.isPlaceholder);
  useRecordVisit("album", album.isPlaceholder || !ownership.settled || ownership.libraryAlbumId ? undefined : album.data);
  const tracks = ownership.tracks;
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const meta = useCountAndDuration(album.data?.trackCount ?? tracks.length, album.data?.durationMs ?? tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  const format = useMemo(() => bestFormat(tracks), [tracks]);
  const contextId = `album:${id}`;
  const library = importedLibraryState(album.data);
  const libraryAlbumId = useImportedLibraryAlbum(album.data);
  useImportedLibraryWatch(library.kind === "onTheWay", album.refetch);

  if (album.isPending) {
    return (
      <>
        <HeaderSkeleton />
        <div className="px-2 md:px-6">
          <RowsSkeleton showArtwork={false} />
        </div>
      </>
    );
  }
  if (album.isError || !album.data) return <ErrorState onRetry={() => void album.refetch()} message={t("album.notFound")} />;
  if (ownership.libraryAlbumId) return <Navigate replace to={octavePaths.album(ownership.libraryAlbumId)} />;
  // Une sortie importée entrée dans la bibliothèque Jellyfin : la page cède la place à la sienne, sans entrée d'historique.
  if (libraryAlbumId) return <Navigate replace to={octavePaths.album(libraryAlbumId)} />;
  const data = album.data;
  const elsewhere = data.jellyfinId === null;
  // L'aperçu de la carte : l'en-tête tout de suite, à sa place définitive ; les titres (et leur compte) à la réponse
  // — et, pour un album d'ailleurs, à ce que la bibliothèque en a (une rangée ne change pas sous les yeux).
  const preview = album.isPlaceholder || !ownership.settled;
  const owned = elsewhere ? ownedCount(tracks) : 0;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t(`album.kind.${data.kind}`)}
        title={data.title}
        artworkUrl={data.artworkUrl}
        art={data.imported ? <ImportedCover url={data.artworkUrl} title={data.title} /> : undefined}
        meta={
          <>
            {data.artists.map((artist, i) => {
              // Un artiste d'une sortie importée a sa vue chez l'extension (`own:ar:…`) : on y mène aussi.
              const target = artist.jellyfinId ?? (data.imported ? entityTarget({ jellyfinId: null, external: artist.external ?? null }) : null);
              return (
                <span key={`${artist.name}-${i}`} className="font-semibold text-content-primary">
                  {i > 0 && ", "}
                  {target ? (
                    <Link to={octavePaths.artist(target)} className="hover:underline">
                      {artist.name}
                    </Link>
                  ) : (
                    artist.name
                  )}
                </span>
              );
            })}
            {(data.releaseDate ?? data.year) && (
              <>
                <Dot />
                <span>{data.year ?? data.releaseDate?.slice(0, 4)}</span>
              </>
            )}
            {!preview && (
              <>
                <Dot />
                <span>{meta}</span>
              </>
            )}
            {format && <FormatBadge format={format} />}
            {!preview && owned > 0 && (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1 text-content-secondary">
                  <Library className="h-3.5 w-3.5 text-status-success-fg" aria-hidden />
                  {t("availability.albumCoverage", { count: owned, total: tracks.length })}
                </span>
              </>
            )}
            {!preview && <KeptSizeMeta kind="album" collectionKey={data.key} tracks={tracks} />}
            {data.imported && <ImportedAlbumMeta sourceUrl={data.sourceUrl ?? null} />}
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
        extra={preview ? undefined : <KeepCollectionButton kind="album" collectionKey={data.key} title={data.title} subtitle={data.artists.map((a) => a.name).join(", ") || null} tracks={tracks} />}
      />
      <div className="px-2 md:px-6">
        {preview ? <RowsSkeleton rows={Math.min(12, data.trackCount ?? 8)} showArtwork={false} /> : <TrackList
          rows={rows}
          contextId={contextId}
          useTrackNumbers
          markLibrary={elsewhere}
          showHeader
          label={data.title}
          sectionBefore={discs.length > 1 ? (row, index) => (index === 0 || rows[index - 1]?.track.discNumber !== row.track.discNumber ? t("album.disc", { number: row.track.discNumber ?? 1 }) : null) : undefined}
        />}
        {!preview && <AlbumFooter releaseDate={data.releaseDate ?? null} label={data.label ?? null} />}
        {!preview && <AlbumNotes album={data} />}
      </div>
    </div>
  );
}

/** Le dos de la pochette : la date de sortie complète, puis le label. */
function AlbumFooter({ releaseDate, label }: { releaseDate: string | null; label: string | null }) {
  const { t, i18n } = useTranslation("music");
  const date = longReleaseDate(releaseDate, i18n.language);
  if (!date && !label) return null;
  return (
    <footer className="mt-6 flex flex-col gap-0.5 px-2 text-xs text-content-tertiary">
      {date && <p>{t("views.released", { date })}</p>}
      {label && <p>℗ {label}</p>}
    </footer>
  );
}
