import { describe, expect, it } from "vitest";
import { absentPressAfterState, absentPressFirst, gapTabPress, seriesGapPress } from "./absentActions";

describe("OK sur un titre absent, avant de lire son état", () => {
  const free = { mine: false, arrived: false, busy: false };
  it("une demande en vol d'abord : rien, jamais un double envoi", () => {
    expect(absentPressFirst({ ...free, busy: true, mine: true })).toBe("busy");
  });
  it("déjà demandé par le compte : son état, jamais une seconde demande", () => {
    expect(absentPressFirst({ ...free, mine: true, arrived: true })).toBe("noticeMine");
  });
  it("arrivé depuis peu : « Disponible »", () => {
    expect(absentPressFirst({ ...free, arrived: true })).toBe("noticeArrived");
  });
  it("sinon, lire son état", () => {
    expect(absentPressFirst(free)).toBe("readState");
  });
});

describe("OK sur un titre absent, son état lu", () => {
  const none = { offer: null, series: false, seasons: false, badge: false } as const;
  it("une offre directe : la demande en un geste", () => {
    expect(absentPressAfterState({ ...none, offer: "direct", series: true, seasons: true })).toBe("request");
  });
  it("une série à préciser : la feuille de ses saisons, si l'extension sait les dire", () => {
    expect(absentPressAfterState({ ...none, offer: "open", series: true, seasons: true })).toBe("seasonsSheet");
    expect(absentPressAfterState({ ...none, offer: "open", series: true, seasons: false })).toBe("noticeUnavailable");
    expect(absentPressAfterState({ ...none, offer: "open", series: false, seasons: true })).toBe("noticeUnavailable");
  });
  it("rien d'offert : l'état que dit l'extension, sinon « pas disponible »", () => {
    expect(absentPressAfterState({ ...none, badge: true })).toBe("noticeBadge");
    expect(absentPressAfterState(none)).toBe("noticeUnavailable");
  });
});

describe("saisons manquantes", () => {
  it("l'onglet grisé : demander la saison seule, sinon son état", () => {
    expect(gapTabPress({ requestable: true })).toBe("requestSeason");
    expect(gapTabPress({ requestable: false })).toBe("noticeState");
  });
  it("la série incomplète de « À demander » : la feuille, sinon la demande en cours, sinon rien", () => {
    expect(seriesGapPress({ missing: 2, mine: true })).toBe("seasonsSheet");
    expect(seriesGapPress({ missing: 0, mine: true })).toBe("noticeMine");
    expect(seriesGapPress({ missing: 0, mine: false })).toBe("none");
  });
});
