import { describe, expect, it } from "vitest";
import { reactionBursts, reactionLane, type ReactionLike } from "./reactionBursts";

const r = (key: string, userId: string, emoji?: string, gif?: string): ReactionLike => ({
  key, userId, username: userId.toUpperCase(), emoji, gif: gif ? { url: gif } : undefined,
});

describe("reactionBursts", () => {
  it("regroupe les réactions identiques d'un même membre", () => {
    const bursts = reactionBursts([r("1", "a", "🔥"), r("2", "a", "🔥"), r("3", "b", "🔥"), r("4", "a", "🔥")]);
    expect(bursts.map((b) => [b.id, b.count, b.lastKey])).toEqual([["b|emoji:🔥", 1, "3"], ["a|emoji:🔥", 3, "4"]]);
  });

  it("ne mêle ni deux emojis, ni deux GIF différents", () => {
    const bursts = reactionBursts([r("1", "a", "🔥"), r("2", "a", "😂"), r("3", "a", undefined, "x"), r("4", "a", undefined, "y")]);
    expect(bursts).toHaveLength(4);
  });

  it("borne le nombre de bulles aux plus récentes", () => {
    const many = Array.from({ length: 20 }, (_, i) => r(String(i), `u${i}`, "👍"));
    const bursts = reactionBursts(many, 5);
    expect(bursts.map((b) => b.lastKey)).toEqual(["15", "16", "17", "18", "19"]);
  });

  it("donne à une rafale une voie stable", () => {
    expect(reactionLane("a|emoji:🔥")).toBe(reactionLane("a|emoji:🔥"));
    expect(reactionLane("x", 3)).toBeLessThan(3);
  });

  it("reprend le compte d'une rafale déjà fusionnée par le chat", () => {
    const merged = { ...r("9", "a", "🔥"), count: 5 };
    const bursts = reactionBursts([merged, r("10", "a", "🔥")]);
    expect(bursts).toHaveLength(1);
    expect(bursts[0]!.count).toBe(6);
    expect(bursts[0]!.lastKey).toBe("10");
  });
});

