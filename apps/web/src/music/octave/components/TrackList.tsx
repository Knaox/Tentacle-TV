/**
 * Octave — une liste de titres jouable : cliquer une rangée lit la liste à
 * partir d'elle (la file prend le contexte : album, playlist, likés…) ;
 * cliquer le titre EN COURS de cette même liste le met en pause ou le reprend.
 * Le rappel reste STABLE : un changement de titre ne redessine que les deux
 * rangées concernées.
 */

import { Fragment, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useTrackActions } from "../actions/useTrackActions";
import { rowClickAction, type ListRow } from "@tentacle-tv/shared/octave";
import type { SelectGesture } from "@tentacle-tv/shared/octave";
import { useCurrentKey, useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { TrackRow, rowColumns } from "./TrackRow";
import { useCompactRows } from "./compactRows";
import { SelectionBar } from "../actions/selection/SelectionBar";
import { orderedKeys } from "@tentacle-tv/shared/octave";
import { useListSelection } from "../actions/selection/useListSelection";
import type { HandleSlot } from "../listOrder/DragHandle";
import type { ReorderBlock } from "@tentacle-tv/api-client";
import { VirtualTrackRows } from "../listOrder/VirtualTrackRows";

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
  /**
   * Une GRANDE liste (playlist, likés) : rangées virtualisées (seules celles à l'écran existent) ;
   * sans intertitres. Avec `reorder`, chaque rangée a sa poignée de glisser.
   */
  virtual?: boolean;
  reorder?: { block: ReorderBlock | null; onMove: (from: number, to: number) => void } | null;
}

/** Un clic sur une rangée : la règle partagée avec le mobile (`pages/rowClick.ts`). */
export { rowClickAction };

export function rowsOf(tracks: readonly MusicTrack[]): ListRow[] {
  return tracks.map((track) => ({ rowKey: track.key, track, pending: null, entryId: null }));
}

export const TrackList = memo(function TrackList({ rows, contextId, showArtwork = false, showAlbum = false, markLibrary = false, useTrackNumbers = false, label, showHeader = false, onRemoveRows, queueTracks, sectionBefore, virtual = false, reorder = null }: TrackListProps) {
  const { t } = useTranslation("music");
  const compact = useCompactRows();
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

  // La sélection multiple : Maj/Cmd-clic, la case au survol ; une liste à la fois (useListSelection).
  const order = useMemo(() => rows.map((r) => r.rowKey), [rows]);
  const selection = useListSelection(order);
  const { select: selectKey } = selection;
  const selectIndex = useCallback((index: number, gesture: SelectGesture) => {
    const key = order[index];
    if (key !== undefined) selectKey(key, gesture);
  }, [order, selectKey]);
  const chosen = orderedKeys(order, selection.selected);
  const selectedTracks = () => {
    const byKey = new Map(rows.map((r) => [r.rowKey, r.track]));
    return chosen.flatMap((k) => byKey.get(k) ?? []);
  };

  const renderRow = (row: ListRow, index: number, handle: HandleSlot | null) => (
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
      selected={selection.selected.has(row.rowKey)}
      selecting={selection.selecting}
      onSelect={selectIndex}
      handle={handle}
    />
  );

  return (
    <div role="grid" aria-label={label} aria-rowcount={virtual ? rows.length : undefined} className="flex flex-col">
      {/* Au téléphone, les rangées compactes n'ont pas de colonnes à nommer. */}
      {compact && showHeader && !selection.selecting && rows.length > 1 && (
        <div className="flex justify-end px-2 pb-1">
          <button type="button" onClick={selection.start} className="min-h-[44px] cursor-pointer rounded-full px-3 text-sm font-semibold text-octave-accent-text hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
            {t("selection.start")}
          </button>
        </div>
      )}
      {showHeader && !compact && (
        <div role="row" className={`mb-1 grid items-center gap-3 border-b border-line-subtle px-2 pb-2 text-xs font-medium uppercase tracking-wide text-content-quaternary ${rowColumns(showAlbum, reorder !== null)}`}>
          {reorder && <span role="columnheader" aria-hidden />}
          <span role="columnheader" aria-label={t("selection.column")} className="flex justify-center">
            {/* « Sélectionner » : les cases paraissent, un clic coche (Cmd/Maj-clic restent). */}
            {!selection.selecting && rows.length > 1 && (
              <button type="button" onClick={selection.start} aria-label={t("selection.start")} title={t("selection.start")} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-content-tertiary hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
                <ListChecks className="h-4 w-4" aria-hidden />
              </button>
            )}
          </span>
          <span role="columnheader" className="text-center">{t("track.number")}</span>
          <span role="columnheader">{t("track.title")}</span>
          {showAlbum && <span role="columnheader" className="hidden lg:block">{t("track.album")}</span>}
          <span role="columnheader" className="pr-9 text-right">{t("track.duration")}</span>
        </div>
      )}
      {virtual ? (
        <VirtualTrackRows
          count={rows.length}
          keyAt={(index) => rows[index]?.rowKey ?? String(index)}
          titleAt={(index) => rows[index]?.track.title ?? ""}
          renderRow={(index, handle) => (rows[index] ? renderRow(rows[index], index, handle) : null)}
          reorder={reorder}
        />
      ) : (
        rows.map((row, index) => {
          const section = sectionBefore?.(row, index) ?? null;
          return (
            <Fragment key={row.rowKey}>
              {section && (
                <div role="row" className="px-2 pb-1 pt-4 text-sm font-semibold text-content-secondary">
                  <span role="rowheader">{section}</span>
                </div>
              )}
              {renderRow(row, index, null)}
            </Fragment>
          );
        })
      )}
      {selection.selecting && (
        <SelectionBar
          count={chosen.length}
          total={order.length}
          tracks={selectedTracks}
          onClear={selection.clear}
          onSelectAll={selection.selectAll}
          onRemove={onRemoveRows ? () => onRemoveRows(chosen) : undefined}
          removeLabel={t("playlist.remove")}
        />
      )}
    </div>
  );
});
