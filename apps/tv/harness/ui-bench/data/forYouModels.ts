import { reasonToText, recoRowTitle, type RecoRowItem } from "@tentacle-tv/api-client";
import { familyOfProviderId, i18n } from "@tentacle-tv/shared";
import type { TvRecoPageLike, TvRecoShelf } from "@tentacle-tv/tv-core";
import type { HeroModel } from "../../../src/redesign/hero/HeroBanner";
import type { ForYouFilterModel, ForYouShelfModel } from "../../../src/redesign/screens/forYou/ForYouView";
import type { BenchData } from "./benchData";
import { cardOf, yearOf } from "./models";
import { heroOf } from "./screenModels";

/**
 * Les props de « Pour vous », tirées de la VRAIE page du moteur
 * (`/api/reco/page` du compte, `extras.recoState`) avec les mêmes fonctions
 * que l'app : `tvRecoHero` / `tvRecoShelves` / `tvRecoNotice` (tv-core, dans
 * la scène), `recoRowTitle` et `reasonToText` (api-client), `cardOf` pour
 * les marqueurs. Les états que le compte n'a pas (désactivé, à froid, en
 * préparation, filtre de plateformes) sont des COPIES de cette page.
 */

export type RecoPageModel = TvRecoPageLike<RecoRowItem>;

const tReco = (key: string, options?: Record<string, unknown>) => i18n.t(`reco:${key}`, options) as string;

/** La page capturée ; null si l'instantané ne l'a pas. */
export function capturedRecoPage(data: BenchData): RecoPageModel | null {
  const raw = data.snapshot.extras?.recoState as Partial<RecoPageModel> | undefined;
  if (!raw?.rows) return null;
  return {
    state: raw.state ?? "ready",
    generating: raw.generating ?? false,
    refining: raw.refining ?? false,
    rows: raw.rows,
  };
}

/** Les rangées servies à tous, quel que soit l'état du profil. */
const GLOBAL_ROWS = ["trending", "serverPulse", "bestOfLibrary"];

/** Une copie de la page réelle dans un autre état du moteur. */
export function recoPageAs(page: RecoPageModel, state: "disabled" | "cold"): RecoPageModel {
  return { ...page, state, rows: page.rows.filter((row) => GLOBAL_ROWS.includes(row.key)) };
}

/** La page telle que le serveur la rendrait sous un filtre de plateformes :
 *  seuls restent les titres inclus sur l'une d'elles (filtre strict). */
export function recoPageFiltered(page: RecoPageModel, providerIds: number[]): RecoPageModel {
  const families = new Set(providerIds.map((id) => familyOfProviderId(id)?.key).filter(Boolean));
  const kept = (item: RecoRowItem) => (item.providers ?? []).some((p) => families.has(familyOfProviderId(p.id)?.key));
  return { ...page, rows: page.rows.map((row) => ({ ...row, items: row.items.filter(kept) })).filter((row) => row.items.length > 0) };
}

/** La page avec la rangée « exploration » servie en tête : ses titres
 *  gardent leur badge « Découverte » à l'écran (exemple). */
export function recoPageExplorationFirst(page: RecoPageModel): RecoPageModel {
  const exploration = page.rows.filter((row) => row.key === "exploration");
  return { ...page, rows: [...exploration, ...page.rows.filter((row) => row.key !== "exploration")] };
}

/** La première raison qui se dit (`reasonToText`) — l'explicabilité. */
export function reasonOf(item: RecoRowItem): string | undefined {
  for (const reason of item.reasons) {
    const sentence = reasonToText(reason, tReco);
    if (sentence) return sentence;
  }
  return undefined;
}

/** « Notre meilleure suggestion », et pourquoi. */
export function recoHeroOf(data: BenchData, hero: RecoRowItem): HeroModel | null {
  const item = hero.jellyfinItemId ? data.item(hero.jellyfinItemId) : undefined;
  if (!item) return null;
  return { ...heroOf(data, item, tReco("heroKicker")), reason: reasonOf(hero) };
}

export function recoShelvesOf(data: BenchData, shelves: TvRecoShelf<RecoRowItem>[]): ForYouShelfModel[] {
  return shelves.map((shelf) => {
    const title = recoRowTitle(shelf);
    return {
      key: shelf.key,
      title: tReco(title.key, title.params),
      cards: shelf.items.flatMap((reco) => {
        const item = reco.jellyfinItemId ? data.item(reco.jellyfinItemId) : undefined;
        if (!item) return [];
        return [{
          ...cardOf(data, item, yearOf(item)),
          badge: reco.exploration ? tReco("explorationBadge") : undefined,
          focusNote: reasonOf(reco),
        }];
      }),
    };
  });
}

/** La pastille du filtre : les noms de marque des familles retenues. */
export function recoFilterOf(providerIds: number[]): ForYouFilterModel | null {
  const names = [...new Set(providerIds.map((id) => familyOfProviderId(id)?.label).filter((n): n is string => !!n))];
  if (providerIds.length === 0) return null;
  return { label: names.length > 0 ? names.join(" · ") : tReco("homeFilterGeneric") };
}
