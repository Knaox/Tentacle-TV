/**
 * La carte TMDB avant tout appel (l'indice de format) et après (le message de
 * chaque verdict) — et la garantie que chaque message existe en FR et en EN :
 * `t()` rendrait sinon la clé brute, sans un mot du compilateur.
 */

import { describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { saveNotice, testNotice, tmdbKeyHint } from "./tmdbKey";

function bundle(lng: "fr" | "en"): Record<string, unknown> {
  initI18n();
  return (i18n.getResourceBundle(lng, "adminMetadata") ?? {}) as Record<string, unknown>;
}

describe("tmdbKeyHint", () => {
  it("une clé v3 (32 caractères hexadécimaux) ne soulève rien, espaces tolérés", () => {
    expect(tmdbKeyHint("0123456789abcdefABCDEF0123456789")).toBeNull();
    expect(tmdbKeyHint("  0123456789abcdef0123456789abcdef \n")).toBeNull();
    expect(tmdbKeyHint("   ")).toBeNull();
  });

  it("reconnaît le jeton v4 collé à sa place, « Bearer » compris", () => {
    expect(tmdbKeyHint("eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.sig")).toBe("v4-token");
    expect(tmdbKeyHint("Bearer eyJhbGciOiJIUzI1NiJ9.x.y")).toBe("v4-token");
  });

  it("signale une forme inattendue sans la juger", () => {
    expect(tmdbKeyHint("0123456789abcdef")).toBe("format");
    expect(tmdbKeyHint("0123456789abcdef0123456789abcdeg")).toBe("format");
  });
});

describe("messages de la carte TMDB", () => {
  const outcomes = ["valid", "invalid", "unreachable", "tmdb-key-invalid", "tmdb-unreachable", "tmdb-key-missing", "unsupported", "failed"] as const;

  it("un refus de TMDB n'est pas une panne de réseau", () => {
    expect(testNotice("invalid", false)).toEqual({ tone: "error", key: "testInvalid" });
    expect(testNotice("invalid", true)).toEqual({ tone: "error", key: "testInvalidSaved" });
    expect(testNotice("unreachable", true)).toEqual({ tone: "warning", key: "testUnreachable" });
    expect(saveNotice("tmdb-key-invalid")).toEqual({ tone: "error", key: "saveInvalid" });
    expect(saveNotice("tmdb-unreachable")).toEqual({ tone: "warning", key: "saveUnreachable" });
    expect(saveNotice("failed")).toEqual({ tone: "error", key: "saveFailed" });
  });

  it("chaque message existe en français et en anglais", () => {
    const keys = new Set<string>();
    for (const outcome of outcomes) {
      keys.add(testNotice(outcome, false).key);
      keys.add(testNotice(outcome, true).key);
      if (outcome !== "valid" && outcome !== "invalid" && outcome !== "unreachable") keys.add(saveNotice(outcome).key);
    }
    for (const lng of ["fr", "en"] as const) {
      const texts = bundle(lng);
      for (const key of keys) expect(typeof texts[key], `${lng}:${key}`).toBe("string");
    }
  });

  it("les deux langues portent exactement les mêmes clés", () => {
    expect(Object.keys(bundle("en")).sort()).toEqual(Object.keys(bundle("fr")).sort());
  });
});
