import { describe, expect, it } from "vitest";
import { swipeStackZ } from "./swipeStackOrder";
import type { SwipeCard } from "./swipeTypes";

const card = (n: number): SwipeCard => ({
  key: `movie:${n}`,
  mediaType: "movie",
  tmdbId: n,
  title: `Titre ${n}`,
  year: 2000,
  genres: [],
  voteAverage: null,
  posterPath: null,
  backdropPath: null,
  jellyfinItemId: null,
  source: "taste",
  reason: null,
});

describe("empilement de la pile", () => {
  it("la carte arrivée la première est dessus, et le reste en partant", () => {
    const [a, b, c] = [card(1), card(2), card(3)];
    const za = swipeStackZ(a);
    const zb = swipeStackZ(b);
    const zc = swipeStackZ(c);
    expect(za).toBeGreaterThan(zb);
    expect(zb).toBeGreaterThan(zc);
    // Une carte arrivée plus tard (la file se recharge) passe sous les autres.
    expect(swipeStackZ(card(4))).toBeLessThan(zc);
  });

  it("le rang tient à l'objet : une carte rendue par « annuler » repasse devant", () => {
    const a = card(10);
    const za = swipeStackZ(a);
    const later = card(11);
    swipeStackZ(later);
    expect(swipeStackZ(a)).toBe(za);
    expect(swipeStackZ(a)).toBeGreaterThan(swipeStackZ(later));
  });
});
