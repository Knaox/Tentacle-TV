/**
 * Le parsing des droits — et surtout ce qu'il fait d'un serveur ANCIEN, qui
 * ignore le découplage remux / Allégé. Le lire à `false` retirerait le remux à
 * des comptes qui l'ont : les champs absents suivent donc `lightDownloads`.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_LIGHT_PRESETS, NO_CAPABILITIES, parseCapabilities } from "./capabilities";

describe("parseCapabilities", () => {
  it("un serveur récent est lu tel qu'il parle", () => {
    expect(
      parseCapabilities({
        downloads: true,
        remuxDownloads: true,
        lightDownloads: false,
        audioConversion: false,
        lightPresets: ["pmax"],
      }),
    ).toEqual({
      downloads: true,
      remuxDownloads: true,
      lightDownloads: false,
      audioConversion: false,
      lightPresets: ["pmax"],
    });
  });

  it("un serveur ancien qui autorise l'Allégé garde son remux", () => {
    const caps = parseCapabilities({ downloads: true, lightDownloads: true });
    expect(caps.remuxDownloads).toBe(true);
    expect(caps.audioConversion).toBe(true);
    expect(caps.lightPresets).toEqual(DEFAULT_LIGHT_PRESETS);
  });

  it("un serveur ancien sans Allégé n'ouvre rien de plus qu'avant", () => {
    const caps = parseCapabilities({ downloads: true, lightDownloads: false });
    expect(caps.remuxDownloads).toBe(false);
    expect(caps.lightPresets).toEqual([]);
  });

  it("tout ce qui n'est pas explicitement vrai est faux", () => {
    expect(parseCapabilities({ downloads: "oui", lightDownloads: 1 })).toEqual(NO_CAPABILITIES);
  });

  it("une réponse qui n'est pas un objet ne donne aucun droit", () => {
    expect(parseCapabilities(null)).toEqual(NO_CAPABILITIES);
    expect(parseCapabilities("nope")).toEqual(NO_CAPABILITIES);
  });

  it("un serveur récent qui n'annonce QUE pmax le dit sans détour", () => {
    const caps = parseCapabilities({
      downloads: true,
      remuxDownloads: true,
      lightDownloads: false,
      audioConversion: true,
      lightPresets: ["pmax"],
    });
    expect(caps.lightPresets).toEqual(["pmax"]);
  });
});
