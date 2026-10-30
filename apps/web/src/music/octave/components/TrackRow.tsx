/**
 * Octave — une rangée de titre, 56 px FIXES (le squelette tient la même place).
 * Un clic lit (la barre se met à jour dans la même image) ; sur le titre en
 * cours de CETTE liste, il met en pause ou reprend — jamais un redémarrage au
 * début. Le survol et l'appui ANTICIPENT (`hover`, `press`). Le titre en cours
 * est marqué en mot (lecteurs d'écran) et en couleur de marque ; en lecture,
 * une houle qui roule (`motion/OceanSwell`), qui se calme en pause.
 * Au téléphone, la rangée COMPACTE (`compactRows.ts`) : un appui long y entre
 * en sélection.
 */

import { memo, useCallback } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { TrackActions } from "../actions/useTrackActions";
import { durationLabel } from "@tentacle-tv/shared/octave";
import { usePrefetchHandlers } from "../player/usePrefetchHandlers";
import { Artwork } from "./Artwork";
import { AvailabilityMark } from "./AvailabilityMark";
import { HeartButton } from "./HeartButton";
import { TrackMenu } from "./TrackMenu";
import { QuickAddButton } from "./QuickAddButton";
import { QuickRemoveButton } from "./QuickRemoveButton";
import { endTrackDrag, startTrackDrag } from "../actions/dragTrack";
import { announceUnavailableTrack, clickGesture, isTrackUnavailable, type SelectGesture } from "@tentacle-tv/shared/octave";
import { SelectCell } from "./SelectCell";
import { KeptMark } from "../offline/KeptMark";
import { AlbumLink, ArtistLinks } from "./TrackLinks";
import { OceanSwell } from "../motion/OceanSwell";
import { useOctaveGlassStage } from "../glass/glassStage";
import { DragHandle, type HandleSlot } from "../listOrder/DragHandle";
import { useLongPress } from "../../../mirror/ui/useLongPress";
import { chainHandlers, compactRowColumns, useCompactRows } from "./compactRows";

/**
 * La grille d'une rangée : la case de sélection, le numéro, le titre, (l'album), les gestes. La colonne Album
 * n'existe qu'à partir de `lg` — plus étroit, elle écrasait le titre (« Mo… »).
 */
export function rowColumns(showAlbum: boolean, withHandle = false): string {
  // Une liste réordonnable a, en tête, la colonne de sa poignée.
  if (withHandle) {
    return showAlbum
      ? "grid-cols-[1.25rem_1.5rem_2rem_minmax(0,1fr)_auto] lg:grid-cols-[1.25rem_1.5rem_2rem_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
      : "grid-cols-[1.25rem_1.5rem_2rem_minmax(0,1fr)_auto]";
  }
  return showAlbum
    ? "grid-cols-[1.5rem_2rem_minmax(0,1fr)_auto] lg:grid-cols-[1.5rem_2rem_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
    : "grid-cols-[1.5rem_2rem_minmax(0,1fr)_auto]";
}

export interface TrackRowProps {
  track: MusicTrack;
  /** Numéro affiché (piste d'album ou rang dans la liste). */
  number: number;
  current: boolean;
  /** Le titre en cours est-il en lecture (seule la rangée courante le reçoit vrai) ? */
  playing?: boolean;
  failed?: boolean;
  showArtwork?: boolean;
  showAlbum?: boolean;
  /** Une liste qui mêle bibliothèque et ailleurs : les titres de la bibliothèque y portent leur marque. */
  markLibrary?: boolean;
  actions: TrackActions;
  /** Rang dans la liste : le rappel est STABLE (une rangée ne se redessine pas quand le titre courant change ailleurs). */
  index: number;
  onPlayIndex: (index: number) => void;
  /** La clé de la rangée (une entrée de playlist, une attente) : ce que retire `onRemoveRow`. */
  rowKey?: string;
  /** Retirer cette rangée de la playlist courante (entrée Jellyfin, ou attente hors bibliothèque). */
  onRemoveRow?: (rowKey: string) => void;
  /** Ce que l'extension dit de l'entrée en attente (« Ne peut pas entrer dans la bibliothèque… »). */
  note?: string | null;
  /** Sélection multiple (selectionRules.ts) : cette rangée est choisie ; la liste est « en sélection ». */
  selected?: boolean;
  selecting?: boolean;
  /** Choisir cette rangée (rappel STABLE, par rang). */
  onSelect?: (index: number, gesture: SelectGesture) => void;
  /** La poignée du glisser (liste réordonnable) : une colonne de plus, en tête. */
  handle?: HandleSlot | null;
}

/** La case du numéro : numéro, ou Lecture au survol ; pour le titre en cours, son état et le geste qui l'inverse. */
function NumberCell({ number, current, playing }: { number: number; current: boolean; playing: boolean }) {
  const { t } = useTranslation("music");
  const HoverIcon = current && playing ? Pause : Play;
  return (
    <div role="gridcell" className="relative flex h-8 w-8 items-center justify-center text-sm tabular-nums text-content-tertiary">
      <span className={`octave-row-number transition-opacity duration-150 ${current ? "text-octave-accent-text" : ""}`}>
        {current ? <OceanSwell playing={playing} /> : number}
      </span>
      {current && <span className="sr-only">{t("track.nowPlaying")}</span>}
      <span className="octave-row-play absolute inset-0 flex items-center justify-center text-content-primary transition-opacity duration-150" aria-hidden>
        <HoverIcon className="h-4 w-4" fill="currentColor" />
      </span>
    </div>
  );
}

export const TrackRow = memo(function TrackRow({ track, number, current, playing = false, failed = false, showArtwork = false, showAlbum = false, markLibrary = false, actions, index, onPlayIndex, rowKey, onRemoveRow, note = null, selected = false, selecting = false, onSelect, handle = null }: TrackRowProps) {
  const { t } = useTranslation("music");
  const stage = useOctaveGlassStage();
  // Un titre qui ne se lit pas (`unavailableTrack.ts` : importé sans source, sortie sans écoute publique) : grisé ;
  // le cliquer ne lance rien, la lecture en cours continue, et l'avis dit pourquoi.
  const locked = isTrackUnavailable(track);
  const onPlay = () => {
    if (locked) announceUnavailableTrack();
    else onPlayIndex(index);
  };
  const select = useCallback((gesture: SelectGesture) => onSelect?.(index, gesture), [index, onSelect]);
  // Une entrée Jellyfin se retire ; un titre hors bibliothèque en attente aussi (sa demande s'annule).
  const onRemove = rowKey !== undefined && onRemoveRow ? () => onRemoveRow(rowKey) : undefined;
  const prefetch = usePrefetchHandlers(() => [track]);
  const muted = track.availability === "pending" || failed || locked;
  const compact = useCompactRows();
  // Au doigt, l'appui long choisit la rangée (et ouvre la sélection) ; un clic simple lit, toujours.
  const longPress = useLongPress(compact && onSelect ? () => select("toggle") : undefined);
  const showSelect = !compact || selecting;
  const showNumber = !compact || !showArtwork;
  const columns = compact
    ? compactRowColumns({ handle: handle !== null, select: !!onSelect && selecting, number: !showArtwork })
    : rowColumns(showAlbum, handle !== null);
  return (
    <div
      role="row"
      tabIndex={0}
      aria-current={current ? "true" : undefined}
      aria-disabled={locked || undefined}
      aria-selected={onSelect ? selected : undefined}
      // Maj-clic, Cmd/Ctrl-clic choisissent ; en sélection, un clic simple coche aussi (il ne lit plus).
      onClick={(e) => {
        if (compact && longPress.consumeClick()) return;
        const gesture = onSelect ? clickGesture(e, selecting) : "play";
        if (gesture === "play") onPlay();
        else select(gesture);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter") onPlay();
        else if (e.key === " " && onSelect) {
          e.preventDefault();
          select(e.shiftKey ? "range" : "toggle");
        }
      }}
      {...(compact ? chainHandlers(prefetch, longPress.handlers) : prefetch)}
      // Glisser le titre sur une playlist du rail l'y ajoute (souris) ; le menu « Ajouter à une playlist » en est l'équivalent.
      draggable={actions.canAddToPlaylist(track)}
      onDragStart={(e) => startTrackDrag(e, track)}
      onDragEnd={endTrackDrag}
      className={`octave-row ${stage ? "lg-pane-row " : ""}group grid h-14 ${locked ? "cursor-default opacity-60" : "cursor-pointer"} select-none items-center ${compact ? "gap-2" : "gap-3"} rounded-md px-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        selected ? "bg-octave-selected" : "hover:bg-octave-hover focus-visible:bg-octave-hover"
      } ${columns}`}
    >
      {handle && <DragHandle slot={handle} />}
      {showSelect && (onSelect ? <SelectCell title={track.title} selected={selected} selecting={selecting} onSelect={select} /> : compact ? null : <div role="gridcell" />)}
      {showNumber && <NumberCell number={number} current={current} playing={playing} />}
      <div role="gridcell" className="flex min-w-0 items-center gap-3">
        {showArtwork && <Artwork url={track.artworkUrl} label={track.album?.title ?? track.title} thumb className="h-10 w-10" />}
        <div className="min-w-0">
          <div title={track.title} className={`flex items-center gap-1.5 truncate text-[15px] font-medium leading-5 ${current ? "text-octave-accent-text" : muted ? "text-content-secondary" : "text-content-primary"}`}>
            <span className="truncate">{track.title}</span>
            {track.explicit && (
              <span className="shrink-0 rounded-sm bg-fill-medium px-1 text-[10px] font-bold leading-4 text-content-secondary" title={t("track.explicit")}>
                E<span className="sr-only">{t("track.explicit")}</span>
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-content-tertiary">
            <AvailabilityMark availability={track.availability} failed={failed} note={note} showLibrary={markLibrary} />
            <KeptMark trackKey={track.key} />
            <span className="truncate">
              <ArtistLinks track={track} />
              {/* L'album, lien vers sa page : dans sa colonne en fenêtre large, ici en dessous. */}
              {showAlbum && track.album && (
                <span className="lg:hidden">
                  {" · "}
                  <AlbumLink track={track} />
                </span>
              )}
              {/* Un échec dit POURQUOI, en mot (jamais l'icône seule) : « ne peut pas entrer dans la bibliothèque… ». */}
              {failed && note && <span className="text-status-error-fg"> · {note}</span>}
              {locked && <span> · {track.unavailable === "notPublic" ? t("notPublic", { ns: "musicReleases" }) : t("unavailableAlbum.badge")}</span>}
            </span>
          </div>
        </div>
      </div>
      {showAlbum && !compact && (
        <div role="gridcell" className="hidden min-w-0 truncate text-[13px] text-content-tertiary lg:block">
          <AlbumLink track={track} />
        </div>
      )}
      <div role="gridcell" className="flex items-center gap-1">
        {onRemove && !compact && <QuickRemoveButton title={track.title} onRemove={onRemove} />}
        {!compact && <QuickAddButton track={track} actions={actions} />}
        <HeartButton track={track} actions={actions} quiet />
        {/* Une durée inconnue (titre d'une recherche hors bibliothèque) : la place, pas de « –:–– ». */}
        {!compact && <span className="oc-meta w-12 text-right text-[13px] text-content-tertiary">{track.durationMs === null ? "" : durationLabel(track.durationMs)}</span>}
        <TrackMenu track={track} actions={actions} onRemove={onRemove} />
      </div>
    </div>
  );
});
