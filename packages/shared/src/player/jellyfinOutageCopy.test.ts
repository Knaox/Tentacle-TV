import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/player";
import en from "../i18n/locales/en/player";
import { jellyfinOutageCopy, outageNoticeDurationMs, outageNoticeOccasion, OUTAGE_NOTICE_MS } from "./jellyfinOutageCopy";

/** Chaque état a SA phrase, dans les deux langues, sans le mot interdit au mobile. */

const lookup = (table: Record<string, unknown>, key: string): unknown =>
  key.replace(/^player:/, "").split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], table);

describe("le bandeau d'une panne de Jellyfin", () => {
  const states = ["restarting", "shutting-down", "down", "starting"] as const;

  it("un titre distinct par état, une phrase pour la panne qui dure", () => {
    const titles = states.map((s) => jellyfinOutageCopy(s, false)?.titleKey);
    expect(new Set(titles).size).toBe(states.length);
    expect(jellyfinOutageCopy("down", true)?.titleKey).toBe("player:jellyfinOutage.longTitle");
    expect(jellyfinOutageCopy("up", false)).toBeNull();
  });

  it("toutes les clés existent en français et en anglais, sans « téléchargement »", () => {
    for (const s of states) {
      for (const long of [false, true]) {
        const copy = jellyfinOutageCopy(s, long)!;
        for (const table of [fr, en]) {
          for (const key of [copy.titleKey, copy.hintKey]) {
            const text = lookup(table as unknown as Record<string, unknown>, key);
            expect(typeof text, key).toBe("string");
            expect(text as string).not.toMatch(/t[ée]l[ée]charg|download/i);
          }
        }
      }
    }
    expect(lookup(fr as unknown as Record<string, unknown>, "jellyfinOutage.retry")).toBe("Réessayer");
  });

  it("« docker restart » finit par « redémarre » : le titre attendu sous 10 s", () => {
    expect(lookup(fr as unknown as Record<string, unknown>, jellyfinOutageCopy("starting", false)!.titleKey.replace("player:", ""))).toMatch(/^Jellyfin redémarre/);
  });

  it("un message temporaire, qui reparaît à chaque nouvel état et quand la panne dure", () => {
    expect(outageNoticeDurationMs(false)).toBe(OUTAGE_NOTICE_MS);
    expect(outageNoticeDurationMs(true)).toBeGreaterThan(OUTAGE_NOTICE_MS);
    const occasions = new Set([
      outageNoticeOccasion("restarting", false), outageNoticeOccasion("down", false), outageNoticeOccasion("down", true),
    ]);
    expect(occasions.size).toBe(3);
    expect(outageNoticeOccasion("down", false)).toBe(outageNoticeOccasion("down", false));
  });
});
