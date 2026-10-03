import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMyTitles, useSeriesGaps } from "@tentacle-tv/api-client";
import { seriesTitleKey, type MyTitle, type SearchMediaItem, type SearchResponse } from "@tentacle-tv/shared";
import { seriesGapPress } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { absentCard } from "../cards/absentCards";
import { showNotice } from "../overlays/transientNotice";
import { absentFromMine, mineLabel } from "./absentStates";
import type { AbsentTitle } from "./absentTitle";
import type { TitleRequests } from "./useTitleRequests";
import type { VigieGate } from "./useVigieGate";

/**
 * L'entrée « recherche » des saisons MANQUANTES (garde Vigie ouverte) : une
 * série que la bibliothèque a, mais à qui il manque des saisons que
 * l'extension offre (`titles.gaps`, une question pour toute la recherche),
 * paraît AUSSI dans la rangée « À demander » — en tête, puisqu'on la
 * cherchait —, grisée comme les titres absents, son badge disant « 2 saisons
 * à demander ». Sa carte de la bibliothèque reste dans sa rangée et ouvre la
 * fiche ; celle-ci ouvre la feuille de ses saisons (« OK : choisir les
 * saisons »), et l'appui maintenu le panneau de la série.
 *
 * Une série dont le compte attend déjà des saisons y reste, son badge disant
 * où en est sa demande (`mine`) ; sans plus rien à demander, OK le redit.
 */

export interface SearchGap {
  title: AbsentTitle;
  seriesId: string;
  /** Les saisons qui se demandent encore. */
  count: number;
  /** La demande du compte, s'il en attend une. */
  mine: MyTitle | undefined;
}

export interface SearchGaps {
  cards: CardModel[];
  /** La série derrière une carte de la rangée. */
  gapOf: (cardId: string) => SearchGap | undefined;
}

const cardIdOf = (seriesId: string) => `gap:${seriesId}`;

/** Les séries d'une réponse : le meilleur résultat s'il en est une, puis la rangée des séries. */
function seriesOf(response: SearchResponse | undefined): SearchMediaItem[] {
  const top = response?.top;
  const first = top?.kind === "item" && top.hit.item.Type === "Series" ? [top.hit.item] : [];
  return [...first, ...(response?.series ?? []).map((hit) => hit.item)];
}

export function useSearchGaps(
  gate: VigieGate | null,
  response: SearchResponse | undefined,
  posterOf: (item: SearchMediaItem) => string | undefined,
): SearchGaps | null {
  const { t } = useTranslation();
  const provider = gate?.provider ?? null;
  const lang = gate?.lang ?? "fr";
  const open = gate !== null && provider?.seasonsPath != null;
  const series = useMemo(() => seriesOf(response), [response]);
  const gaps = useSeriesGaps(provider, series, lang, { enabled: open });
  const { titles: mine } = useMyTitles(provider, lang, { enabled: open });

  const found = useMemo(() => {
    if (!open) return [];
    const mineOf = new Map((mine ?? []).map((m) => [m.key, m]));
    const out: SearchGap[] = [];
    const seen = new Set<string>();
    for (const item of series) {
      const key = seriesTitleKey(item);
      if (!key || seen.has(item.Id)) continue;
      seen.add(item.Id);
      const count = gaps.get(item.Id)?.count ?? 0;
      const own = mineOf.get(key);
      if (count === 0 && !own) continue;
      out.push({
        title: { key, title: item.Name, year: item.ProductionYear ?? null, imageUrl: posterOf(item) ?? null },
        seriesId: item.Id,
        count,
        mine: own,
      });
    }
    return out;
  }, [open, series, gaps, mine, posterOf]);

  const cards = useMemo<CardModel[]>(
    () => found.map((gap) => ({
      ...absentCard({
        id: cardIdOf(gap.seriesId),
        title: gap.title.title,
        year: gap.title.year,
        posterUri: gap.title.imageUrl ?? undefined,
        absent: gap.mine ? absentFromMine(t, gap.mine) : { label: t("requests:missingSeasons", { count: gap.count }), tone: "neutral" },
      }),
      focusNote: gap.count > 0 ? t("requests:hintSeasons") : undefined,
    })),
    [found, t],
  );
  const byId = useMemo(() => new Map(found.map((gap) => [cardIdOf(gap.seriesId), gap])), [found]);
  const gapOf = useCallback((cardId: string) => byId.get(cardId), [byId]);

  return useMemo(() => (open ? { cards, gapOf } : null), [open, cards, gapOf]);
}

/**
 * OK sur une série incomplète de la rangée : la feuille de ses saisons, entrée
 * sur la première à cocher ; plus rien à demander, sa demande en cours le dit.
 */
export function openSearchGap(requests: TitleRequests, gap: SearchGap, t: TFunction): void {
  const press = seriesGapPress({ missing: gap.count, mine: gap.mine !== undefined });
  if (press === "seasonsSheet") return requests.openSeasons(gap.title, { seriesId: gap.seriesId });
  if (press === "noticeMine" && gap.mine) showNotice({ kind: "info", title: mineLabel(t, gap.mine), text: t("requests:followOnPhone") });
}
