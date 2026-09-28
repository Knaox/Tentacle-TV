import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardProgress } from "./cardProgress";

const withData = (data: Partial<NonNullable<MediaItem["UserData"]>> | undefined) =>
  ({ UserData: data }) as Pick<MediaItem, "UserData">;

describe("cardProgress", () => {
  it("dessine la barre d'un titre entamé et non vu", () => {
    expect(cardProgress(withData({ Played: false, PlayedPercentage: 42 }))).toBe(42);
  });

  it("tait la barre d'un titre vu, même s'il garde un pourcentage", () => {
    expect(cardProgress(withData({ Played: true, PlayedPercentage: 42 }))).toBeNull();
  });

  it("tait la barre d'un titre jamais commencé", () => {
    expect(cardProgress(withData({ Played: false, PlayedPercentage: 0 }))).toBeNull();
    expect(cardProgress(withData({ Played: false }))).toBeNull();
    expect(cardProgress(withData(undefined))).toBeNull();
  });

  it("borne un pourcentage aberrant à 100", () => {
    expect(cardProgress(withData({ PlayedPercentage: 130 }))).toBe(100);
  });
});
