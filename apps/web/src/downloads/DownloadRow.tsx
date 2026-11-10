/**
 * Ligne d'un téléchargement : vignette locale 16:9, titre, puce d'état, méta
 * (variante/palier/taille), progression LIVE (store de progression, hors
 * TanStack) sur la jauge du hors ligne, actions par statut (pause, reprise,
 * annulation, suppression, auto-suppression). Une ligne de PANNEAU : la
 * séparation est un filet, plus une carte bordée par titre.
 *
 * La ligne DIT ce qui se passe, comme celle du téléphone : l'étape en cours
 * (transfert puis finalisation), le débit et le temps restant, la CAUSE exacte
 * d'une erreur, et le décompte avant la prochaine tentative. Elle n'affichait
 * qu'une barre et deux tailles — un remux de plusieurs minutes après le dernier
 * octet reçu la laissait figée à 100 %, sans un mot.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelDownload,
  pauseDownload,
  resumeDownload,
  type DownloadEntry,
} from "./api";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { AutoDeleteControl } from "./AutoDeleteControl";
import { episodeCode, RetryAction, RowProgress, SmallAction, StatusBadge } from "./DownloadRowParts";
import { RowThumb } from "./ui/RowThumb";
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
  /** Dans la section d'une série, répéter son nom devant chaque épisode est du bruit. */
  hideSeries?: boolean;
}

export function DownloadRow({ entry, userId, onDelete, onPlay, selection, hideSeries = false }: DownloadRowProps) {
  const { t } = useTranslation("downloads");
  const live = useFileProgress(entry.id);

  const bytesDone = live?.bytesDone ?? entry.bytesDone;
  const expected = live?.expectedSize ?? entry.expectedSize;
  const pct = expected && expected > 0 ? Math.min(100, (bytesDone / expected) * 100) : null;
  const isActive = ACTIVE.has(entry.status) || entry.status === "error";
  const retryIn = useRetryCountdown(entry.status === "error" ? entry.nextRetryAt : null);
  // Le remux dure parfois des minutes APRÈS le dernier octet : sans ce mot, la
  // ligne semblait figée. Débit et temps restant n'ont de sens qu'en transfert.
  const finalizing = entry.status === "downloading" && entry.phase === "finalize";
  // Le serveur prépare le fichier (`files.phase = 'prepare'`) : rien ne transite encore, la
  // barre reste vide au lieu de feindre un début de transfert.
  const preparing = entry.status === "downloading" && entry.phase === "prepare";
  // Le débit du store SURVIT à la fin du transfert (dernière mesure gardée) :
  // sans cette garde, une ligne terminée affichait encore « 75 Mio/s · moins
  // d'une minute ». Il n'a de sens que pendant un transfert qui court.
  const pace =
    entry.status !== "downloading" || finalizing || preparing
      ? []
      : [formatRate(t, live?.rateBps ?? null), formatTimeLeft(t, live?.etaMs ?? null)].filter(
          (part): part is string => part !== null,
        );

  const displayTitle = useMemo(() => {
    if (entry.kind === "episode" && entry.seriesName && !hideSeries) {
      return `${entry.seriesName} — ${entry.title ?? entry.itemId}`;
    }
    // Sous le nom de la série, l'épisode prend son code : « Épisode 1 » seul ne
    // disait pas de quelle saison.
    const code = hideSeries ? episodeCode(entry) : null;
    return code === null ? (entry.title ?? entry.itemId) : `${code} · ${entry.title ?? entry.itemId}`;
  }, [entry, hideSeries]);

  const meta = [
    entry.variant === "original" ? t("variantOriginal") : `${t("variantLight")} ${entry.preset?.replace(/^p/, "") ?? ""}p`,
    entry.status === "complete" ? formatBytes(entry.bytesDone) : expected ? formatBytes(expected) : null,
  ].filter(Boolean);

  const progressText = [
    `${formatBytes(bytesDone)}${expected ? ` / ${formatBytes(expected)}` : ""}`,
    pct !== null && !finalizing ? `${Math.round(pct)} %` : null,
  ].filter((part): part is string => part !== null);
  const pending = retryIn !== null ? (retryIn > 0 ? t("retryIn", { seconds: retryIn }) : t("retryNow")) : null;

  return (
    <div
      data-status={entry.status}
      className={`flex items-center gap-3.5 px-5 py-3 transition-colors duration-hover ${
        selection?.selected ? "bg-accent-soft" : selection ? "hover:bg-fill-faint" : ""
      } ${selection ? "cursor-pointer" : ""}`}
      // Toute la ligne bascule la case : viser un carré de 20 px sur une liste
      // de vingt-quatre épisodes est un supplice.
      onClick={selection ? () => selection.onToggle(entry.id) : undefined}
    >
      {selection && (
        <button
          type="button"
          role="checkbox"
          aria-checked={selection.selected}
          aria-label={displayTitle}
          // La ligne porte déjà le clic : sans ceci il compterait DEUX fois et
          // la case reviendrait aussitôt à son état d'avant.
          onClick={(e) => {
            e.stopPropagation();
            selection.onToggle(entry.id);
          }}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
        >
          <span className="ui-check">
            <CheckIcon size={13} weight="bold" aria-hidden />
          </span>
        </button>
      )}
      <RowThumb itemId={entry.itemId} episode={entry.kind === "episode"} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onPlay?.(entry)}
            disabled={entry.status !== "complete" || !onPlay || !!selection}
            className="min-w-0 truncate rounded-chip text-left text-[15px] font-semibold leading-snug text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-default"
          >
            {displayTitle}
          </button>
          <StatusBadge status={entry.status} errorCode={entry.errorCode} phase={entry.phase} />
          {/* En fenêtre étroite, les tailles cèdent la place au titre : le
              pourcentage suffit à dire où en est la ligne. */}
          {/* Un titre qui n'a encore rien reçu (en attente, en pause) : sa puce le dit, pas « 0 Kio · 0 % ». */}
          {isActive && ((entry.status === "downloading" && !preparing) || bytesDone > 0) && (
            <span className="num ml-auto flex-shrink-0 text-right text-xs text-content-tertiary">
              <span className="hidden sm:inline">{progressText.join(" · ")}</span>
              <span className="sm:hidden">{progressText[1] ?? ""}</span>
            </span>
          )}
        </div>
        {isActive && (
          <RowProgress
            ratio={(finalizing ? 100 : pct ?? (entry.status === "downloading" && !preparing ? 8 : 0)) / 100}
            status={entry.status}
            label={displayTitle}
          />
        )}
        <p className="num text-xs text-content-tertiary">
          {[meta.join(" · "), pending ?? (pace.length > 0 ? pace.join(" · ") : null)].filter(Boolean).join(" — ")}
        </p>
      </div>

      {/*
        Actions par ligne RETIRÉES en mode sélection : la ligne entière bascule
        la case, et une corbeille posée là-dessus se cliquerait par accident.
        La barre groupée porte les mêmes gestes pendant ce temps.
      */}
      <div className={`flex flex-shrink-0 items-center gap-1 ${selection ? "hidden" : ""}`}>
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
