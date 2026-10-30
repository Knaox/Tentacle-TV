/**
 * Octave — « À suivre » : le titre en cours, puis les DEUX files dans l'ordre
 * réel de lecture — la file d'attente de l'utilisateur (« Lire ensuite »,
 * « Ajouter à la file d'attente »), puis la suite du contexte (« Suite de
 * l'album »…), règle partagée `queueFiles.ts`. Chaque entrée se lit, monte,
 * descend ou se retire au clavier comme à la souris — jamais un glisser seul.
 * Le panneau n'est MONTÉ qu'ouvert (rien à composer fermé) ; c'est un îlot
 * d'encre prune, le titre en cours en rose.
 */

import { memo, useMemo } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type QueueItem, queueActions, queueContextTitleKey, queueSections } from "@tentacle-tv/shared/octave";
import { Artwork } from "../components/Artwork";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { TrackMenu } from "../components/TrackMenu";
import { AlbumLink, ArtistLinks } from "../components/TrackLinks";
import { useTrackActions, type TrackActions } from "../actions/useTrackActions";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { SelectCell } from "../components/SelectCell";
import { SelectionBar } from "../actions/selection/SelectionBar";
import { clickGesture, isTrackUnavailable, orderedKeys, type SelectGesture } from "@tentacle-tv/shared/octave";
import { useListSelection } from "../actions/selection/useListSelection";
import { NowSwell } from "../motion/NowSwell";

const small =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface EntrySelection {
  selected: boolean;
  selecting: boolean;
  onSelect: (uid: string, gesture: SelectGesture) => void;
}

function QueueEntry({ item, index, count, current, actions, selection }: { item: QueueItem; index: number; count: number; current: boolean; actions: TrackActions; selection?: EntrySelection }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = item.track;
  const tone = current ? "bg-octave-accent-soft" : selection?.selected ? "bg-octave-selected" : "hover:bg-octave-hover";
  // Un titre indisponible reste dans la file, grisé : la file le saute, le cliquer le dit (`unavailableTrack.ts`).
  const locked = isTrackUnavailable(track);
  return (
    <li className={`group flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${tone}${locked ? " opacity-60" : ""}`}>
      {selection && (
        <SelectCell cell={false} title={track.title} selected={selection.selected} selecting={selection.selecting} onSelect={(g) => selection.onSelect(item.uid, g)} />
      )}
      {/* Toute l'entrée lit le titre (un bouton qui la couvre) ; artistes et album, posés dessus, mènent à leur page. */}
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          disabled={current}
          aria-pressed={selection ? selection.selected : undefined}
          // Maj-clic, Cmd/Ctrl-clic choisissent ; en sélection, un clic coche (il ne saute plus au titre).
          onClick={(e) => {
            const gesture = selection ? clickGesture(e, selection.selecting) : "play";
            if (gesture === "play") queueActions.jumpTo(player, item.uid);
            else selection?.onSelect(item.uid, gesture);
          }}
          onPointerDown={() => player.prefetch([track], "press")}
          aria-label={t("track.play", { title: track.title })}
          className="absolute inset-0 cursor-pointer rounded-lg disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        />
        <Artwork url={track.artworkUrl} className="pointer-events-none h-10 w-10" />
        <span className="pointer-events-none min-w-0">
          <span className={`block truncate text-sm font-medium ${current ? "text-octave-accent-text" : "text-content-primary"}`}>{track.title}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-content-tertiary">
            <AvailabilityMark availability={track.availability} />
            <span className="pointer-events-auto relative truncate">
              <ArtistLinks track={track} />
              {track.album && (
                <>
                  {" · "}
                  <AlbumLink track={track} />
                </>
              )}
            </span>
          </span>
        </span>
        {current && <NowSwell className="pointer-events-none ml-auto mr-1 h-4 w-4 text-octave-accent-text" />}
      </div>
      {/* Le titre de la file s'ajoute à une playlist, ou s'en retire, comme partout (25/10). */}
      <TrackMenu track={track} actions={actions} visible={current ? "always" : "hover"} />
      {!current && (
        <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" className={small} disabled={index === 0} aria-label={t("queue.moveUp")} onClick={() => queueActions.move(player, item.uid, index - 1)}>
            <ChevronUp className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={small} disabled={index === count - 1} aria-label={t("queue.moveDown")} onClick={() => queueActions.move(player, item.uid, index + 1)}>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={small} aria-label={t("queue.remove")} onClick={() => queueActions.remove(player, item.uid)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

const sectionTitle = "px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em]";

/** Une des deux files : son titre (et son geste), puis ses entrées ; les déplacements restent dans SA file. */
function QueueSection({ title, items, actions, selection, action }: {
  title: string;
  items: readonly QueueItem[];
  actions: TrackActions;
  selection: { selected: ReadonlySet<string>; selecting: boolean; onSelect: (uid: string, gesture: SelectGesture) => void };
  action?: { label: string; aria: string; run: () => void };
}) {
  if (items.length === 0) return null;
  return (
    <section className="pt-5">
      <div className="flex items-center justify-between pr-1">
        <h3 className={`${sectionTitle} text-content-quaternary`}>{title}</h3>
        {action && (
          <button type="button" onClick={action.run} aria-label={action.aria} className="-mt-1.5 cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold text-octave-accent-text transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
            {action.label}
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((item, i) => (
          <QueueEntry
            key={item.uid}
            item={item}
            index={i}
            count={items.length}
            current={false}
            actions={actions}
            selection={{ selected: selection.selected.has(item.uid), selecting: selection.selecting, onSelect: selection.onSelect }}
          />
        ))}
      </ul>
    </section>
  );
}

export const QueuePanel = memo(function QueuePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const queue = usePlayerSelector((s) => s.queue);
  const { current, userQueue, contextQueue } = useMemo(() => queueSections(queue), [queue]);
  const next = useMemo(() => [...userQueue, ...contextQueue], [userQueue, contextQueue]);
  const actions = useTrackActions();
  // La sélection multiple de « À suivre » (les deux files) : les gestes groupés, et « Retirer de la file ».
  const order = useMemo(() => next.map((i) => i.uid), [next]);
  const selection = useListSelection(order);
  const chosen = orderedKeys(order, selection.selected);
  const sectionSelection = { selected: selection.selected, selecting: selection.selecting, onSelect: selection.select };
  return (
    <aside aria-label={t("queue.title")} className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="oc-heading text-lg text-content-primary">{t("queue.upNext")}</h2>
        <button type="button" onClick={onClose} aria-label={t("queue.close")} className={small}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {current && (
          <>
            <h3 className={`${sectionTitle} pt-2 text-octave-accent-text`}>{t("queue.nowPlaying")}</h3>
            <ul>
              <QueueEntry item={current} index={-1} count={0} current actions={actions} />
            </ul>
          </>
        )}
        <QueueSection
          title={t("queue.userQueue")}
          items={userQueue}
          actions={actions}
          selection={sectionSelection}
          action={{ label: t("queue.clear"), aria: t("queue.clearLabel"), run: () => queueActions.clearUserQueue(player) }}
        />
        <QueueSection title={t(queueContextTitleKey(queue.contextId))} items={contextQueue} actions={actions} selection={sectionSelection} />
        {next.length === 0 && <p className="px-2 pt-5 text-sm text-content-tertiary">{t("queue.empty")}</p>}
      </div>
      {selection.selecting && (
        <SelectionBar
          inQueue
          count={chosen.length}
          total={order.length}
          tracks={() => next.filter((i) => selection.selected.has(i.uid)).map((i) => i.track)}
          onClear={selection.clear}
          onSelectAll={selection.selectAll}
          onRemove={() => chosen.forEach((uid) => queueActions.remove(player, uid))}
          removeLabel={t("queue.remove")}
        />
      )}
    </aside>
  );
});
