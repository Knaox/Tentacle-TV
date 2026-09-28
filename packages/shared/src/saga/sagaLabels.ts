/**
 * Ce que dit la rangée « saga » : son titre, sa ligne de résumé (« 8 films ·
 * 6 dans la bibliothèque · 2 vus ») et l'étiquette de chaque volet (« Volet 4
 * · Cette fiche »), posée à côté de sa carte — qui, elle, garde son titre et
 * son année. Une seule écriture pour toutes les plateformes.
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

export interface SagaLabel {
  /** « Volet 4 » — null sans TMDB. */
  rank: string | null;
  /** « Cette fiche », « Reprendre », « À suivre » — ce qui distingue la carte, mis en valeur. */
  cue: string | null;
}

export function sagaLabel(t: TFunction, entry: SagaEntry): SagaLabel {
  return {
    rank: entry.position !== null ? t("media:sagaPart", { position: entry.position }) : null,
    cue: entry.cue !== null ? t(CUE_KEYS[entry.cue]) : null,
  };
}

/** L'étiquette en une ligne (lecteurs d'écran, téléviseurs) : « Volet 4 · Cette fiche ». */
export function sagaLabelText(label: SagaLabel): string | null {
  const line = [label.rank, label.cue].filter((part): part is string => part !== null).join(" · ");
  return line === "" ? null : line;
}
