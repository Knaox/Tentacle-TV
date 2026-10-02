import { describe, expect, it } from "vitest";
import type { TitleProvider } from "@tentacle-tv/shared";
import { TV_TITLE_ORIGIN, tvRequestOrigin, tvTitlesGate } from "./tvOrigin";

const provider: TitleProvider = {
  pluginId: "seer",
  statePath: "/titles/state",
  requestPath: "/titles/request",
  accessPath: "/titles/access",
  minePath: "/titles/mine",
  seasonsPath: null,
  gapsPath: null,
};

describe("les demandes d'un téléviseur", () => {
  it("portent l'origine « tv », quelle que soit la TV, et sa plateforme", () => {
    expect(TV_TITLE_ORIGIN).toBe("tv");
    expect(tvRequestOrigin("appletv")).toEqual({ origin: "tv", platform: "appletv" });
    expect(tvRequestOrigin("androidtv")).toEqual({ origin: "tv", platform: "androidtv" });
    expect(tvRequestOrigin("webos")).toEqual({ origin: "tv", platform: "webos" });
  });
});

describe("la garde des téléviseurs", () => {
  it("ouverte, donne l'extension, la langue et l'origine des demandes", () => {
    expect(tvTitlesGate(provider, { request: true }, "fr", "appletv")).toEqual({
      provider,
      lang: "fr",
      origin: { origin: "tv", platform: "appletv" },
    });
  });

  it("reste fermée comme avant : sans extension, sans droit déclaré ou lu, compte bloqué", () => {
    expect(tvTitlesGate(null, { request: true }, "fr", "appletv")).toBeNull();
    expect(tvTitlesGate({ ...provider, accessPath: null }, { request: true }, "fr", "appletv")).toBeNull();
    expect(tvTitlesGate(provider, { request: false }, "fr", "appletv")).toBeNull();
    expect(tvTitlesGate(provider, null, "en", "androidtv")).toBeNull();
  });
});
