/**
 * L'hôte des demandes de téléchargement venues des CARTES.
 *
 * Monté UNE fois, hors de l'arbre des cartes : le bouton qui déclenche est
 * démonté dès que le curseur quitte sa carte (cf. `downloadRequest.ts`), il ne
 * peut donc ni porter le dialogue, ni attendre une requête.
 *
 * Il résout ce qu'il faut avant d'ouvrir :
 *   • une SÉRIE  → ses épisodes (une requête), puis les cases par saison ;
 *   • un film ou un épisode → tout de suite, sauf si l'item ne porte pas ses
 *     `MediaSources` (cf. la garde ci-dessous).
 * Pas de Framer ici non plus — c'est la règle de toute la feature.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSeriesEpisodes } from "@tentacle-tv/api-client";
import { DownloadDialog } from "./DownloadDialog";
import { clearDownloadRequest, useDownloadRequest } from "./downloadRequest";
import { useToast } from "../contexts/ToastContext";

export function DownloadRequestHost() {
  const { t } = useTranslation(["downloads", "common"]);
  const { show } = useToast();
  const request = useDownloadRequest();
  const item = request?.item ?? null;
  const isSeries = item?.Type === "Series";

  // Une série : tous ses épisodes avec leurs pistes, en une requête.
  const { data: episodes, isError: seriesFailed } = useSeriesEpisodes(
    isSeries && item !== null ? item.Id : undefined,
    { enabled: isSeries },
  );

  /**
   * Le dialogue lit `MediaSources[0]` — taille exacte, conteneur, pistes audio,
   * side-cars de sous-titres (cf. `downloadTargets.ts`). Toutes les requêtes qui
   * alimentent des cartes demandent bien `Fields=…,MediaSources`, mais on ne le
   * SUPPOSE pas : sans lui, l'enqueue partirait en `.mkv` de taille inconnue et
   * l'échec serait silencieux, en aval, chez l'utilisateur. Une requête, et
   * seulement quand le champ manque.
   */
  const needsFull = item !== null && !isSeries && item.MediaSources?.[0] === undefined;
  const { data: full, isError: fullFailed } = useMediaItem(
    needsFull ? item.Id : undefined,
    { enabled: needsFull },
  );

  // Une série sans épisodes lisibles n'a rien à montrer : on abandonne en le
  // disant. Un film, lui, s'ouvre quand même avec ce qu'on a — mieux vaut un
  // téléchargement approximatif qu'un clic mort.
  const seriesEmpty = isSeries && episodes !== undefined && episodes.length === 0;
  useEffect(() => {
    if (!isSeries) return;
    if (!seriesFailed && !seriesEmpty) return;
    show("error", t("downloads:scopeFailed"));
    clearDownloadRequest();
  }, [isSeries, seriesFailed, seriesEmpty, show, t]);

  if (item === null) return null;

  if (isSeries) {
    if (seriesFailed || seriesEmpty) return null;
    if (episodes === undefined) return <ResolvingVeil label={t("common:loading")} />;
    return <DownloadDialog items={episodes} mode="series" onClose={clearDownloadRequest} />;
  }

  const resolved = needsFull ? (full ?? (fullFailed ? item : null)) : item;
  if (resolved === null) return <ResolvingVeil label={t("common:loading")} />;
  return <DownloadDialog items={[resolved]} onClose={clearDownloadRequest} />;
}

/**
 * Le temps de la résolution. Il ne sert pas qu'à faire patienter : le bouton
 * d'origine a pu disparaître sous la souris, il ne peut donc pas se griser
 * lui-même — sans ce voile, rien n'empêcherait un deuxième clic.
 */
function ResolvingVeil({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
    </div>
  );
}
