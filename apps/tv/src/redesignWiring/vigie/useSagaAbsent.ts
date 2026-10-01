import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SagaExternalEntry, SagaView } from "@tentacle-tv/shared";
import type { AbsentModel } from "../../redesign/cards/cardTypes";
import { notInLibrary } from "../cards/absentCards";
import { absentTitle, type AbsentTitle } from "./absentTitle";
import { useAbsentStates } from "./useAbsentStates";
import type { VigieGate } from "./useVigieGate";

/**
 * L'entrée « collection » des demandes (fiche d'un film, rangée de sa saga) :
 * ce que la garde Vigie change aux volets ABSENTS. Garde fermée : le badge
 * « Pas dans la bibliothèque », pas d'appui maintenu — et OK dit « pas
 * disponible ». Garde ouverte : leur état (`useAbsentStates`), l'indication
 * du geste sous la carte focalisée, le grand panneau à l'appui maintenu.
 */

export interface SagaAbsentFace {
  absent: AbsentModel;
  focusNote?: string;
  holdable: boolean;
}

export interface SagaAbsent {
  faceOf: (entry: SagaExternalEntry) => SagaAbsentFace;
  /** Le titre absent derrière la carte d'un volet (sa clé de saga). */
  titleOf: (entryKey: string) => AbsentTitle | undefined;
}

export function useSagaAbsent(view: SagaView | null, gate: VigieGate | null): SagaAbsent {
  const { t } = useTranslation();
  const titles = useMemo(() => {
    const map = new Map<string, AbsentTitle>();
    for (const entry of view?.entries ?? []) {
      if (entry.kind !== "external" || !entry.item.tmdbId) continue;
      const { kind, tmdbId, title, year, imageUrl } = entry.item;
      map.set(entry.key, absentTitle(kind, tmdbId, title, year, imageUrl));
    }
    return map;
  }, [view]);
  const keys = useMemo(() => [...titles.values()].map((title) => title.key), [titles]);
  const states = useAbsentStates(gate, keys);

  const faceOf = useCallback((entry: SagaExternalEntry): SagaAbsentFace => {
    const title = titles.get(entry.key);
    if (!states || !title) return { absent: notInLibrary(t), holdable: false };
    return { absent: states.absentOf(title.key), focusNote: states.hintOf(title.key), holdable: true };
  }, [titles, states, t]);
  const titleOf = useCallback((entryKey: string) => titles.get(entryKey), [titles]);
  return useMemo(() => ({ faceOf, titleOf }), [faceOf, titleOf]);
}
