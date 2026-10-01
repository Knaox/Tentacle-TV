import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initI18n } from "@tentacle-tv/shared";

/**
 * Les mots du voile hors ligne de la LG se résolvent pour de vrai, en français
 * et en anglais. Une clé retirée ne casse pas le typage : la LG afficherait la
 * clé brute. Le test lit les clés que le composant EMPLOIE (son source) et les
 * fait résoudre par l'initialisation de la LG (`initI18n`, puis `getFixedT`,
 * exactement ce que fait le hook partagé de `shims/reactI18next.ts`).
 */

const source = readFileSync(new URL("./OfflineBannerTv.tsx", import.meta.url), "utf8");

/** `t("…")` lit l'espace `common`, `tPairing("…")` l'espace `pairing`. */
function usedKeys(): Array<{ ns: string; key: string }> {
  const keys: Array<{ ns: string; key: string }> = [];
  for (const [, fn, key] of source.matchAll(/\b(t|tPairing)\("([^"]+)"\)/g)) {
    keys.push({ ns: fn === "tPairing" ? "pairing" : "common", key });
  }
  return keys;
}

const i18n = initI18n({ lng: "fr" });

describe("le voile hors ligne de la LG parle les deux langues", () => {
  it("emploie bien les clés du déjumelage des réglages", () => {
    expect(usedKeys().filter((k) => k.ns === "pairing").map((k) => k.key).sort())
      .toEqual(["tvUnpairConfirm", "tvUnpairDevice", "tvUnpairHint"]);
  });

  for (const language of ["fr", "en"]) {
    it(`résout chaque clé employée en ${language}`, () => {
      for (const { ns, key } of usedKeys()) {
        const text = i18n.getFixedT(language, ns)(key);
        expect(text, `${ns}:${key}`).not.toBe(key);
        expect(text.length, `${ns}:${key}`).toBeGreaterThan(0);
      }
    });
  }

  it("dit « Déjumeler cet appareil » et « Unpair this device »", () => {
    expect(i18n.getFixedT("fr", "pairing")("tvUnpairDevice")).toBe("Déjumeler cet appareil");
    expect(i18n.getFixedT("en", "pairing")("tvUnpairDevice")).toBe("Unpair this device");
    expect(i18n.getFixedT("fr", "pairing")("tvUnpairConfirm")).toBe("Confirmer le déjumelage");
    expect(i18n.getFixedT("en", "pairing")("tvUnpairHint")).toBe("Press OK again: this TV will forget your account.");
  });
});
