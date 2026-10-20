import { describe, expect, it } from "vitest";
import { asksNowhere, launchSettingsBody, launchSettingsOf, sameLaunchSettings, togglePlatform } from "./launchSettingsModel";

const ALL = { desktop: true, web: true, mobile: true, tv: true };

describe("« Qui regarde ? à l'ouverture » — le brouillon de l'administration", () => {
  it("part de la réponse du serveur ; ses défauts là où elle ne dit rien", () => {
    expect(launchSettingsOf({ desktop: { mode: "choice", defaultOn: true }, tv: { mode: "off" } })).toEqual({ enabled: true, platforms: ALL });
    expect(launchSettingsOf({
      desktop: { mode: "off", defaultOn: true }, tv: { mode: "off" }, enabled: false, platforms: { ...ALL, web: false },
    })).toEqual({ enabled: false, platforms: { ...ALL, web: false } });
  });

  it("cocher, décocher : le brouillon change, l'original non ; « Enregistrer » envoie la forme simple entière", () => {
    const saved = { enabled: true, platforms: ALL };
    const draft = togglePlatform(saved, "tv", false);
    expect(saved.platforms.tv).toBe(true);
    expect(sameLaunchSettings(draft, saved)).toBe(false);
    expect(sameLaunchSettings(togglePlatform(draft, "tv", true), saved)).toBe(true);
    expect(launchSettingsBody(draft)).toEqual({ enabled: true, platforms: { ...ALL, tv: false } });
  });

  it("allumé sans aucune case : à dire ; coupé, non", () => {
    const none = { desktop: false, web: false, mobile: false, tv: false };
    expect(asksNowhere({ enabled: true, platforms: none })).toBe(true);
    expect(asksNowhere({ enabled: false, platforms: none })).toBe(false);
    expect(asksNowhere({ enabled: true, platforms: { ...none, mobile: true } })).toBe(false);
  });
});
