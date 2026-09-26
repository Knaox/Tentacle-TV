/**
 * Le calcul des recommandations tel que la page le raconte : préparation,
 * compteur, bilan (à jour, échecs), passe interrompue — et l'heure de fin en
 * mots, dans la langue de l'interface.
 */

import { describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { fanoutView, relativeWhen } from "./recoFanout";

const AT = "2026-09-27T10:00:00.000Z";
const NOW = Date.parse(AT);

describe("fanoutView", () => {
  it("pendant la passe : préparation tant que les comptes ne sont pas comptés, puis un compteur", () => {
    expect(fanoutView({ running: true, processed: 0, total: 0 })).toEqual({ kind: "preparing" });
    expect(fanoutView({ running: true, processed: 3, total: 12 })).toEqual({ kind: "running", processed: 3, total: 12 });
    expect(fanoutView({ running: true, processed: 13, total: 12 })).toEqual({ kind: "running", processed: 12, total: 12 });
  });

  it("après la passe : le bilan, échecs à part", () => {
    expect(fanoutView({ running: false, processed: 12, total: 12, failed: 2, finishedAt: AT })).toEqual({
      kind: "done", upToDate: 10, failed: 2, finishedAt: AT,
    });
  });

  it("une passe arrêtée avant la fin se dit interrompue", () => {
    expect(fanoutView({ running: false, processed: 5, total: 12, failed: 0, finishedAt: AT })).toEqual({
      kind: "interrupted", processed: 5, total: 12, finishedAt: AT,
    });
  });

  it("rien à dire : pas de passe, passe à vide, serveur d'avant le bilan", () => {
    expect(fanoutView(undefined)).toBeNull();
    expect(fanoutView({ running: false, processed: 0, total: 0, failed: 0, finishedAt: null })).toBeNull();
    expect(fanoutView({ running: false, processed: 0, total: 0, failed: 0, finishedAt: AT })).toBeNull();
    expect(fanoutView({ running: false, processed: 12, total: 12 })).toBeNull();
    expect(fanoutView({ running: false, processed: 12, total: 12, finishedAt: "pas une date" })).toBeNull();
  });
});

describe("relativeWhen", () => {
  it("sous la minute, l'appelant dit « à l'instant »", () => {
    expect(relativeWhen(AT, NOW + 59_000, "fr")).toBeNull();
    expect(relativeWhen(AT, NOW, "fr")).toBeNull();
  });

  it("minutes, heures, puis jours", () => {
    expect(relativeWhen(AT, NOW + 5 * 60_000, "fr")).toBe("il y a 5 minutes");
    expect(relativeWhen(AT, NOW + 3 * 3600_000, "fr")).toBe("il y a 3 heures");
    expect(relativeWhen(AT, NOW + 26 * 3600_000, "fr")).toBe("hier");
    expect(relativeWhen(AT, NOW + 5 * 60_000, "en")).toBe("5 minutes ago");
  });
});

describe("textes du calcul", () => {
  it("existent en français et en anglais, pluriels compris", () => {
    initI18n();
    const keys = [
      "fanoutTitle", "fanoutPreparing", "fanoutProgress_one", "fanoutProgress_other", "fanoutRunningHint",
      "fanoutDone_one", "fanoutDone_other", "fanoutFailed_one", "fanoutFailed_other", "fanoutInterrupted",
      "fanoutProgressLabel", "justNow",
    ];
    for (const lng of ["fr", "en"] as const) {
      const texts = (i18n.getResourceBundle(lng, "adminMetadata") ?? {}) as Record<string, unknown>;
      for (const key of keys) expect(typeof texts[key], `${lng}:${key}`).toBe("string");
    }
  });
});
