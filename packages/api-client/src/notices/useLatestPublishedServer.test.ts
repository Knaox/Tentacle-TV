import { describe, expect, it } from "vitest";
import { readLatestPublished } from "./useLatestPublishedServer";

/** La dernière version publiée, lue dans le rapport de la carte « Serveur Tentacle » — tout le reste vaut « inconnue ». */
describe("readLatestPublished", () => {
  it("la version de `latest`, si elle se lit", () => {
    expect(readLatestPublished({ current: "1.31.4", latest: { version: "1.40.0", tag: "server-v1.40.0" } })).toBe("1.40.0");
  });

  it("rien de lisible : inconnue", () => {
    expect(readLatestPublished({ current: "1.31.4", latest: null })).toBeNull();
    expect(readLatestPublished({ latest: { version: "demain" } })).toBeNull();
    expect(readLatestPublished(null)).toBeNull();
    expect(readLatestPublished("1.40.0")).toBeNull();
  });
});
