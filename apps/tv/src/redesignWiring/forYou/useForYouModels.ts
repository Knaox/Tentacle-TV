import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { forYouPageRows, reasonToText, recoRowTitleText, useRecoPageVisit, useRecoSettings, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { tvRecoHero, tvRecoNotice, tvRecoServedCards, tvRecoShelves, type TvRecoNotice } from "@tentacle-tv/tv-core";
import type { ForYouShelfModel } from "../../redesign/screens/forYou/ForYouView";
import { useCardLists } from "../cards/cardModels";
import { yearOf } from "../home/homeSubtitles";
import { useItemsByIds } from "../items/useItemsByIds";
import type { AbsentTitle } from "../vigie/absentTitle";
import { useRecoAbsent } from "../vigie/useRecoAbsent";
import type { VigieGate } from "../vigie/useVigieGate";

const EMPTY: number[] = [];

/**
 * « Pour vous », côté données : LA page du filtre du compte (la même que
 * l'accueil, le web et le mobile), découpée pour le téléviseur par tv-core —
 * la tête (`tvRecoHero`), les étagères sans doublon (`tvRecoShelves`), la
 * ligne d'état (`tvRecoNotice`). Chaque carte dit POURQUOI elle est là (la
 * raison, sous l'affiche au focus) et « Découverte » sur un titre
 * d'exploration.
 *
 * Garde Vigie ouverte, les titres HORS bibliothèque restent à leur place,
 * grisés (`useRecoAbsent`) : OK les demande, comme la rangée « À demander »
 * de la recherche. Garde fermée : la bibliothèque seule, aucune trace.
 */

/** Ce qu'il y a derrière une carte : un item de la bibliothèque, ou un titre à demander. */
export type ForYouTarget =
  | { reco: RecoRowItem; item: MediaItem; absent?: undefined }
  | { reco: RecoRowItem; item?: undefined; absent: AbsentTitle };

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
  /** La recommandation, et l'item ou le titre absent derrière une carte. */
  targetOf: (shelfKey: string, cardId: string) => ForYouTarget | undefined;
}

export function useForYouModels(gate: VigieGate | null): ForYouModels {
  const { t, i18n } = useTranslation("reco");
  const settings = useRecoSettings();
  // Le filtre du compte d'abord : sans cette garde, la page « toutes
  // plateformes » partirait avant la page filtrée (cf. TVRecoRow).
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: served, isError, refetch } = useRecoPageVisit(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady });
  // « Tendances actuelles » en tête : la rangée goûtée des tendances n'y est pas répétée.
  const page = useMemo(() => (served ? { ...served, rows: forYouPageRows(served.rows) } : served), [served]);

  const heroReco = useMemo(() => tvRecoHero(page), [page]);
  const external = gate !== null;
  const rawShelves = useMemo(() => tvRecoShelves(page, { hero: heroReco, external }), [page, heroReco, external]);
  const notice = tvRecoNotice(page, rawShelves);

  const ids = useMemo(
    () => rawShelves.flatMap((shelf) => shelf.items.flatMap((reco) => (reco.jellyfinItemId ? [reco.jellyfinItemId] : []))),
    [rawShelves],
  );
  const items = useItemsByIds(ids);
  const lists = useCardLists();
  const recos = useMemo(() => rawShelves.flatMap((shelf) => shelf.items), [rawShelves]);
  const absent = useRecoAbsent(gate, recos);

  const reasonOf = useMemo(
    () => (reco: RecoRowItem) => reco.reasons.map((reason) => reasonToText(reason, t)).find((text): text is string => !!text),
    [t],
  );

  const { shelves, targets } = useMemo(() => {
    const targets = new Map<string, Map<string, ForYouTarget>>();
    // La rangée servie de chaque étagère : son thème (`why`) titre une rangée à thème.
    const served = new Map((page?.rows ?? []).map((row) => [row.key, row]));
    const shelves = rawShelves.map((shelf): ForYouShelfModel => {
      const entries = shelf.items.flatMap((reco) => {
        const item = reco.jellyfinItemId ? items.get(reco.jellyfinItemId) : undefined;
        return item ? [{ reco, item }] : [];
      });
      const byItem = new Map(entries.map((entry) => [entry.item.Id, entry.reco]));
      const shelfTargets = new Map<string, ForYouTarget>(entries.map((entry) => [entry.item.Id, entry]));
      targets.set(shelf.key, shelfTargets);
      const libraryCards = lists(shelf.key, entries.map((entry) => entry.item), { variant: "poster", subtitle: yearOf }, (item, card) => {
        const reco = byItem.get(item.Id);
        if (!reco) return card;
        return { ...card, badge: reco.exploration ? t("explorationBadge") : undefined, focusNote: reasonOf(reco) };
      });
      // L'ordre servi : les cartes de la bibliothèque et les titres à demander, mêlés à leur place.
      const libraryById = new Map(libraryCards.map((card) => [card.id, card]));
      const cards = tvRecoServedCards(shelf.items, (id) => libraryById.get(id), (reco) => {
        const card = absent?.cardOf(reco, reasonOf(reco));
        const wanted = card ? absent?.titleOf(card.id) : undefined;
        if (!card || !wanted) return undefined;
        shelfTargets.set(card.id, { reco, absent: wanted });
        return card;
      });
      return { key: shelf.key, title: recoRowTitleText(served.get(shelf.key) ?? shelf, t, { locale: i18n.language }), cards };
    });
    return { shelves: shelves.filter((shelf) => shelf.cards.length > 0), targets };
  }, [rawShelves, page, items, lists, t, i18n.language, reasonOf, absent]);

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
