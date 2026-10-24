/**
 * Octave — la file d'attente : le titre en cours, puis ce qui suit (dans
 * l'ordre réel de lecture, aléatoire compris). Chaque entrée se lit, monte,
 * descend ou se retire au clavier comme à la souris — jamais un glisser seul.
 * Le panneau n'est MONTÉ qu'ouvert (rien à composer fermé).
 */

import { memo } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type QueueItem, upcoming, queueActions } from "@tentacle-tv/shared/octave";
import { Artwork } from "../components/Artwork";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

const small =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:bg-fill-subtle hover:text-content-primary disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function QueueEntry({ item, index, count, current }: { item: QueueItem; index: number; count: number; current: boolean }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = item.track;
  return (
    <li className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fill-subtle">
      <button
        type="button"
        disabled={current}
        onClick={() => queueActions.jumpTo(player, item.uid)}
        onPointerDown={() => player.prefetch([track], "press")}
        aria-label={t("track.play", { title: track.title })}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default"
      >
        <Artwork url={track.artworkUrl} className="h-10 w-10" />
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${current ? "text-brand" : "text-content-primary"}`}>{track.title}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-content-tertiary">
            <AvailabilityMark availability={track.availability} />
            <span className="truncate">{track.artists.map((a) => a.name).join(", ")}</span>
          </span>
        </span>
      </button>
      {!current && (
        <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" className={small} disabled={index === 0} aria-label={t("queue.moveUp")} onClick={() => queueActions.move(player, item.uid, index - 1)}>
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" className={small} disabled={index === count - 1} aria-label={t("queue.moveDown")} onClick={() => queueActions.move(player, item.uid, index + 1)}>
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" className={small} aria-label={t("queue.remove")} onClick={() => queueActions.remove(player, item.uid)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}

export const QueuePanel = memo(function QueuePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("music");
  const queue = usePlayerSelector((s) => s.queue);
  const current = queue.items[queue.cursor] ?? null;
  const next = upcoming(queue);
  return (
    <aside aria-label={t("queue.title")} className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-lg font-bold text-content-primary">{t("queue.title")}</h2>
        <button type="button" onClick={onClose} aria-label={t("queue.close")} className={small}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {current && (
          <>
            <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-content-quaternary">{t("queue.nowPlaying")}</h3>
            <ul>
              <QueueEntry item={current} index={-1} count={0} current />
            </ul>
          </>
        )}
        <h3 className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-content-quaternary">{t("queue.upNext")}</h3>
        {next.length === 0 ? (
          <p className="px-2 text-sm text-content-tertiary">{t("queue.empty")}</p>
        ) : (
          <ul>
            {next.map((item, i) => (
              <QueueEntry key={item.uid} item={item} index={i} count={next.length} current={false} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
});
