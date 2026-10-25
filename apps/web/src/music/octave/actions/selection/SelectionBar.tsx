/**
 * Octave — la barre d'une sélection : combien de titres, puis les gestes groupés — ajouter à une playlist, aimer,
 * ajouter à la file, et (dans une playlist modifiable, ou dans la file) les retirer d'ici. Un îlot d'encre prune
 * qui flotte au bas de la liste ; « × » ou Échap sortent de la sélection. Sous `sm`, les gestes ne gardent que
 * leur icône (nom accessible et bulle gardés).
 */

import type { ComponentType } from "react";
import { CheckCheck, CircleMinus, Heart, HeartOff, ListEnd, ListPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { openPlaylistChooserForMany } from "../playlistChooserStore";
import { likeOverrideOf } from "../likeOverrides";
import { useTrackActions } from "../useTrackActions";
import { bulkLikePlan } from "./bulkRules";
import { useBulkTrackActions } from "./useBulkTrackActions";

export interface SelectionBarProps {
  count: number;
  total: number;
  /** Les titres choisis, dans l'ordre de la liste (lus au geste). */
  tracks: () => MusicTrack[];
  onClear: () => void;
  onSelectAll: () => void;
  /** Retirer d'ici (playlist modifiable, file) ; absent : le geste n'est pas offert. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Dans la file : « Ajouter à la file » n'a pas de sens. */
  inQueue?: boolean;
}

const ACTION =
  "flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function Action({ icon: Icon, label, onClick }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; onClick: () => void }) {
  return (
    <button type="button" className={ACTION} onClick={onClick} title={label}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

export function SelectionBar({ count, total, tracks, onClear, onSelectAll, onRemove, removeLabel, inQueue = false }: SelectionBarProps) {
  const { t } = useTranslation("music");
  const actions = useTrackActions();
  const bulk = useBulkTrackActions();
  const likePlan = bulkLikePlan(tracks(), (tr) => likeOverrideOf(tr.key) ?? tr.favorite, actions.canLike);
  const done = (fn: () => void) => () => {
    fn();
    onClear();
  };
  return (
    // Collée au bas de la zone qui défile : la marge que la coquille réserve au lecteur flottant la garde au-dessus.
    <div className="pointer-events-none sticky bottom-3 z-20 mt-3 flex justify-center px-2">
      <div
        role="toolbar"
        aria-label={t("selection.toolbar")}
        className="octave-selection-bar pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-line-subtle p-1"
        style={{ background: "var(--oc-ink-raised)", boxShadow: "var(--oc-shadow-panel)" }}
      >
        <button type="button" onClick={onClear} aria-label={t("selection.clear")} title={t("selection.clear")} className={`${ACTION} w-11 justify-center px-0`}>
          <X className="h-4 w-4" aria-hidden />
        </button>
        <span aria-live="polite" className="shrink-0 whitespace-nowrap px-2 text-sm font-semibold tabular-nums text-content-primary">
          {t("selection.count", { count })}
        </span>
        {count < total && <Action icon={CheckCheck} label={t("selection.selectAll")} onClick={onSelectAll} />}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-subtle" />
        <Action icon={ListPlus} label={t("playlist.addTo")} onClick={done(() => openPlaylistChooserForMany(tracks()))} />
        {likePlan.tracks.length > 0 && (
          <Action icon={likePlan.liked ? Heart : HeartOff} label={t(likePlan.liked ? "selection.like" : "selection.unlike")} onClick={done(() => bulk.like(tracks()))} />
        )}
        {!inQueue && <Action icon={ListEnd} label={t("track.addToQueue")} onClick={done(() => bulk.enqueue(tracks()))} />}
        {onRemove && <Action icon={CircleMinus} label={removeLabel ?? t("playlist.remove")} onClick={done(onRemove)} />}
      </div>
    </div>
  );
}
