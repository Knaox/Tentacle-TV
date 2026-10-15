import { describe, expect, it } from "vitest";
import type { RecoPageRow, RecoRowItem } from "../reco/recoPageTypes";
import type { ServerCapability } from "../serverCapabilities/serverCapabilities";
import { SERVER_CAPABILITIES } from "../serverCapabilities/serverCapabilities";
import fr from "../i18n/locales/fr/homeSettings";
import en from "../i18n/locales/en/homeSettings";
import {
  HERO_MODES,
  HERO_RECO_KINDS_CAPABILITY,
  heroModeHintKey,
  heroModeLabelKey,
  heroModesOffered,
  isHeroMode,
  recoHeroKindOf,
  topRecoHeroItems,
} from "./heroModes";

function item(key: string, extra: Partial<RecoRowItem> = {}): RecoRowItem {
  const [mediaType, id] = key.split(":");
  return {
    key, mediaType: mediaType as "movie" | "tv", tmdbId: Number(id), title: key, year: 2020, posterPath: null,
    backdropPath: "/b.jpg", jellyfinItemId: `jf-${id}`, source: "s", score: 1, voteAverage: null, reasons: [], ...extra,
  };
}

const rows = (forYou: RecoRowItem[], forYouMovies?: RecoRowItem[]): RecoPageRow[] => [
  { key: "forYou", items: forYou },
  ...(forYouMovies ? [{ key: "forYouMovies", items: forYouMovies }] : []),
];

describe("les sources du bandeau principal", () => {
  it("une liste fermée, dont la capacité existe dans le contrat", () => {
    expect(HERO_MODES).toEqual(["resume", "random", "reco", "recoMovies", "recoSeries", "fixed"]);
    expect(Object.keys(SERVER_CAPABILITIES)).toContain(HERO_RECO_KINDS_CAPABILITY);
    expect(isHeroMode("recoSeries")).toBe(true);
    expect(isHeroMode("pourVous")).toBe(false);
  });

  it("chaque source « Pour vous » dit ce qu'elle tire", () => {
    expect(recoHeroKindOf("reco")).toBe("all");
    expect(recoHeroKindOf("recoMovies")).toBe("movie");
    expect(recoHeroKindOf("recoSeries")).toBe("tv");
    expect(recoHeroKindOf("resume")).toBeNull();
    expect(recoHeroKindOf(undefined)).toBeNull();
  });

  it("face à un serveur qui ne déclare rien : ni Films ni Séries proposés", () => {
    const none = new Set<ServerCapability>();
    expect(heroModesOffered(none)).toEqual(["resume", "random", "reco", "fixed"]);
    expect(heroModesOffered(new Set([HERO_RECO_KINDS_CAPABILITY]))).toEqual([...HERO_MODES]);
  });

  it("la valeur en vigueur reste lisible, même sans la capacité", () => {
    expect(heroModesOffered(new Set(), "recoSeries")).toEqual(["resume", "random", "reco", "recoSeries", "fixed"]);
  });

  it("chaque source a son nom et sa phrase, dans les deux langues", () => {
    for (const mode of HERO_MODES) {
      for (const key of [heroModeLabelKey(mode), heroModeHintKey(mode)]) {
        const bare = key.replace("homeSettings:", "") as keyof typeof fr;
        expect(fr[bare], key).toBeTruthy();
        expect(en[bare as keyof typeof en], key).toBeTruthy();
      }
    }
    expect(heroModeLabelKey("inconnu")).toBe("homeSettings:heroResume");
  });
});

describe("les titres d'un bandeau Films ou Séries", () => {
  const page = rows([
    item("tv:1"), item("movie:2"), item("tv:3"), item("movie:4", { exploration: true }), item("movie:5"), item("tv:6"),
  ]);

  it("les mieux recommandés du genre, dans l'ordre servi", () => {
    expect(topRecoHeroItems(page, "movie").map((i) => i.key)).toEqual(["movie:2", "movie:5"]);
    expect(topRecoHeroItems(page, "tv").map((i) => i.key)).toEqual(["tv:1", "tv:3", "tv:6"]);
  });

  it("jamais un titre d'exploration : un pari n'est pas un meilleur score", () => {
    expect(topRecoHeroItems(page, "movie").some((i) => i.exploration)).toBe(false);
  });

  it("les films se complètent par « Films pour vous », sans doublon", () => {
    const withMovies = rows([item("movie:2"), item("tv:1")], [item("movie:2"), item("movie:8"), item("movie:9")]);
    expect(topRecoHeroItems(withMovies, "movie").map((i) => i.key)).toEqual(["movie:2", "movie:8", "movie:9"]);
    expect(topRecoHeroItems(withMovies, "tv").map((i) => i.key)).toEqual(["tv:1"]);
  });

  it("au plus `max`, et seulement ce que le client sait montrer", () => {
    const many = rows(Array.from({ length: 9 }, (_, n) => item(`tv:${n + 1}`, n === 0 ? { jellyfinItemId: null } : {})));
    const inLibrary = topRecoHeroItems(many, "tv", { max: 3, accept: (i) => i.jellyfinItemId !== null });
    expect(inLibrary.map((i) => i.key)).toEqual(["tv:2", "tv:3", "tv:4"]);
    expect(topRecoHeroItems(many, "tv")).toHaveLength(5);
  });

  it("pas de page, ou rien du genre : une liste vide — le client retombe sur la reprise", () => {
    expect(topRecoHeroItems(undefined, "movie")).toEqual([]);
    expect(topRecoHeroItems(rows([item("tv:1")]), "movie")).toEqual([]);
  });
});
