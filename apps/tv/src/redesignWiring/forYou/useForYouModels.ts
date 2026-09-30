import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { reasonToText, recoRowTitle, useRecoPage, useRecoSettings, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { tvRecoHero, tvRecoNotice, tvRecoShelves, type TvRecoNotice } from "@tentacle-tv/tv-core";
import type { ForYouShelfModel } from "../../redesign/screens/forYou/ForYouView";
import { useCardLists } from "../cards/cardModels";
import { yearOf } from "../home/homeSubtitles";
import { useItemsByIds } from "../items/useItemsByIds";

const EMPTY: number[] = [];

/**
 * « Pour vous », côté données : LA page du filtre du compte (la même que
 * l'accueil, le web et le mobile), découpée pour le téléviseur par tv-core —
 * la tête (`tvRecoHero`), les étagères sans doublon ni titre hors
 * bibliothèque (`tvRecoShelves`), la ligne d'état (`tvRecoNotice`). Chaque
 * carte dit POURQUOI elle est là (la raison, sous l'affiche au focus) et
 * « Découverte » sur un titre d'exploration.
 */

export interface ForYouModels {
  loading: boolean;
  isError: boolean;
  refetch: () => void;
  heroReco: RecoRowItem | null;
  /** La raison de la tête, dite en toutes lettres. */
  heroReason?: string;
  notice: TvRecoNotice;
  /** La page est là et n'a rien à montrer. */
  empty: boolean;
  shelves: ForYouShelfModel[];
  /** La recommandation et l'item derrière une carte. */
  targetOf: (shelfKey: string, cardId: string) => { reco: RecoRowItem; item: MediaItem } | undefined;
}

export function useForYouModels(): ForYouModels {
  const { t } = useTranslation("reco");
  const settings = useRecoSettings();
  // Le filtre du compte d'abord : sans cette garde, la page « toutes
  // plateformes » partirait avant la page filtrée (cf. TVRecoRow).
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page, isError, refetch } = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady });

  const heroReco = useMemo(() => tvRecoHero(page), [page]);
  const rawShelves = useMemo(() => tvRecoShelves(page, { hero: heroReco }), [page, heroReco]);
  const notice = tvRecoNotice(page, rawShelves);

  const ids = useMemo(
    () => rawShelves.flatMap((shelf) => shelf.items.map((reco) => reco.jellyfinItemId).filter((id): id is string => !!id)),
    [rawShelves],
  );
  const items = useItemsByIds(ids);
  const lists = useCardLists();

  const reasonOf = useMemo(
    () => (reco: RecoRowItem) => reco.reasons.map((reason) => reasonToText(reason, t)).find((text): text is string => !!text),
    [t],
  );

  const { shelves, targets } = useMemo(() => {
    const targets = new Map<string, Map<string, { reco: RecoRowItem; item: MediaItem }>>();
    const shelves = rawShelves.map((shelf): ForYouShelfModel => {
      const entries = shelf.items.flatMap((reco) => {
        const item = reco.jellyfinItemId ? items.get(reco.jellyfinItemId) : undefined;
        return item ? [{ reco, item }] : [];
      });
      const byItem = new Map(entries.map((entry) => [entry.item.Id, entry.reco]));
      targets.set(shelf.key, new Map(entries.map((entry) => [entry.item.Id, entry])));
      const title = recoRowTitle(shelf);
      return {
        key: shelf.key,
        title: t(title.key, title.params),
        cards: lists(shelf.key, entries.map((entry) => entry.item), { variant: "morph", subtitle: yearOf }, (item, card) => {
          const reco = byItem.get(item.Id);
          if (!reco) return card;
          return { ...card, badge: reco.exploration ? t("explorationBadge") : undefined, focusNote: reasonOf(reco) };
        }),
      };
    });
    return { shelves: shelves.filter((shelf) => shelf.cards.length > 0), targets };
  }, [rawShelves, items, lists, t, reasonOf]);

  return {
    loading: !page && !isError,
    isError: isError && !page,
    refetch: () => void refetch(),
    heroReco,
    heroReason: heroReco ? reasonOf(heroReco) : undefined,
    notice,
    empty: !!page && rawShelves.length === 0 && !heroReco,
    shelves,
    targetOf: (shelfKey, cardId) => targets.get(shelfKey)?.get(cardId),
  };
}
