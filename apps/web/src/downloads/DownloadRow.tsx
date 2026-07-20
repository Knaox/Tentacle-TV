/**
 * Ligne d'un téléchargement : affiche locale (protocole asset Tauri),
 * titre, méta (variante/preset/taille), progression LIVE (store de
 * progression, hors TanStack), badge d'état en tokens status-*, actions par
 * statut (pause, reprise, annulation, suppression, auto-suppression).
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelDownload,
  pauseDownload,
  resumeDownload,
  setAutoDeleteAfterWatch,
  type DownloadEntry,
} from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { formatBytes } from "./presets";
import { useFileProgress } from "./progressStore";

const ACTIVE = new Set(["queued", "downloading", "paused"]);

interface DownloadRowProps {
  entry: DownloadEntry;
  userId: string;
  onDelete: (entry: DownloadEntry) => void;
  onPlay?: (entry: DownloadEntry) => void;
}

export function DownloadRow({ entry, userId, onDelete, onPlay }: DownloadRowProps) {
  const { t } = useTranslation("downloads");
  const [posterFailed, setPosterFailed] = useState(false);
  useDownloadsRootReady(); // re-rend quand la racine locale est résolue
  const posterUrl = localResourceUrl(`meta/${entry.itemId}/primary.jpg`);
  const live = useFileProgress(entry.id);

  const bytesDone = live?.bytesDone ?? entry.bytesDone;
  const expected = live?.expectedSize ?? entry.expectedSize;
  const pct = expected && expected > 0 ? Math.min(100, (bytesDone / expected) * 100) : null;
  const isActive = ACTIVE.has(entry.status) || entry.status === "error";

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
    <div className="flex items-center gap-3 rounded-xl bg-fill-faint p-3 transition-colors hover:bg-fill-subtle">
      <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-md bg-surface-2">
        {posterUrl && !posterFailed && (
          <img
            src={posterUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPlay?.(entry)}
            disabled={entry.status !== "complete" || !onPlay}
            className="truncate text-left text-sm font-semibold text-content-primary disabled:cursor-default"
          >
            {displayTitle}
          </button>
          <StatusBadge status={entry.status} errorCode={entry.errorCode} />
        </div>
        <p className="mt-0.5 text-xs text-content-quaternary">{meta.join(" · ")}</p>
        {isActive && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill-soft">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${pct ?? (entry.status === "downloading" ? 8 : 0)}%` }}
              />
            </div>
            <span className="w-24 flex-shrink-0 text-right text-[10px] tabular-nums text-content-quaternary">
              {formatBytes(bytesDone)}
              {expected ? ` / ${formatBytes(expected)}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        {entry.status === "downloading" || entry.status === "queued" ? (
          <SmallAction label={t("pause")} onClick={() => void pauseDownload(entry.id)} glyph="pause" />
        ) : null}
        {entry.status === "paused" || entry.status === "error" ? (
          <SmallAction label={t("resume")} onClick={() => void resumeDownload(entry.id)} glyph="play" />
        ) : null}
        {ACTIVE.has(entry.status) ? (
          <SmallAction label={t("cancelTransfer")} onClick={() => void cancelDownload(entry.id)} glyph="stop" />
        ) : null}
        {entry.status === "complete" && (
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-fill-subtle px-2 py-1.5 text-[10px] font-medium text-content-tertiary transition-colors hover:bg-fill-soft"
            title={t("autoDeleteAfterWatch")}
          >
            <input
              type="checkbox"
              checked={entry.autoDeleteAfterWatch}
              onChange={(e) => void setAutoDeleteAfterWatch(userId, entry.id, e.target.checked)}
              className="h-3 w-3 accent-[var(--brand)]"
            />
            {t("autoDeleteShort")}
          </label>
        )}
        <SmallAction label={t("delete")} onClick={() => onDelete(entry)} glyph="trash" danger />
      </div>
    </div>
  );
}

function StatusBadge({ status, errorCode }: { status: DownloadEntry["status"]; errorCode: string | null }) {
  const { t } = useTranslation("downloads");
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: t("statusQueued"), className: "bg-status-info-bg text-status-info-fg" },
    downloading: { label: t("statusDownloading"), className: "bg-status-info-bg text-status-info-fg" },
    paused: { label: t("statusPaused"), className: "bg-status-warning-bg text-status-warning-fg" },
    complete: { label: t("statusComplete"), className: "bg-status-success-bg text-status-success-fg" },
    error: {
      label: errorCode === "disk-full" ? t("errorDiskFull") : t("statusError"),
      className: "bg-status-error-bg text-status-error-fg",
    },
    canceled: { label: t("statusCanceled"), className: "bg-fill-soft text-content-tertiary" },
  };
  const badge = map[status];
  if (!badge) return null;
  return (
    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function SmallAction({
  label,
  onClick,
  glyph,
  danger,
}: {
  label: string;
  onClick: () => void;
  glyph: "pause" | "play" | "stop" | "trash";
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
        danger
          ? "text-status-error-fg hover:bg-danger-surface"
          : "text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
      }`}
    >
      <Glyph name={glyph} />
    </button>
  );
}

function Glyph({ name }: { name: "pause" | "play" | "stop" | "trash" }) {
  const common = { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
  switch (name) {
    case "pause":
      return (
        <svg {...common}><path strokeLinecap="round" d="M10 5v14M14 5v14" /></svg>
      );
    case "play":
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M6 5l12 7-12 7V5z" /></svg>
      );
    case "stop":
      return (
        <svg {...common}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      );
  }
}
