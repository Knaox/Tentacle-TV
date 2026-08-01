/**
 * Écran « Téléchargements » (/downloads, desktop uniquement).
 * Sections : transferts en cours, films, séries (groupées). Jauge d'espace,
 * suppression confirmée (refcount côté moteur), états vides. Invisible sans
 * droit ET sans contenu (redirection racine) — décision « droit retiré →
 * l'existant reste lisible ».
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
import { basculer, elaguer, etat as etatSelection, toutBasculer } from "./selection";
import { DownloadsSpaceBar } from "./DownloadsSpaceBar";
import { DeleteDownloadModal } from "./DeleteDownloadModal";
import { useDownloadsList, useDownloadsVisibility, DOWNLOADS_LIST_QUERY_KEY, DOWNLOAD_STATE_QUERY_KEY, DISK_INFO_QUERY_KEY } from "./useDownloadState";
import { clearProgress } from "./progressStore";

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
    setSelection((avant) => {
      const apres = elaguer(avant, ids);
      return apres.size === avant.size ? avant : apres;
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

  const rafraichir = () => {
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
  const appliquerAutoDelete = async (delayMinutes: number | null) => {
    if (!userId) return;
    setDeleting(true);
    for (const fileId of selection) {
      await setAutoDeleteAfterWatch(userId, fileId, delayMinutes != null, delayMinutes ?? 0);
    }
    setDeleting(false);
    rafraichir();
  };

  const supprimerSelection = async () => {
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
    rafraichir();
  };

  const quitterSelection = () => {
    setSelectionActive(false);
    setSelection(new Set());
  };

  const toggle = (id: number) => setSelection((avant) => basculer(avant, id));

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 pb-16 pt-24 md:px-8">
      <h1 className="text-2xl font-bold text-content-primary">{t("nav:downloads")}</h1>

      <div className="mt-4">
        <DownloadsSpaceBar />
      </div>

      {entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-content-secondary">{t("downloads:emptyTitle")}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-content-quaternary">
            {t("downloads:emptyMessage")}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <DownloadsBulkBar
            actif={selectionActive}
            compte={selection.size}
            etat={etatSelection(selection, ids)}
            onEntrer={() => setSelectionActive(true)}
            onSortir={quitterSelection}
            onToutBasculer={() => setSelection((avant) => toutBasculer(avant, ids))}
            onAutoDelete={(value) => void appliquerAutoDelete(value)}
            onSupprimer={() => setBulkConfirm(true)}
            occupe={deleting}
          />

          <div className="space-y-8">
          {groups.active.length > 0 && (
            <Section title={t("downloads:sectionActive")}>
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
            </Section>
          )}

          {groups.movies.length > 0 && (
            <Section title={t("downloads:sectionMovies")}>
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
            </Section>
          )}

          {groups.series.map(([seriesName, seriesEntries]) => (
            <Section key={seriesName} title={seriesName}>
              {seriesEntries.map((entry) => (
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
            </Section>
          ))}
          </div>
        </div>
      )}

      {bulkConfirm && (
        <DeleteDownloadModal
          heading={t("downloads:bulkDeleteConfirmTitle", { count: selection.size })}
          message={t("downloads:bulkDeleteConfirmMessage")}
          busy={deleting}
          onConfirm={() => void supprimerSelection()}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-quaternary">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
