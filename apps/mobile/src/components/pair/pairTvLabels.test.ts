import { describe, expect, it } from "vitest";
import frPairing from "../../../../../packages/shared/src/i18n/locales/fr/pairing";
import enPairing from "../../../../../packages/shared/src/i18n/locales/en/pairing";
import frCommon from "../../../../../packages/shared/src/i18n/locales/fr/common";
import enCommon from "../../../../../packages/shared/src/i18n/locales/en/common";

/** Le mot que le mobile n'écrit jamais (CLAUDE.md, espace `offline`). */
const FORBIDDEN = /t[ée]l[ée]charg|download/i;

/** Ce que lit « Appareils et TV » : PairTvSection, PairTvCard, PairedDevicesSection. */
const PAIRING_KEYS = [
  "pairYourTV", "enterTVCode", "codeExpireNote", "pairTV", "tvPairedSuccess", "pairAnotherTv",
  "pairedDevices", "noPairedDevices", "lastActive", "revoke", "revokeConfirm", "devicesLoadError", "cancel",
] as const;

describe("libellés d'« Appareils et TV »", () => {
  it("existent en français et en anglais, sans le mot interdit", () => {
    const tables: [string, Record<string, unknown>, Record<string, unknown>, readonly string[]][] = [
      ["pairing", frPairing, enPairing, PAIRING_KEYS],
      // « Réessayer » : lu dans common (pairing:retry n'existe pas).
      ["common", frCommon, enCommon, ["retry"]],
    ];
    for (const [ns, fr, en, keys] of tables) {
      for (const key of keys) {
        expect(fr[key], `${ns}:${key} (fr)`).toBeTypeOf("string");
        expect(en[key], `${ns}:${key} (en)`).toBeTypeOf("string");
        expect(FORBIDDEN.test(`${fr[key]} ${en[key]}`), `${ns}:${key}`).toBe(false);
      }
    }
  });
});
