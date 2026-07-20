/**
 * Fiche locale (mode Hors ligne) : panneau modal alimenté par le snapshot
 * `meta/<itemId>/item.json` (protocole asset Tauri) — synopsis, méta,
 * bouton Lire. Aucune requête serveur. Tokens de thème, animation CSS pure.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DownloadEntry } from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { formatBytes } from "./presets";

interface SnapshotItem {
  Name?: string;
  Overview?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  OfficialRating?: string;
  CommunityRating?: number;
}

export function OfflineItemSheet({ entry, onClose }: { entry: DownloadEntry; onClose: () => void }) {
  const { t } = useTranslation(["downloads", "common"]);
  const navigate = useNavigate();
  const [item, setItem] = useState<SnapshotItem | null>(null);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const rootReady = useDownloadsRootReady();
  const backdropUrl = localResourceUrl(`meta/${entry.itemId}/backdrop.jpg`);

  useEffect(() => {
    if (!rootReady) return;
    const url = localResourceUrl(`meta/${entry.itemId}/item.json`);
    if (!url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SnapshotItem | null) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.itemId, rootReady]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title = item?.Name ?? entry.title ?? entry.itemId;
  const episodeCode =
    entry.kind === "episode" && item?.ParentIndexNumber != null && item?.IndexNumber != null
      ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")}`
      : null;
  const runtimeMinutes = item?.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : null;
  const metaBits = [
    entry.seriesName && episodeCode ? `${entry.seriesName} — ${episodeCode}` : null,
    item?.ProductionYear ? String(item.ProductionYear) : null,
    runtimeMinutes ? `${runtimeMinutes} min` : null,
    entry.variant === "original" ? t("downloads:variantOriginal") : t("downloads:variantLight"),
    formatBytes(entry.bytesDone),
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "var(--glass-backdrop)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg origin-center animate-scale-in overflow-hidden rounded-2xl border border-line-subtle"
        style={{
          background: "var(--surface-modal)",
          boxShadow: "var(--shadow-modal)",
          backdropFilter: "blur(var(--blur-modal))",
          WebkitBackdropFilter: "blur(var(--blur-modal))",
        }}
      >
        {backdropUrl && !backdropFailed && (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={backdropUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBackdropFailed(true)}
            />
            {/* Scrim posé sur image : noir constant dans les deux thèmes. */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, transparent 20%, var(--surface-modal) 100%)" }}
            />
          </div>
        )}

        <div className="px-5 pb-5 pt-4">
          <h2 className="text-lg font-bold text-content-primary">{title}</h2>
          <p className="mt-1 text-xs text-content-quaternary">{metaBits.join(" · ")}</p>
          {item?.Overview && (
            <p className="mt-3 max-h-40 overflow-y-auto text-sm leading-relaxed text-content-tertiary">
              {item.Overview.replace(/<[^>]+>/g, "")}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-cta-ghost-bg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
            >
              {t("common:close")}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/watch/${entry.itemId}`)}
              className="flex items-center gap-2 rounded-md bg-cta-primary-bg px-5 py-2 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              {t("common:play")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
