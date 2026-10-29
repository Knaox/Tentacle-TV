/**
 * Octave — la barre d'une sélection : combien de titres, puis les gestes groupés, tels que les décrit le modèle
 * partagé (`selectionActions`, le même que le mobile) — ajouter à une playlist, lire ensuite, ajouter à la file,
 * aimer, et (dans une playlist modifiable, ou dans la file) les retirer d'ici. Un îlot d'encre prune
 * qui flotte au bas de la liste ; « × » ou Échap sortent de la sélection. Sous `sm`, les gestes ne gardent que
 * leur icône (nom accessible et bulle gardés).
 */

import type { ComponentType } from "react";
import { CheckCheck, CircleMinus, Heart, HeartOff, ListEnd, ListPlus, ListStart, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { openPlaylistChooserForMany } from "../playlistChooserStore";
import { likeOverrideOf } from "../likeOverrides";
import { useTrackActions } from "../useTrackActions";
import { bulkLikePlan, SELECTION_ACTION_LABEL, selectionActions, type SelectionActionId } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../../player/OctavePlayerProvider";
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

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const ICONS: Record<SelectionActionId, Icon> = { addToPlaylist: ListPlus, playNext: ListStart, enqueue: ListEnd, like: Heart, unlike: HeartOff, remove: CircleMinus };

function Action({ icon: Icon, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
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
  const player = useOctavePlayer();
  const chosen = tracks();
  const likePlan = bulkLikePlan(chosen, (tr) => likeOverrideOf(tr.key) ?? tr.favorite, actions.canLike);
  const ids = selectionActions({
    count,
    canAddToPlaylist: chosen.some(actions.canAddToPlaylist),
    canQueue: !!player,
    inQueue,
    like: likePlan.tracks.length > 0 ? { liked: likePlan.liked } : null,
    canRemove: !!onRemove,
  });
  const run: Record<SelectionActionId, () => void> = {
    addToPlaylist: () => openPlaylistChooserForMany(tracks()),
    playNext: () => bulk.playNext(tracks()),
    enqueue: () => bulk.enqueue(tracks()),
    like: () => bulk.like(tracks()),
    unlike: () => bulk.like(tracks()),
    remove: () => onRemove?.(),
  };
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
        {count === 0 && <span className="px-2 text-sm text-content-tertiary">{t("selection.none")}</span>}
        {ids.map((id) => (
          <Action key={id} icon={ICONS[id]} label={id === "remove" ? (removeLabel ?? t(SELECTION_ACTION_LABEL.remove)) : t(SELECTION_ACTION_LABEL[id])} onClick={done(run[id])} />
        ))}
      </div>
    </div>
  );
}
