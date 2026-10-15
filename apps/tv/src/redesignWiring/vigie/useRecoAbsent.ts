import { useCallback, useMemo } from "react";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { titleKey } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { absentCard, tmdbPosterUri } from "../cards/absentCards";
import { absentTitle, type AbsentTitle } from "./absentTitle";
import { useAbsentStates } from "./useAbsentStates";
import type { VigieGate } from "./useVigieGate";

/**
 * L'entrée « recommandations » des demandes : les titres que le moteur
 * propose et que la bibliothèque n'a PAS (`jellyfinItemId` nul), sur « Pour
 * vous » et les rangées reco de l'accueil. Mêmes cartes que la rangée « À
 * demander » de la recherche : affiche TMDB grisée, badge de l'état
 * (`useAbsentStates`), « OK : demander » sous la carte focalisée — à défaut,
 * la raison de la recommandation. Garde Vigie fermée : `null`, et l'écran ne
 * montre que la bibliothèque (tv-core `tvRecoShelves`, sans `external`).
 */

export interface RecoAbsent {
  /** La carte d'une recommandation absente ; `note` : sa raison, quand OK ne demanderait rien. */
  cardOf: (reco: RecoRowItem, note?: string) => CardModel;
  /** Le titre absent derrière une carte (son identifiant `absent:<clé>`). */
  titleOf: (cardId: string) => AbsentTitle | undefined;
}

/** L'identifiant d'une carte absente : jamais celui d'un item Jellyfin. */
export const recoAbsentCardId = (reco: Pick<RecoRowItem, "key">) => `absent:${reco.key}`;

export function recoAbsentTitle(reco: RecoRowItem): AbsentTitle {
  return absentTitle(reco.mediaType === "tv" ? "series" : "movie", reco.tmdbId, reco.title, reco.year, tmdbPosterUri(reco.posterPath) ?? null);
}

export function useRecoAbsent(gate: VigieGate | null, recos: readonly RecoRowItem[]): RecoAbsent | null {
  const titles = useMemo(() => {
    const map = new Map<string, AbsentTitle>();
    for (const reco of recos) if (reco.jellyfinItemId === null) map.set(recoAbsentCardId(reco), recoAbsentTitle(reco));
    return map;
  }, [recos]);
  const keys = useMemo(() => [...titles.values()].map((title) => title.key), [titles]);
  const states = useAbsentStates(gate, keys);

  const cardOf = useCallback(
    (reco: RecoRowItem, note?: string): CardModel => {
      const key = titleKey(reco.mediaType, reco.tmdbId);
      const absent = states ? states.absentOf(key) : undefined;
      return {
        ...absentCard({
          id: recoAbsentCardId(reco),
          title: reco.title,
          year: reco.year,
          posterUri: tmdbPosterUri(reco.posterPath),
          absent: absent ?? { label: "", tone: "neutral" },
        }),
        focusNote: states?.hintOf(key) ?? note,
      };
    },
    [states],
  );
  const titleOf = useCallback((cardId: string) => titles.get(cardId), [titles]);

  return useMemo(() => (states ? { cardOf, titleOf } : null), [states, cardOf, titleOf]);
}
