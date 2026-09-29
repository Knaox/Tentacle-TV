import { describe, expect, it } from "vitest";
import frTrailerHelp from "../i18n/locales/fr/trailerHelp";
import enTrailerHelp from "../i18n/locales/en/trailerHelp";
import type { TrailerReadiness } from "../jellyfinCompat/setupContract";
import { describeTrailerReadiness, shouldShowTrailerHint, type TrailerHintInput } from "./trailerHint";

const MISCONFIGURED: TrailerReadiness = {
  state: "misconfigured",
  reasons: ["few-trailers", "tmdb-fetcher-disabled"],
  coverage: 0.123,
  checkedAt: "2026-09-29T12:00:00.000Z",
};
const READY: TrailerReadiness = { state: "ready", reasons: [], coverage: 0.8, checkedAt: "2026-09-29T12:00:00.000Z" };

const base: TrailerHintInput = {
  itemType: "Movie",
  trailerVisible: false,
  trailerSettled: true,
  readiness: MISCONFIGURED,
  dismissed: false,
};

describe("shouldShowTrailerHint", () => {
  it("un film sans aucune bande-annonce, sur un serveur mal réglé : le rappel paraît", () => {
    expect(shouldShowTrailerHint(base)).toBe(true);
    expect(shouldShowTrailerHint({ ...base, itemType: "Series" })).toBe(true);
  });

  it("un serveur bien réglé : jamais, même sans bande-annonce", () => {
    expect(shouldShowTrailerHint({ ...base, readiness: READY })).toBe(false);
  });

  it("un titre qui a une bande-annonce : jamais", () => {
    expect(shouldShowTrailerHint({ ...base, trailerVisible: true })).toBe(false);
  });

  it("masqué pour de bon : jamais", () => {
    expect(shouldShowTrailerHint({ ...base, dismissed: true })).toBe(false);
  });

  it("faute de savoir, rien : listes en route, diagnostic ou préférence pas encore lus, diagnostic inconnu", () => {
    expect(shouldShowTrailerHint({ ...base, trailerSettled: false })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, readiness: undefined })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, readiness: null })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, readiness: { ...MISCONFIGURED, state: "unknown" } })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, dismissed: undefined })).toBe(false);
  });

  it("un épisode, une collection ou un type inconnu : pas de rappel", () => {
    expect(shouldShowTrailerHint({ ...base, itemType: "Episode" })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, itemType: "BoxSet" })).toBe(false);
    expect(shouldShowTrailerHint({ ...base, itemType: undefined })).toBe(false);
  });
});

describe("describeTrailerReadiness", () => {
  it("mal réglé : les causes dans l'ordre du guide, la couverture en pourcentage entier", () => {
    expect(describeTrailerReadiness(MISCONFIGURED)).toEqual({
      state: "misconfigured",
      messageKey: "statusMisconfigured",
      reasons: [
        { reason: "tmdb-fetcher-disabled", key: "reasonTmdbFetcherDisabled" },
        { reason: "few-trailers", key: "reasonFewTrailers", values: { percent: 12 } },
      ],
    });
  });

  it("bien réglé : la phrase rassurante, sans cause", () => {
    expect(describeTrailerReadiness(READY)).toEqual({ state: "ready", messageKey: "statusReady", reasons: [] });
  });

  it("inconnu ou absent : rien à dire", () => {
    expect(describeTrailerReadiness({ ...READY, state: "unknown" })).toBeNull();
    expect(describeTrailerReadiness(null)).toBeNull();
    expect(describeTrailerReadiness(undefined)).toBeNull();
  });

  it("chaque phrase et chaque cause existent dans les deux langues", () => {
    const all = describeTrailerReadiness({ ...MISCONFIGURED, reasons: ["tmdb-plugin-disabled", "tmdb-fetcher-disabled", "few-trailers"] });
    const keys = [all?.messageKey, ...(all?.reasons.map((reason) => reason.key) ?? []), "statusReady"];
    for (const key of keys) {
      expect(frTrailerHelp).toHaveProperty(key as string);
      expect(enTrailerHelp).toHaveProperty(key as string);
    }
  });
});
