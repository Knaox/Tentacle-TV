import { describe, expect, it } from "vitest";
import { takeWtRateToken, WT_CHAT_RATES } from "./watchTogetherChat";

describe("takeWtRateToken — une rafale, puis le rythme", () => {
  it("la capacité d'un coup, puis plus rien, puis un jeton par 1/perSecond", () => {
    const policy = WT_CHAT_RATES.message;
    let bucket = undefined as ReturnType<typeof takeWtRateToken>["bucket"] | undefined;
    for (let i = 0; i < policy.capacity; i += 1) {
      const out = takeWtRateToken(bucket, policy, 1_000);
      expect(out.allowed).toBe(true);
      bucket = out.bucket;
    }
    expect(takeWtRateToken(bucket, policy, 1_000).allowed).toBe(false);
    expect(takeWtRateToken(bucket, policy, 1_000 + 1_000 / policy.perSecond).allowed).toBe(true);
  });

  it("le repos rend la rafale, jamais plus que la capacité", () => {
    const policy = WT_CHAT_RATES.gif;
    const empty = { tokens: 0, at: 0 };
    const rested = takeWtRateToken(empty, policy, 3_600_000);
    expect(rested.allowed).toBe(true);
    expect(rested.bucket.tokens).toBe(policy.capacity - 1);
  });

  it("une dizaine de réactions par seconde en régime", () => {
    expect(WT_CHAT_RATES.reaction.perSecond).toBeGreaterThanOrEqual(10);
  });
});
