import { describe, expect, it } from "vitest";
import { trailerEngineRequest, trailerInitialQuality } from "./trailerRequest";
import { trailerTools } from "./trailerPanels";
import { trailerNeighbor, TRAILER_TIMELINE_KEY } from "./trailerFocus";
import { TRAILER_CLOSE_KEY } from "./trailerChrome";

describe("serveur sans `trailers.player` (d'avant le lecteur simplifié)", () => {
  it("rien n'est offert, rien n'est demandé au moteur — même un choix retenu", () => {
    const offered = { subtitles: [], qualities: [] };
    expect(trailerEngineRequest({ offered, subtitle: "fr", quality: 720 })).toEqual({ subtitle: null, quality: null });
  });

  it("la barre seule : ni bouton, ↑ mène à la croix — avancer et reculer restent", () => {
    const tools = trailerTools({ playerCapable: false, subtitleCount: 0, qualityCount: 0 });
    expect(tools).toEqual({ subtitles: false, quality: false });
    const view = { state: "playing" as const, tools, chromeShown: true, panel: null };
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view)).toBe(TRAILER_CLOSE_KEY);
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "droite", view)).toBe("stay");
  });

  it("parmi l'offre, le choix part tel quel ; hors de l'offre, rien", () => {
    const offered = { subtitles: ["fr", "en-US"], qualities: [1080, 720] };
    expect(trailerEngineRequest({ offered, subtitle: "fr", quality: 720 })).toEqual({ subtitle: "fr", quality: 720 });
    expect(trailerEngineRequest({ offered, subtitle: null, quality: null })).toEqual({ subtitle: null, quality: null });
    expect(trailerEngineRequest({ offered, subtitle: "de", quality: 480 })).toEqual({ subtitle: null, quality: null });
  });
});

describe("la qualité au lancement", () => {
  it("la plus haute offerte, pas « Auto »", () => {
    expect(trailerInitialQuality([720, 1080, 360, 480])).toBe(1080);
    expect(trailerInitialQuality([480])).toBe(480);
  });

  it("des hauteurs invalides ne comptent pas", () => {
    expect(trailerInitialQuality([0, -1, Number.NaN, 720])).toBe(720);
  });

  it("serveur d'avant, sans paliers : le flux d'aujourd'hui (Auto)", () => {
    expect(trailerInitialQuality([])).toBeNull();
  });
});
