/**
 * Ce que dit la rangée « saga » : son titre, sa ligne de résumé (« 8 films ·
 * 6 dans la bibliothèque · 2 vus ») et la petite ligne de chaque carte
 * (« Volet 4 · Cette fiche »). Une seule écriture pour toutes les plateformes.
 */

import type { TFunction } from "i18next";
import type { SagaEntry, SagaView } from "./sagaModel";

/** Le nom de la saga selon TMDB, ou un titre générique sans TMDB. */
export function sagaTitle(t: TFunction, view: SagaView): string {
  return view.name ?? t("media:sagaFallbackTitle");
}

export function sagaSummary(t: TFunction, view: SagaView): string {
  const parts: string[] = [];
  if (view.partCount !== null) parts.push(t("media:sagaFilms", { count: view.partCount }));
  parts.push(t("media:sagaInLibrary", { count: view.inLibrary }));
  if (view.watched > 0) parts.push(t("media:sagaWatched", { count: view.watched }));
  return parts.join(" · ");
}

const CUE_KEYS = { current: "media:sagaCurrent", resume: "media:sagaResume", upNext: "media:sagaUpNext" } as const;

/**
 * La petite ligne d'une carte : son rang dans la saga, puis ce qui la
 * distingue (la fiche ouverte, à reprendre, à suivre), à défaut son année —
 * ou, pour un volet manquant, la ligne que le plugin a écrite.
 */
export function sagaCaption(t: TFunction, entry: SagaEntry): string | null {
  const rank = entry.position !== null ? t("media:sagaPart", { position: entry.position }) : null;
  let detail: string | null;
  if (entry.cue !== null) detail = t(CUE_KEYS[entry.cue]);
  else if (entry.kind === "external") detail = entry.item.subtitle ?? (entry.item.year !== null ? String(entry.item.year) : null);
  else detail = entry.item.ProductionYear != null ? String(entry.item.ProductionYear) : null;
  const line = [rank, detail].filter((part): part is string => part !== null).join(" · ");
  return line === "" ? null : line;
}
