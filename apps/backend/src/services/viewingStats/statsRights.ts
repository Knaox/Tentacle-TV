/**
 * Les statistiques d'un compte face à ses droits D'AUJOURD'HUI
 * (docs/DROITS-UTILISATEURS.md § 9.5).
 *
 * Ce que Jellyfin rend du passé (vus, favoris) est déjà jugé par lui. Ce que
 * Tentacle garde lui-même ne l'est pas : les séances mesurées
 * (`watch_segments`, avec le NOM du titre) et le profil de goût (ancres et
 * « Ma liste »). Un titre regardé ou aimé AVANT qu'une note maximale ou une
 * bibliothèque refusée ne le cache revenait, nom et identifiant compris, sur la
 * page des statistiques (lu dans le code au banc du contrôle parental).
 *
 * La règle : pour un compte que sa politique peut priver de quelque chose
 * (restreint, ou bibliothèques bornées), une séance d'un titre que la
 * bibliothèque lui CACHE ne compte plus (un titre supprimé depuis, lui, garde
 * sa place : il n'est pas caché) ; un titre du goût passe les mêmes droits
 * qu'une recommandation (`reco/recoRights.ts`). Droits illisibles : les séances
 * mesurées partent, ce que Jellyfin a jugé reste — fermé à l'échec. Un compte
 * libre : rien n'est lu de plus.
 */

import { getContentPolicy, limitsLibraries } from "../contentPolicy";
import { filterByRights } from "../reco/recoRights";
import { libraryRightsFor } from "../search/libraryRights";
import type { ViewingStatsTaste } from "./contract";
import type { MeasuredHistory } from "./measuredHistory";

export interface StatsRights {
  measured(history: MeasuredHistory): MeasuredHistory;
  taste(taste: ViewingStatsTaste): Promise<ViewingStatsTaste>;
}

/** `null` : rien à filtrer (compte libre). */
export async function statsRightsFor(userId: string): Promise<StatsRights | null> {
  const policy = await getContentPolicy(userId);
  if (!policy.restricted && !limitsLibraries(policy)) return null;
  const rights = await libraryRightsFor(userId);
  const hides = (titleId: string) => rights === null || rights.hidesItem(titleId);
  const allowed = async <T extends { mediaType: "movie" | "tv"; tmdbId: number; jellyfinId: string | null }>(titles: T[]) => {
    const kept = await filterByRights(userId, titles.map((t, index) => ({
      mediaType: t.mediaType, tmdbId: t.tmdbId, jellyfinItemId: t.jellyfinId, index,
    })));
    return kept.map((k) => titles[k.index]);
  };
  return {
    measured: (history) => ({
      entries: history.entries.filter((entry) => !hides(entry.titleId)),
      movieNames: new Map([...history.movieNames].filter(([id]) => !hides(id))),
      seriesNames: new Map([...history.seriesNames].filter(([id]) => !hides(id))),
    }),
    taste: async (taste) => ({
      ...taste,
      loved: await allowed(taste.loved),
      potential: taste.potential === null ? null : { ...taste.potential, titles: await allowed(taste.potential.titles) },
    }),
  };
}
