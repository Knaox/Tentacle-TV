/**
 * Octave — une liste de titres jouable : cliquer une rangée lit la liste à
 * partir d'elle (la file prend le contexte : album, playlist, likés…) ;
 * cliquer le titre EN COURS de cette même liste le met en pause ou le reprend.
 * Le rappel reste STABLE : un changement de titre ne redessine que les deux
 * rangées concernées.
 */

import { Fragment, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useTrackActions } from "../actions/useTrackActions";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { useCurrentKey, useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { ALBUM_COLUMNS, TrackRow } from "./TrackRow";

interface TrackListProps {
  rows: readonly ListRow[];
  contextId: string;
  showArtwork?: boolean;
  showAlbum?: boolean;
  /** La liste mêle bibliothèque et ailleurs : marquer les titres de la bibliothèque. */
  markLibrary?: boolean;
  /** Le numéro de la piste d'album au lieu du rang. */
  useTrackNumbers?: boolean;
  /** Le libellé de la liste (lecteurs d'écran). */
  label: string;
  showHeader?: boolean;
  /**
   * Retirer des rangées de la playlist (leurs clés) : une entrée Jellyfin, ou une attente hors bibliothèque (sa
   * demande s'annule). Absent : la liste ne se modifie pas.
   */
  onRemoveRows?: (rowKeys: string[]) => void;
  /**
   * La file que lit un clic, quand la liste n'en montre qu'un DÉBUT (titres
   * phares repliés) : `rows` en est un préfixe, les rangs coïncident.
   */
  queueTracks?: readonly MusicTrack[];
  /** Un intertitre avant une rangée (« Disque 2 ») — la liste reste UNE seule file. */
  sectionBefore?: (row: ListRow, index: number) => string | null;
}

/** Un clic sur une rangée : le titre en cours de CETTE liste se met en pause ou reprend ; tout autre se lit. */
export function rowClickAction(clickedKey: string | undefined, currentKey: string | null, playingContext: string | null, contextId: string): "toggle" | "play" {
  return clickedKey !== undefined && clickedKey === currentKey && playingContext === contextId ? "toggle" : "play";
}

export function rowsOf(tracks: readonly MusicTrack[]): ListRow[] {
  return tracks.map((track) => ({ rowKey: track.key, track, pending: null, entryId: null }));
}

export const TrackList = memo(function TrackList({ rows, contextId, showArtwork = false, showAlbum = false, markLibrary = false, useTrackNumbers = false, label, showHeader = false, onRemoveRows, queueTracks, sectionBefore }: TrackListProps) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const actions = useTrackActions();
  const currentKey = useCurrentKey();
  const playingContext = usePlayerSelector((s) => s.queue.contextId);
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const tracks = useMemo(() => queueTracks ?? rows.map((r) => r.track), [queueTracks, rows]);
  // Lu au clic, jamais une dépendance du rappel (sinon chaque titre suivant redessinerait toute la liste).
  const live = useRef({ currentKey, playingContext });
  useEffect(() => {
    live.current = { currentKey, playingContext };
  }, [currentKey, playingContext]);
  const play = useCallback(
    (index: number) => {
      const { currentKey: key, playingContext: context } = live.current;
      if (rowClickAction(tracks[index]?.key, key, context, contextId) === "toggle") player.togglePlay();
      else player.playList(tracks, index, contextId);
    },
    [contextId, player, tracks],
  );
  const removeRow = useMemo(() => (onRemoveRows ? (rowKey: string) => onRemoveRows([rowKey]) : undefined), [onRemoveRows]);

  return (
    <div role="grid" aria-label={label} className="flex flex-col">
      {showHeader && (
        <div role="row" className={`mb-1 grid items-center gap-3 border-b border-line-subtle px-2 pb-2 text-xs font-medium uppercase tracking-wide text-content-quaternary ${showAlbum ? ALBUM_COLUMNS : "grid-cols-[2rem_minmax(0,1fr)_auto]"}`}>
          <span role="columnheader" className="text-center">{t("track.number")}</span>
          <span role="columnheader">{t("track.title")}</span>
          {showAlbum && <span role="columnheader" className="hidden lg:block">{t("track.album")}</span>}
          <span role="columnheader" className="pr-9 text-right">{t("track.duration")}</span>
        </div>
      )}
      {rows.map((row, index) => {
        const section = sectionBefore?.(row, index) ?? null;
        return (
        <Fragment key={row.rowKey}>
        {section && (
          <div role="row" className="px-2 pb-1 pt-4 text-sm font-semibold text-content-secondary">
            <span role="rowheader">{section}</span>
          </div>
        )}
        <TrackRow
          track={row.track}
          number={useTrackNumbers ? (row.track.trackNumber ?? index + 1) : index + 1}
          current={row.track.key === currentKey}
          playing={row.track.key === currentKey && wantsPlay}
          failed={row.pending?.failed ?? false}
          note={row.pending?.note ?? null}
          showArtwork={showArtwork}
          showAlbum={showAlbum}
          markLibrary={markLibrary}
          actions={actions}
          index={index}
          onPlayIndex={play}
          rowKey={row.rowKey}
          onRemoveRow={row.entryId !== null || row.pending ? removeRow : undefined}
        />
        </Fragment>
        );
      })}
    </div>
  );
});
