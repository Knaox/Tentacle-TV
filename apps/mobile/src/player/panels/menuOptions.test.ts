import { describe, expect, it } from "vitest";
import type { QualityPreset } from "@tentacle-tv/shared";
import { SUBTITLES_OFF, qualityOptions, subtitleOptions, trackOption } from "./menuOptions";

const presets: QualityPreset[] = [
  { key: "original", bitrate: null, width: null, height: null },
  { key: "quality1080p", bitrate: 8_000_000, width: 1920, height: 1080 },
  { key: "quality720p", bitrate: 4_000_000, width: 1280, height: 720 },
];
const source = { resolution: "4K" as const, isHDR: true, isDolbyVision: true, isDolbyAtmos: true };
const label = (key: string) => key;

describe("options des menus du lecteur", () => {
  it("une piste : le nom en titre, langue et format en détail", () => {
    const option = trackOption({ index: 2, label: "Français - Dolby Digital 5.1 - AC3" }, 2);
    expect(option.selected).toBe(true);
    expect(option.title).not.toContain("AC3");
    expect(option.detail).toContain("AC3");
  });

  it("sous-titres : « Désactivés » d'abord, coché quand rien n'est choisi", () => {
    const options = subtitleOptions([{ index: 4, label: "English" }], SUBTITLES_OFF, "Off");
    expect(options.map((o) => o.title)).toEqual(["Off", "English"]);
    expect(options[0].selected).toBe(true);
    expect(options[1].selected).toBe(false);
  });

  it("qualité : l'Original dit la source, une seule plage HDR (Dolby Vision prime)", () => {
    const [original] = qualityOptions({ presets, current: "original", auto: false, source, label, autoLabel: "Auto" });
    expect(original.detail).toBe("4K");
    expect(original.tags).toEqual(["Dolby Vision", "Atmos"]);
    expect(original.trailing).toBeUndefined();
  });

  it("qualité : le débit en bout de ligne, « Auto » sur le palier pris par le mode automatique", () => {
    const options = qualityOptions({ presets, current: "quality1080p", auto: true, source, label, autoLabel: "Auto" });
    expect(options[1].selected).toBe(true);
    expect(options[1].trailing).toBe("Auto · 8 Mbps");
    expect(options[2].trailing).toBe("4 Mbps");
  });

  it("qualité : un choix manuel éteint « Auto »", () => {
    const options = qualityOptions({ presets, current: "quality720p", auto: false, source, label, autoLabel: "Auto" });
    expect(options[2].trailing).toBe("4 Mbps");
  });
});
