import type { TFunction } from "i18next";
import { i18n, titleKey, type MyTitle, type TitleKey, type TitleSeasonsAnswer, type TitleState } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import type { SagaModel } from "../../../src/redesign/screens/detail/detailTypes";
import type { SeasonsSheetModel } from "../../../src/redesign/screens/requests/SeasonsSheet";
import type { SheetHeaderModel } from "../../../src/redesign/screens/sheet/ActionSheetView";
import { absentCard, tmdbPosterUri, tvPosterUri } from "../../../src/redesignWiring/cards/absentCards";
import { absentOf } from "../../../src/redesignWiring/vigie/absentStates";
import { seasonsSheetModel } from "../../../src/redesignWiring/vigie/seasonsSheetModel";
import type { BenchData } from "./benchData";

/**
 * Les titres ABSENTS de la bibliothèque au banc — ce que les cartes, la
 * recherche « À demander » et la feuille des saisons montrent, résolu par les
 * MÊMES fonctions que le câblage (`absentCard`, `absentOf`,
 * `seasonsSheetModel`). Les titres sont réels (recommandations hors
 * bibliothèque de l'instantané, affiches TMDB publiques) ; les ÉTATS de
 * demande sont des exemples : le compte de test n'a rien demandé, et le banc
 * n'en demande jamais.
 */

export const t = ((key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string) as unknown as TFunction;

/** Les affiches TMDB de la saga « L'Attaque des Titans » (collection 383987),
 *  relevées sur sa page publique : l'instantané a été tiré avant `posterPath`. */
export const SAGA_POSTERS: Record<number, string> = {
  379088: "/8dAzRcrzSqRd5FjLNJ7Bw92Kod4.jpg",
  330081: "/z7UVitlWT3m1hTCbV6kwxPJmGcx.jpg",
  492999: "/lJ9HfT2paZIyXMFDRupIB2EA5QD.jpg",
  714194: "/kXUSsxQ2J3QVGkG1thmhI1FadKd.jpg",
  1333100: "/2wyvGVSCK69uwtUD0Sn82cD2WdH.jpg",
};

/** Le film de la saga que la bibliothèque a (« La dernière attaque »). */
export const AOT_FILM = "f461dd313e49d9bde1d226d22fe4ed08";

/** Une demande d'exemple du compte (la liste du socle, `mine`). */
function mine(key: TitleKey, title: string, state: MyTitle["state"], percent: number | null = null): MyTitle {
  const [mediaType, id] = key.split(":");
  return { key, mediaType: mediaType as MyTitle["mediaType"], tmdbId: Number(id), title, year: null, imageUrl: null, seasons: null, state, percent };
}

/** Ce que l'extension dirait d'un titre demandé par quelqu'un d'autre. */
const requestedByOther = (): TitleState => ({ badge: { label: i18n.language.startsWith("fr") ? "Demandé" : "Requested", tone: "info" }, request: null });

/** La saga, garde Vigie ouverte : un volet en cours (42 %), un en attente,
 *  un demandé par un autre, un libre — « OK : demander » sous sa carte. */
export function sagaWithRequests(saga: SagaModel | null): SagaModel | null {
  if (!saga) return null;
  const examples: Record<string, { mine?: MyTitle; state?: TitleState }> = {
    "tmdb:379088": { mine: mine("movie:379088", "", "arriving", 42) },
    "tmdb:330081": { mine: mine("movie:330081", "", "pending") },
    "tmdb:492999": { state: requestedByOther() },
  };
  return {
    ...saga,
    entries: saga.entries.map((entry) => {
      if (!entry.card.absent) return entry;
      const example = examples[entry.key] ?? {};
      const free = !example.mine && !example.state;
      const card: CardModel = {
        ...entry.card,
        absent: absentOf(t, example.mine, example.state),
        focusNote: free ? t("requests:hintRequest") : undefined,
      };
      return { ...entry, card, holdable: true };
    }),
  };
}

interface RecoTitle {
  title: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  posterPath: string | null;
  year: number | null;
}

/** Les recommandations hors bibliothèque de l'instantané, par titre. */
function recoTitles(data: BenchData): Map<string, RecoTitle> {
  const rows = (data.snapshot.extras?.recoState as { rows?: Array<{ items?: Array<Record<string, unknown>> }> } | undefined)?.rows ?? [];
  const out = new Map<string, RecoTitle>();
  for (const row of rows) {
    for (const item of row.items ?? []) {
      if (item.jellyfinItemId !== null || typeof item.title !== "string" || typeof item.tmdbId !== "number") continue;
      out.set(item.title, {
        title: item.title,
        mediaType: item.mediaType === "tv" ? "tv" : "movie",
        tmdbId: item.tmdbId,
        posterPath: typeof item.posterPath === "string" ? item.posterPath : null,
        year: typeof item.year === "number" ? item.year : null,
      });
    }
  }
  return out;
}

/** La rangée « À demander » d'une recherche « marvel » : des titres réels hors
 *  bibliothèque, avec des états d'exemple. */
const SEARCH_EXAMPLES: Array<{ title: string; mine?: [MyTitle["state"], number | null]; other?: true }> = [
  { title: "Thunderbolts*", mine: ["arriving", 67] },
  { title: "Black Panther", other: true },
  { title: "Captain America: The Winter Soldier" },
  { title: "Spider-Man: Brand New Day", mine: ["pending", null] },
  { title: "Iron Man 3", mine: ["importing", null] },
  { title: "Captain America: Civil War" },
  { title: "X-Men: Days of Future Past" },
];

export function absentSearchCards(data: BenchData): CardModel[] {
  const known = recoTitles(data);
  const cards: CardModel[] = [];
  for (const example of SEARCH_EXAMPLES) {
    const found = known.get(example.title);
    if (!found) continue;
    const key = titleKey(found.mediaType, found.tmdbId);
    const own = example.mine ? mine(key, found.title, example.mine[0], example.mine[1]) : undefined;
    const state = example.other ? requestedByOther() : undefined;
    cards.push({
      ...absentCard({ id: `absent:${key}`, title: found.title, year: found.year, posterUri: tmdbPosterUri(found.posterPath), absent: absentOf(t, own, state) }),
      focusNote: own || state ? undefined : t("requests:hintRequest"),
    });
  }
  return cards;
}

/** Le grand panneau d'un titre absent : l'affiche, l'année et l'état, « Demander ». */
export function absentSheetHeader(data: BenchData, title: string, status: string): SheetHeaderModel {
  const found = recoTitles(data).get(title);
  return {
    shape: "poster",
    title,
    subtitle: [found?.year ? String(found.year) : null, status].filter(Boolean).join(" · "),
    imageUri: tvPosterUri(tmdbPosterUri(found?.posterPath)),
  };
}

/** La feuille des saisons d'une série absente (« One-Punch Man ») : une saison
 *  demandée par un autre, les autres à cocher. */
export function seasonsSheet(state: "ready" | "loading" | "failed" | "none", checked: number[] = []): SeasonsSheetModel {
  const fr = i18n.language.startsWith("fr");
  const season = (number: number, episodeCount: number, requested = false) => ({
    number,
    name: number === 0 ? (fr ? "Épisodes spéciaux" : "Specials") : t("requests:seasonFallback", { number }),
    episodeCount,
    badge: requested ? { label: fr ? "Demandée" : "Requested", tone: "info" as const } : null,
    requestable: !requested,
  });
  const all = state === "none";
  const answer: TitleSeasonsAnswer | null = state === "loading"
    ? null
    : state === "failed"
      ? { seasons: [], failure: "" }
      : { seasons: [season(1, 12, all), season(2, 12, true), season(3, 12, all), season(0, 6, all)], failure: null };
  return seasonsSheetModel(t, "One-Punch Man", answer, false, new Set(checked));
}
