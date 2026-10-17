import { describe, expect, it } from "vitest";
import { forYouPageRows } from "./trendingHead";
import { isProvisionalRecoPage } from "./recoPageVisit";
import type { RecoPage } from "../hooks/useRecoPage";

const rows = (...keys: string[]) => keys.map((key) => ({ key }));

describe("forYouPageRows", () => {
  it("avec la tête, « Pour vous » ne montre pas la rangée goûtée des tendances", () => {
    expect(forYouPageRows(rows("trendingNow", "forYou", "trending", "bestOfLibrary")).map((r) => r.key))
      .toEqual(["trendingNow", "forYou", "bestOfLibrary"]);
  });

  it("sans la tête (serveur qui ne déclare rien, préférence coupée) : la page d'avant", () => {
    const before = rows("forYou", "discover", "trending");
    expect(forYouPageRows(before)).toEqual(before);
  });

  it("la tête est une rangée globale : une page sans rangée personnelle reste provisoire", () => {
    const page = { rows: [{ key: "trendingNow", items: [] }, { key: "bestOfLibrary", items: [] }] } as unknown as RecoPage;
    expect(isProvisionalRecoPage(page)).toBe(true);
  });
});
