import { afterEach, describe, expect, it } from "vitest";
import { hostYouTubeBudget, previewRefusal, resetYouTubeGuard, takeYouTubePlayback, tripYouTubeBreaker } from "../trailers/youtubeGuard";

/** Remplit l'heure de requêtes d'extension, étalées pour passer la minute et la cadence. */
function fillWithExtensions(count: number, from: number): number {
  let t = from;
  for (let i = 0; i < count; i++) {
    const r = hostYouTubeBudget.admitExtension(`ext-${i % 2}`, "play", 1, t);
    if (!r.granted) throw new Error(`refus inattendu au n° ${i}`);
    t += r.waitMs + 3_100;
  }
  return t;
}

describe("bandes-annonces et budget de l'hôte", () => {
  afterEach(() => resetYouTubeGuard());

  it("sous le plafond de l'hôte, les bandes-annonces ne changent RIEN (même avec 139 requêtes d'extensions dans l'heure)", () => {
    const t = fillWithExtensions(139, 0);
    expect(previewRefusal(t)).toBeNull();
    expect(takeYouTubePlayback("compte", t)).toBeNull();
    expect(hostYouTubeBudget.usedInHour(t)).toBe(140);
  });

  it("l'heure pleine (150, toutes sources) : la bande-annonce attend, comme pour son propre budget", () => {
    const t = fillWithExtensions(139, 0);
    for (let i = 0; i < 11; i++) hostYouTubeBudget.countTrailer(t);
    expect(previewRefusal(t)).toMatchObject({ kind: "budget" });
    expect(takeYouTubePlayback("compte", t)).toMatchObject({ kind: "budget" });
  });

  it("le disjoncteur est commun : ouvert par les bandes-annonces, il bloque l'anticipation des extensions", () => {
    tripYouTubeBreaker("bot", 1_000);
    expect(hostYouTubeBudget.admitExtension("sillon", "prefetch", 1, 2_000)).toMatchObject({ granted: false, reason: "blocked" });
  });
});
