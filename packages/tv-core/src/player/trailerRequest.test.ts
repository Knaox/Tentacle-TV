import { describe, expect, it } from "vitest";
import { trailerEngineRequest } from "./trailerRequest";
import { trailerTools } from "./trailerPanels";
import { trailerNeighbor, TRAILER_TIMELINE_KEY } from "./trailerFocus";
import { TRAILER_CLOSE_KEY } from "./trailerChrome";

describe("serveur sans `trailers.player` (d'avant le lecteur simplifié)", () => {
  it("rien n'est demandé au moteur, même un choix retenu", () => {
    expect(trailerEngineRequest({ playerCapable: false, subtitle: "fr", quality: 720 })).toEqual({ subtitle: null, quality: null });
  });

  it("la barre seule : ni bouton, ↑ mène à la croix — avancer et reculer restent", () => {
    const tools = trailerTools({ playerCapable: false, subtitleCount: 0, qualityCount: 0 });
    expect(tools).toEqual({ subtitles: false, quality: false });
    const view = { state: "playing" as const, tools, chromeShown: true, panel: null };
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view)).toBe(TRAILER_CLOSE_KEY);
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "droite", view)).toBe("stay");
  });

  it("avec la capacité, le choix part tel quel", () => {
    expect(trailerEngineRequest({ playerCapable: true, subtitle: "fr", quality: 720 })).toEqual({ subtitle: "fr", quality: 720 });
    expect(trailerEngineRequest({ playerCapable: true, subtitle: null, quality: null })).toEqual({ subtitle: null, quality: null });
  });
});
