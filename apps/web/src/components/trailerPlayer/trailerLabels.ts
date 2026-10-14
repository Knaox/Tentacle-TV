/**
 * Ce que la liste du lecteur dit d'une bande-annonce : sa portée (« Saison 6 »),
 * sa version (VF, VOSTFR, VO pour un serveur français — `trailerVersionLabelKey`,
 * shared) et son origine (AlloCiné, YouTube, Dailymotion).
 */

import type { TFunction } from "i18next";
import { trailerOriginLabel, trailerVersionLabelKey, type TrailerQueueItem, type TrailerScope } from "@tentacle-tv/shared";

export interface TrailerItemLabels {
  scope: string | null;
  version: string | null;
  origin: string;
}

function scopeLabel(scope: TrailerScope | undefined, t: TFunction): string | null {
  if (!scope) return null;
  if (scope.kind === "season") return t("common:trailerScopeSeason", { season: scope.season });
  return scope.kind === "series" ? t("common:trailerScopeSeries") : null;
}

export function trailerItemLabels(item: TrailerQueueItem, language: string | null, t: TFunction): TrailerItemLabels {
  const versionKey = trailerVersionLabelKey(item.version, language);
  return {
    scope: scopeLabel(item.scope, t),
    version: versionKey ? t(`common:trailerVersion_${versionKey}`) : null,
    origin: t(`common:trailerOrigin_${trailerOriginLabel(item)}`),
  };
}
