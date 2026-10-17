/**
 * La règle de la visite (docs/RECO-POUR-VOUS.md, règle 5), en pur : une page
 * recalculée par le serveur n'entre à l'écran qu'à une frontière — rien
 * d'affiché, l'arrivée, un filtre changé, une page encore provisoire — et
 * seuls les titres sortis quittent la page tenue.
 */
import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "../hooks/recoTypes";
import type { RecoPage } from "../hooks/useRecoPage";
import {
  hasNewRecoContent,
  isProvisionalRecoPage,
  recoPageFilterKey,
  servedPageVerdict,
  visibleRecoPage,
} from "./recoPageVisit";

const item = (key: string): RecoRowItem => ({
  key,
  mediaType: "movie",
  tmdbId: Number(key.split(":")[1]),
  title: key,
  year: null,
  posterPath: null,
  jellyfinItemId: null,
  source: "x",
  score: 1,
  voteAverage: null,
  reasons: [],
});

const page = (rows: Record<string, string[]>, over: Partial<RecoPage> = {}): RecoPage => ({
  state: "ready",
  signalCount: 20,
  generating: false,
  refining: false,
  exploring: false,
  generatedAt: null,
  poolGeneratedAt: null,
  tmdbConfigured: true,
  personalized: true,
  filter: null,
  rows: Object.entries(rows).map(([key, keys]) => ({ key, items: keys.map(item) })),
  ...over,
});

const A = page({ forYou: ["movie:1", "movie:2"], "becauseYouLiked:movie:9": ["movie:3"] });
const B = page({ forYou: ["movie:1", "movie:7"], "becauseYouLiked:movie:8": ["movie:4"] });

describe("servedPageVerdict", () => {
  it("rien d'affiché encore : la page servie entre", () => {
    expect(servedPageVerdict(undefined, A, { arriving: false })).toBe("adopt");
  });

  it("la même page, ou rien de servi : rien ne change", () => {
    expect(servedPageVerdict(A, A, { arriving: false })).toBe("keep");
    expect(servedPageVerdict(A, undefined, { arriving: false })).toBe("keep");
  });

  it("une page recalculée en cours de visite ATTEND — jamais sous les yeux", () => {
    expect(servedPageVerdict(A, B, { arriving: false })).toBe("hold");
  });

  it("à l'arrivée, la page fraîche remplace celle du cache", () => {
    expect(servedPageVerdict(A, B, { arriving: true })).toBe("adopt");
  });

  it("« Tendances actuelles » allumée ou coupée par l'utilisateur : la page entre", () => {
    const withHead = page({ trendingNow: ["movie:20"], forYou: ["movie:1", "movie:2"] });
    expect(servedPageVerdict(A, withHead, { arriving: false })).toBe("adopt");
    expect(servedPageVerdict(withHead, A, { arriving: false })).toBe("adopt");
    // Une tête recalculée (tendances de la semaine rafraîchies) attend, comme le reste.
    const otherHead = page({ trendingNow: ["movie:21"], forYou: ["movie:1", "movie:2"] });
    expect(servedPageVerdict(withHead, otherHead, { arriving: false })).toBe("hold");
  });

  it("un filtre changé par l'utilisateur : sa page entre", () => {
    const filtered = page({ forYou: ["movie:5"] }, { filter: { providers: [8] } });
    expect(servedPageVerdict(A, filtered, { arriving: false })).toBe("adopt");
  });

  it("une page sans rien de personnel laisse entrer la première page personnelle", () => {
    const cold = page({ trending: ["movie:10"], bestOfLibrary: ["movie:11"] }, { state: "cold" });
    expect(isProvisionalRecoPage(cold)).toBe(true);
    expect(servedPageVerdict(cold, A, { arriving: false })).toBe("adopt");
    expect(servedPageVerdict(page({}), A, { arriving: false })).toBe("adopt");
  });
});

describe("recoPageFilterKey", () => {
  it("« all » sans filtre, les ids triés sinon", () => {
    expect(recoPageFilterKey(A)).toBe("all");
    expect(recoPageFilterKey(page({}, { filter: { providers: [415, 8] } }))).toBe("8,415");
  });
});

describe("visibleRecoPage", () => {
  it("retire les titres sortis, omet une rangée vidée", () => {
    const out = visibleRecoPage(A, (key) => key === "movie:2" || key === "movie:3");
    expect(out?.rows.map((row) => [row.key, row.items.map((i) => i.key)])).toEqual([["forYou", ["movie:1"]]]);
  });

  it("rien de sorti : la MÊME page ; une rangée intacte reste le même objet", () => {
    expect(visibleRecoPage(A, () => false)).toBe(A);
    const out = visibleRecoPage(A, (key) => key === "movie:3");
    expect(out?.rows[0]).toBe(A.rows[0]);
    expect(visibleRecoPage(undefined, () => true)).toBeUndefined();
  });
});

describe("hasNewRecoContent", () => {
  it("un titre ou une rangée que l'écran n'a pas : du nouveau", () => {
    expect(hasNewRecoContent(A, B)).toBe(true);
  });

  it("une page qui ne fait que retirer ou réordonner n'a rien à proposer", () => {
    const fewer = page({ forYou: ["movie:1"] });
    const reordered = page({ "becauseYouLiked:movie:9": ["movie:3"], forYou: ["movie:2", "movie:1"] });
    expect(hasNewRecoContent(A, fewer)).toBe(false);
    expect(hasNewRecoContent(A, reordered)).toBe(false);
    expect(hasNewRecoContent(A, A)).toBe(false);
    expect(hasNewRecoContent(undefined, B)).toBe(false);
  });
});
