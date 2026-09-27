/**
 * Écran « Téléchargements » (/downloads, desktop uniquement).
 * En-tête de synthèse (compteurs, espace, avancement global, gestes sur la
 * file, mode hors ligne), puis les sections repliables : transferts en cours,
 * films, séries (groupées). Suppression confirmée (refcount côté moteur),
 * états vides. Invisible sans droit ET sans contenu (redirection racine) —
 * décision « droit retiré → l'existant reste lisible ».
 */

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { supportsDownloads } from "../desktop/bridge";
import { deleteDownload, setAutoDeleteAfterWatch, type DownloadEntry } from "./api";
import { DownloadRow } from "./DownloadRow";
import { DownloadsBulkBar } from "./DownloadsBulkBar";
import { DownloadsEmptyState } from "./DownloadsEmptyState";
import { DownloadsOverview } from "./DownloadsOverview";
import { DownloadsSection } from "./DownloadsSection";
import {
  byEpisodeNumber,
  pruneSelection as prune,
  readyBytesOf,
  selectionState,
  toggleAllSelection as toggleAll,
  toggleSelection as toggleOne,
} from "@tentacle-tv/offline-core";
import { formatBytes } from "./presets";
import { DeleteDownloadModal } from "./DeleteDownloadModal";
import { useDownloadsList, useDownloadsVisibility, DOWNLOADS_LIST_QUERY_KEY, DOWNLOAD_STATE_QUERY_KEY, DISK_INFO_QUERY_KEY } from "./useDownloadState";
import { clearProgress } from "@tentacle-tv/offline-core/react";

const ACTIVE = new Set(["queued", "downloading", "paused", "error"]);

export function DownloadsPage() {
  const { t } = useTranslation(["downloads", "nav"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { visible } = useDownloadsVisibility();
  const entries = useDownloadsList();
  const [toDelete, setToDelete] = useState<DownloadEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectionActive, setSelectionActive] = useState(false);
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const ids = useMemo(() => entries.map((e) => e.id), [entries]);

  // La liste se rafraîchit toute seule à chaque `downloads://changed` : un
  // transfert qui finit ou une purge différée peut emporter une ligne cochée.
  // Sans cet élagage, le compteur promettrait des suppressions fantômes.
  useEffect(() => {
    setSelection((prev) => {
      const next = prune(prev, ids);
      return next.size === prev.size ? prev : next;
    });
  }, [ids]);

  const groups = useMemo(() => {
    const active = entries.filter((e) => ACTIVE.has(e.status));
    const movies = entries.filter((e) => e.status === "complete" && e.kind !== "episode");
    const episodes = entries.filter((e) => e.status === "complete" && e.kind === "episode");
    const seriesMap = new Map<string, DownloadEntry[]>();
    for (const episode of episodes) {
      const key = episode.seriesName ?? episode.seriesId ?? "?";
      const bucket = seriesMap.get(key);
      if (bucket) bucket.push(episode);
      else seriesMap.set(key, [episode]);
    }
    // Dans sa section, une série se lit dans l'ordre de diffusion, pas d'ajout.
    for (const bucket of seriesMap.values()) bucket.sort(byEpisodeNumber);
    return { active, movies, series: [...seriesMap.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [entries]);

  if (!supportsDownloads() || !visible) return <Navigate to="/" replace />;

  const handleDeleteConfirm = async () => {
    if (!toDelete || !userId) return;
    setDeleting(true);
    await deleteDownload(userId, toDelete.id);
    clearProgress(toDelete.id);
    setDeleting(false);
    setToDelete(null);
    queryClient.invalidateQueries({ queryKey: [DOWNLOADS_LIST_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [DOWNLOAD_STATE_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [DISK_INFO_QUERY_KEY] });
  };

  const handlePlay = (entry: DownloadEntry) => navigate(`/watch/${entry.itemId}`);

  const refresh = () => {
    for (const key of [DOWNLOADS_LIST_QUERY_KEY, DOWNLOAD_STATE_QUERY_KEY, DISK_INFO_QUERY_KEY]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  /**
   * Applique un réglage d'auto-suppression à toute la sélection.
   *
   * En SÉRIE et non en parallèle : chaque appel écrit dans la même base SQLite
   * par IPC, et le moteur diffuse un `downloads://changed` à chacun. Vingt-quatre
   * écritures concurrentes feraient vingt-quatre invalidations de liste.
   */
  const applyAutoDelete = async (delayMinutes: number | null) => {
    if (!userId) return;
    setDeleting(true);
    for (const fileId of selection) {
      await setAutoDeleteAfterWatch(userId, fileId, delayMinutes != null, delayMinutes ?? 0);
    }
    setDeleting(false);
    refresh();
  };

  const deleteSelection = async () => {
    if (!userId) return;
    setDeleting(true);
    for (const fileId of selection) {
      await deleteDownload(userId, fileId);
      clearProgress(fileId);
    }
    setDeleting(false);
    setBulkConfirm(false);
    setSelection(new Set());
    setSelectionActive(false);
    refresh();
  };

  const exitSelection = () => {
    setSelectionActive(false);
    setSelection(new Set());
  };

  const toggle = (id: number) => setSelection((prev) => toggleOne(prev, id));

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-24 md:px-8">
      <h1 className="text-2xl font-bold text-content-primary">{t("nav:downloads")}</h1>

      <div className="mt-4">
        <DownloadsOverview entries={entries} />
      </div>

      {entries.length === 0 ? (
        <DownloadsEmptyState />
      ) : (
        <div className="mt-6 space-y-4">
          <DownloadsBulkBar
            active={selectionActive}
            count={selection.size}
            state={selectionState(selection, ids)}
            onEnter={() => setSelectionActive(true)}
            onExit={exitSelection}
            onToggleAll={() => setSelection((prev) => toggleAll(prev, ids))}
            onAutoDelete={(value) => void applyAutoDelete(value)}
            onDelete={() => setBulkConfirm(true)}
            busy={deleting}
          />

          <div className="space-y-8">
          {groups.active.length > 0 && (
            <DownloadsSection title={t("downloads:sectionActive")} summary={String(groups.active.length)}>
              {groups.active.map((entry) => (
                <DownloadRow
                  key={entry.id}
                  entry={entry}
                  userId={userId ?? ""}
                  onDelete={setToDelete}
                  {...(selectionActive
                    ? { selection: { selected: selection.has(entry.id), onToggle: toggle } }
                    : {})}
                />
              ))}
            </DownloadsSection>
          )}

          {groups.movies.length > 0 && (
            <DownloadsSection title={t("downloads:sectionMovies")} summary={sizeSummary(t("downloads:deviceTitles", { count: groups.movies.length }), groups.movies)}>
              {groups.movies.map((entry) => (
                <DownloadRow
                  key={entry.id}
                  entry={entry}
                  userId={userId ?? ""}
                  onDelete={setToDelete}
                  {...(selectionActive
                    ? { selection: { selected: selection.has(entry.id), onToggle: toggle } }
                    : {})}
                  onPlay={handlePlay}
                />
              ))}
            </DownloadsSection>
          )}

          {groups.series.map(([seriesName, seriesEntries]) => (
            <DownloadsSection key={seriesName} title={seriesName} summary={sizeSummary(t("downloads:episodesCount", { count: seriesEntries.length }), seriesEntries)}>
              {seriesEntries.map((entry) => (
                <DownloadRow
                  key={entry.id}
                  entry={entry}
                  userId={userId ?? ""}
                  hideSeries
                  onDelete={setToDelete}
                  {...(selectionActive
                    ? { selection: { selected: selection.has(entry.id), onToggle: toggle } }
                    : {})}
                  onPlay={handlePlay}
                />
              ))}
            </DownloadsSection>
          ))}
          </div>
        </div>
      )}

      {bulkConfirm && (
        <DeleteDownloadModal
          heading={t("downloads:bulkDeleteConfirmTitle", { count: selection.size })}
          message={t("downloads:bulkDeleteConfirmMessage")}
          busy={deleting}
          onConfirm={() => void deleteSelection()}
          onClose={() => setBulkConfirm(false)}
        />
      )}

      {toDelete && (
        <DeleteDownloadModal
          title={
            toDelete.kind === "episode" && toDelete.seriesName
              ? `${toDelete.seriesName} — ${toDelete.title ?? toDelete.itemId}`
              : (toDelete.title ?? toDelete.itemId)
          }
          busy={deleting}
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

/** « 12 épisodes · 18,4 Gio » : le compte et l'espace d'une section. */
function sizeSummary(count: string, entries: readonly DownloadEntry[]): string {
  return `${count} · ${formatBytes(readyBytesOf(entries))}`;
}
