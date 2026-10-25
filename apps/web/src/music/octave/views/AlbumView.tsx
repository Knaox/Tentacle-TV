/**
 * Octave — un album : pochette, type, artistes, année, nombre de titres,
 * durée, qualité de la parution (la meilleure de ses pistes), puis ses titres,
 * disque par disque. La date complète et le label ferment la page, comme au
 * dos d'une pochette — la ligne de tête reste courte.
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
import type { MusicAudioFormat, MusicTrack } from "@tentacle-tv/shared/music";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList, rowsOf } from "../components/TrackList";
import { ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useAlbumEntity } from "../data/useEntityQueries";
import { ownedCount } from "../library/ownedItems";
import { useAlbumOwnership } from "../library/useAlbumOwnership";
import { octavePaths } from "../octavePaths";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { FormatBadge } from "../shell/FormatBadge";

/** La meilleure qualité de l'album (sans perte d'abord, puis profondeur et fréquence). */
export function bestFormat(tracks: readonly MusicTrack[]): MusicAudioFormat | null {
  let best: MusicAudioFormat | null = null;
  const score = (f: MusicAudioFormat) => (f.lossless ? 1e9 : 0) + (f.bitDepth ?? 0) * 1e6 + (f.sampleRate ?? 0) + (f.bitrate ?? 0) / 1e3;
  for (const t of tracks) if (t.format && (!best || score(t.format) > score(best))) best = t.format;
  return best;
}

/** Les titres dans l'ordre disque puis piste, et les disques présents. */
function inDiscOrder(tracks: readonly MusicTrack[]): { ordered: MusicTrack[]; discs: number[] } {
  const ordered = [...tracks].sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  return { ordered, discs: [...new Set(ordered.map((x) => x.discNumber ?? 1))] };
}

export function AlbumView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const album = useAlbumEntity(id);
  const { ordered, discs } = useMemo(() => inDiscOrder(album.data?.tracks ?? []), [album.data]);
  const ownership = useAlbumOwnership(album.data, ordered, album.isPlaceholder);
  const tracks = ownership.tracks;
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const meta = useCountAndDuration(album.data?.trackCount ?? tracks.length, album.data?.durationMs ?? tracks.reduce((s, x) => s + (x.durationMs ?? 0), 0));
  const format = useMemo(() => bestFormat(tracks), [tracks]);
  const contextId = `album:${id}`;

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
        meta={
          <>
            {data.artists.map((artist, i) => {
              const target = artist.jellyfinId;
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
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
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
      </div>
    </div>
  );
}

/** Une date `AAAA-MM-JJ` en toutes lettres ; une date partielle (`AAAA`, `AAAA-MM`) n'en est pas une. */
export function longReleaseDate(date: string | null, locale: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(parsed);
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
