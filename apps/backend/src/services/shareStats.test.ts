import { describe, expect, it } from "vitest";
import { readStatsShareOptions, writeStatsShareOptions } from "./shareStats";

/** Les réglages d'un lien de statistiques relus de la base : jamais une page qui plante sur une ligne abîmée. */
describe("les réglages d'un lien de statistiques", () => {
  it("se relisent comme ils ont été écrits", () => {
    const raw = writeStatsShareOptions({ period: "30d", timeZone: "Europe/Paris" });
    expect(raw).toBe('{"period":"30d","tz":"Europe/Paris"}');
    expect(readStatsShareOptions(raw)).toEqual({ period: "30d", timeZone: "Europe/Paris" });
  });

  it("retombent sur « depuis le début », en UTC, quand la ligne est vide ou abîmée", () => {
    for (const raw of [null, undefined, "", "pas du json", "[]", '{"period":"toujours","tz":42}', '{"tz":"Nulle/Part"}']) {
      expect(readStatsShareOptions(raw), String(raw)).toEqual({ period: "all", timeZone: "UTC" });
    }
  });
});
