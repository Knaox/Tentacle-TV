import { describe, expect, it } from "vitest";
import {
  trailerChoose, trailerOptionKey, trailerPanelCloseKey, trailerPanelEntryKey, trailerQualityHeights,
  trailerQualityOptions, trailerSubtitleOptions, trailerTools,
} from "./trailerPanels";

describe("les boutons présents", () => {
  it("sans la capacité `trailers.player` : aucun, même avec de quoi choisir", () => {
    expect(trailerTools({ playerCapable: false, subtitleCount: 3, qualityCount: 4 })).toEqual({ subtitles: false, quality: false });
  });

  it("sous-titres dès une langue ; qualité dès deux hauteurs (rien à choisir sinon)", () => {
    expect(trailerTools({ playerCapable: true, subtitleCount: 0, qualityCount: 1 })).toEqual({ subtitles: false, quality: false });
    expect(trailerTools({ playerCapable: true, subtitleCount: 1, qualityCount: 2 })).toEqual({ subtitles: true, quality: true });
  });
});

describe("les options", () => {
  it("sous-titres : « Désactivés » d'abord, retenu par défaut ou si la piste retenue n'existe plus", () => {
    const tracks = [{ id: "fr" }, { id: "en" }];
    expect(trailerSubtitleOptions(tracks, null)).toEqual([
      { key: "off", selected: true }, { key: "fr", selected: false }, { key: "en", selected: false },
    ]);
    expect(trailerSubtitleOptions(tracks, "en").filter((o) => o.selected).map((o) => o.key)).toEqual(["en"]);
    expect(trailerSubtitleOptions(tracks, "de")[0]).toEqual({ key: "off", selected: true });
  });

  it("qualité : « Auto », puis les hauteurs décroissantes, sans doublon ni valeur absurde", () => {
    expect(trailerQualityHeights([720, 1080, 360, 720, 0, Number.NaN, -1])).toEqual([1080, 720, 360]);
    expect(trailerQualityOptions([720, 1080], null)).toEqual([
      { key: "auto", selected: true }, { key: "1080", selected: false }, { key: "720", selected: false },
    ]);
    expect(trailerQualityOptions([720, 1080], 720).filter((o) => o.selected).map((o) => o.key)).toEqual(["720"]);
    expect(trailerQualityOptions([720, 1080], 480)[0]).toEqual({ key: "auto", selected: true });
  });
});

describe("les clés et l'entrée d'un panneau", () => {
  it("les clés de la feuille du grand lecteur (`PlayerSheet`)", () => {
    expect(trailerOptionKey("subtitles", "fr")).toBe("trailerSubtitles:list:fr");
    expect(trailerOptionKey("quality", "1080")).toBe("trailerQuality:list:1080");
    expect(trailerPanelCloseKey("subtitles")).toBe("trailerSubtitles:close");
  });

  it("le panneau s'ouvre sur l'option retenue", () => {
    expect(trailerPanelEntryKey("quality", trailerQualityOptions([720, 1080], 1080))).toBe("trailerQuality:list:1080");
    expect(trailerPanelEntryKey("subtitles", trailerSubtitleOptions([{ id: "fr" }], null))).toBe("trailerSubtitles:list:off");
    expect(trailerPanelEntryKey("subtitles", [])).toBe("trailerSubtitles:close");
  });
});

describe("un choix", () => {
  it("ferme toujours le panneau ; s'applique seulement s'il change quelque chose", () => {
    const options = trailerQualityOptions([720, 1080], null);
    expect(trailerChoose("quality", options, "720")).toEqual({ panel: "quality", apply: "720", close: true });
    expect(trailerChoose("quality", options, "auto")).toEqual({ panel: "quality", apply: null, close: true });
  });
});
