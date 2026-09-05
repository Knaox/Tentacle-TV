import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "./recoTypes";
import {
  RECO_PAGE_FALLBACK_POLL_MS,
  normalizeProviderFilter,
  recoFilterKey,
  recoPagePollInterval,
  removeRecoItem,
  selectRecoPage,
} from "./useRecoPage";
import type { RecoPage } from "./useRecoPage";

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

const page = (rows: RecoPage["rows"]): RecoPage => ({
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
  rows,
});

describe("normalizeProviderFilter / recoFilterKey", () => {
  it("entiers positifs, dédoublonnés, triés ; « all » sans filtre", () => {
    expect(normalizeProviderFilter([415, 283, 283, 0, -1, 2.5])).toEqual([283, 415]);
    expect(recoFilterKey([415, 283])).toBe("283,415");
    expect(recoFilterKey([])).toBe("all");
    expect(recoFilterKey(null)).toBe("all");
  });
});

describe("removeRecoItem", () => {
  it("retire l'item de toutes les rangées, omet une rangée vidée, garde l'identité sinon", () => {
    const p = page([
      { key: "forYou", items: [item("movie:1"), item("movie:2")] },
      { key: "trending", items: [item("movie:2")] },
    ]);
    const out = removeRecoItem(p, "movie:2");
    expect(out?.rows).toEqual([{ key: "forYou", items: [item("movie:1")] }]);
    expect(removeRecoItem(p, "movie:9")).toBe(p);
    expect(removeRecoItem(undefined, "movie:1")).toBeUndefined();
  });
});

describe("selectRecoPage", () => {
  it("force les drapeaux en booléens et écarte les rangées vides", () => {
    const raw = { ...page([{ key: "a", items: [item("movie:1")] }, { key: "b", items: [] }]) } as RecoPage;
    (raw as unknown as { refining?: boolean }).refining = undefined;
    const out = selectRecoPage(raw);
    expect(out.refining).toBe(false);
    expect(out.rows.map((r) => r.key)).toEqual(["a"]);
  });
});

describe("recoPagePollInterval", () => {
  const generating: RecoPage = { ...page([]), generating: true };

  it("forme v5 (query) : sonde seulement sans socket, pendant la construction", () => {
    expect(recoPagePollInterval(false, { state: { data: generating } })).toBe(RECO_PAGE_FALLBACK_POLL_MS);
    expect(recoPagePollInterval(true, { state: { data: generating } })).toBe(false);
    expect(recoPagePollInterval(false, { state: { data: page([]) } })).toBe(false);
  });

  it("forme v4 (data, query) : la page arrive en premier, son `state` est une chaîne", () => {
    expect(recoPagePollInterval(false, generating, { state: { data: generating } })).toBe(RECO_PAGE_FALLBACK_POLL_MS);
    expect(recoPagePollInterval(false, { ...page([]), refining: true }, {})).toBe(RECO_PAGE_FALLBACK_POLL_MS);
    expect(recoPagePollInterval(false, page([]), {})).toBe(false);
  });

  it("sans donnée : jamais de sondage", () => {
    expect(recoPagePollInterval(false)).toBe(false);
    expect(recoPagePollInterval(false, undefined, {})).toBe(false);
    expect(recoPagePollInterval(false, { state: {} })).toBe(false);
  });
});
