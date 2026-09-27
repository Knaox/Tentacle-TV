/**
 * Ligne d'un téléchargement : affiche locale (protocole asset Tauri), titre,
 * méta (variante/palier/taille), progression LIVE (store de progression, hors
 * TanStack), badge d'état en jetons status-*, actions par statut (pause,
 * reprise, annulation, suppression, auto-suppression).
 *
 * La ligne DIT ce qui se passe, comme celle du téléphone : l'étape en cours
 * (transfert puis finalisation), le débit et le temps restant, la CAUSE exacte
 * d'une erreur, et le décompte avant la prochaine tentative. Elle n'affichait
 * qu'une barre et deux tailles — un remux de plusieurs minutes après le dernier
 * octet reçu la laissait figée à 100 %, sans un mot.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelDownload,
  pauseDownload,
  resumeDownload,
  type DownloadEntry,
} from "./api";
import { Film } from "lucide-react";
import { AutoDeleteControl } from "./AutoDeleteControl";
import { RetryAction, RowProgress, SmallAction, StatusBadge } from "./DownloadRowParts";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { formatBytes } from "./presets";
import { formatRate, formatTimeLeft, useRetryCountdown } from "./transferText";
import { useFileProgress } from "@tentacle-tv/offline-core/react";

const ACTIVE = new Set(["queued", "downloading", "paused"]);

interface DownloadRowProps {
  entry: DownloadEntry;
  userId: string;
  onDelete: (entry: DownloadEntry) => void;
  onPlay?: (entry: DownloadEntry) => void;
  /** Mode sélection actif : la ligne porte une case et devient cliquable. */
  selection?: { selected: boolean; onToggle: (id: number) => void };
}

export function DownloadRow({ entry, userId, onDelete, onPlay, selection }: DownloadRowProps) {
  const { t } = useTranslation("downloads");
  const [posterFailed, setPosterFailed] = useState(false);
  useDownloadsRootReady(); // re-rend quand la racine locale est résolue
  const posterUrl = localResourceUrl(`meta/${entry.itemId}/primary.jpg`);
  const live = useFileProgress(entry.id);

  const bytesDone = live?.bytesDone ?? entry.bytesDone;
  const expected = live?.expectedSize ?? entry.expectedSize;
  const pct = expected && expected > 0 ? Math.min(100, (bytesDone / expected) * 100) : null;
  const isActive = ACTIVE.has(entry.status) || entry.status === "error";
  const retryIn = useRetryCountdown(entry.status === "error" ? entry.nextRetryAt : null);
  // Le remux dure parfois des minutes APRÈS le dernier octet : sans ce mot, la
  // ligne semblait figée. Débit et temps restant n'ont de sens qu'en transfert.
  const finalizing = entry.status === "downloading" && entry.phase === "finalize";
  // Le débit du store SURVIT à la fin du transfert (dernière mesure gardée) :
  // sans cette garde, une ligne terminée affichait encore « 75 Mio/s · moins
  // d'une minute ». Il n'a de sens que pendant un transfert qui court.
  const pace =
    entry.status !== "downloading" || finalizing
      ? []
      : [formatRate(t, live?.rateBps ?? null), formatTimeLeft(t, live?.etaMs ?? null)].filter(
          (part): part is string => part !== null,
        );

  const displayTitle = useMemo(() => {
    if (entry.kind === "episode" && entry.seriesName) {
      return `${entry.seriesName} — ${entry.title ?? entry.itemId}`;
    }
    return entry.title ?? entry.itemId;
  }, [entry]);

  const meta = [
    entry.variant === "original" ? t("variantOriginal") : `${t("variantLight")} ${entry.preset?.replace(/^p/, "") ?? ""}p`,
    entry.status === "complete" ? formatBytes(entry.bytesDone) : expected ? formatBytes(expected) : null,
  ].filter(Boolean);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        selection?.selected
          ? "border-[rgba(var(--brand-rgb),0.45)] bg-[rgba(var(--brand-rgb),0.1)]"
          : entry.status === "error"
            ? "border-status-error-bg bg-fill-faint hover:bg-fill-subtle"
            : "border-transparent bg-fill-faint hover:bg-fill-subtle"
      } ${selection ? "cursor-pointer" : ""}`}
      // Toute la ligne bascule la case : viser un carré de 16 px sur une liste
      // de vingt-quatre épisodes est un supplice.
      onClick={selection ? () => selection.onToggle(entry.id) : undefined}
    >
      {selection && (
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => selection.onToggle(entry.id)}
          // La ligne porte déjà le clic : sans ceci il compterait DEUX fois et
          // la case reviendrait aussitôt à son état d'avant.
          onClick={(e) => e.stopPropagation()}
          aria-label={displayTitle}
          className="h-4 w-4 flex-shrink-0 accent-[var(--brand)]"
        />
      )}
      <div className="flex h-16 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 ring-1 ring-inset ring-line-subtle">
        {posterUrl && !posterFailed ? (
          <img
            src={posterUrl}
            alt=""
            loading="lazy" decoding="async"
            className="h-full w-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          // Sans affiche locale, un repère plutôt qu'un rectangle vide.
          <Film className="h-4 w-4 text-content-quaternary" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPlay?.(entry)}
            disabled={entry.status !== "complete" || !onPlay || !!selection}
            className="truncate text-left text-sm font-semibold text-content-primary disabled:cursor-default"
          >
            {displayTitle}
          </button>
          <StatusBadge status={entry.status} errorCode={entry.errorCode} phase={entry.phase} />
        </div>
        <p className="mt-0.5 text-xs text-content-quaternary">{meta.join(" · ")}</p>
        {isActive && (
          <div className="mt-2 flex items-center gap-2">
            <RowProgress
              ratio={(finalizing ? 100 : pct ?? (entry.status === "downloading" ? 8 : 0)) / 100}
              status={entry.status}
            />
            {/* En fenêtre étroite, les tailles cèdent la place au titre : le
                pourcentage suffit à dire où en est la ligne. */}
            <span className="flex-shrink-0 text-right text-[10px] tabular-nums text-content-quaternary sm:w-28">
              <span className="hidden sm:inline">
                {formatBytes(bytesDone)}
                {expected ? ` / ${formatBytes(expected)}` : ""}
                {pct !== null && !finalizing ? " · " : ""}
              </span>
              {pct !== null && !finalizing ? `${Math.round(pct)} %` : ""}
            </span>
          </div>
        )}
        {(pace.length > 0 || retryIn !== null) && (
          <p className="mt-1 text-[10px] tabular-nums text-content-quaternary">
            {retryIn !== null
              ? retryIn > 0
                ? t("retryIn", { seconds: retryIn })
                : t("retryNow")
              : pace.join(" · ")}
          </p>
        )}
      </div>

      {/*
        Actions par ligne RETIRÉES en mode sélection : la ligne entière bascule
        la case, et une corbeille posée là-dessus se cliquerait par accident.
        La barre groupée porte les mêmes gestes pendant ce temps.
      */}
      <div className={`flex flex-shrink-0 items-center gap-1.5 ${selection ? "hidden" : ""}`}>
        {entry.status === "downloading" || entry.status === "queued" ? (
          <SmallAction label={t("pause")} onClick={() => void pauseDownload(entry.id)} glyph="pause" />
        ) : null}
        {entry.status === "paused" ? (
          <SmallAction label={t("resume")} onClick={() => void resumeDownload(entry.id)} glyph="play" />
        ) : null}
        {entry.status === "error" ? (
          <RetryAction label={t("retry")} onClick={() => void resumeDownload(entry.id)} />
        ) : null}
        {ACTIVE.has(entry.status) ? (
          <SmallAction label={t("cancelTransfer")} onClick={() => void cancelDownload(entry.id)} glyph="stop" />
        ) : null}
        {entry.status === "complete" && onPlay ? (
          <SmallAction label={t(entry.kind === "episode" ? "episodePlay" : "localPlayback")} onClick={() => onPlay(entry)} glyph="play" />
        ) : null}
        {entry.status === "complete" && (
          <AutoDeleteControl entry={entry} userId={userId} />
        )}
        <SmallAction label={t("delete")} onClick={() => onDelete(entry)} glyph="trash" danger />
      </div>
    </div>
  );
}
