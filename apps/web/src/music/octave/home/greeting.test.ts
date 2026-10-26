import { describe, expect, it } from "vitest";
import { initI18n } from "@tentacle-tv/shared";
import { greetingMoment, greetingName, pickGreeting } from "./greeting";

/** 26 octobre 2026 = un lundi. */
const at = (day: number, hour: number) => new Date(2026, 9, 26 + day, hour, 30);

describe("greetingMoment", () => {
  it("découpe la journée", () => {
    expect([2, 7, 12, 15, 19, 23].map(greetingMoment)).toEqual(["lateNight", "morning", "midday", "afternoon", "evening", "night"]);
  });
});

describe("pickGreeting", () => {
  it("est stable dans un même moment de la journée", () => {
    const a = pickGreeting({ now: new Date(2026, 9, 27, 14, 1), name: null, artist: null });
    const b = pickGreeting({ now: new Date(2026, 9, 27, 17, 59), name: null, artist: null });
    expect(a).toEqual(b);
  });

  it("varie d'un jour à l'autre", () => {
    const keys = new Set(Array.from({ length: 14 }, (_, d) => pickGreeting({ now: at(d, 19), name: null, artist: null }).key));
    expect(keys.size).toBeGreaterThan(1);
  });

  it("dit le prénom par la variante _name", () => {
    const g = pickGreeting({ now: at(1, 9), name: "Damien", artist: null });
    expect(g.key.endsWith("_name")).toBe(true);
    expect(g.params.name).toBe("Damien");
  });

  it("parle de l'artiste seulement quand on en a un, jamais en pleine nuit", () => {
    const withArtist = Array.from({ length: 30 }, (_, d) => pickGreeting({ now: at(d, 15), name: null, artist: "Daft Punk" }));
    expect(withArtist.some((g) => g.params.artist === "Daft Punk")).toBe(true);
    const night = Array.from({ length: 30 }, (_, d) => pickGreeting({ now: at(d, 3), name: null, artist: "Daft Punk" }));
    expect(night.every((g) => !g.key.includes("artist"))).toBe(true);
    const none = Array.from({ length: 30 }, (_, d) => pickGreeting({ now: at(d, 15), name: null, artist: null }));
    expect(none.every((g) => !g.key.includes("artist"))).toBe(true);
  });

  it("connaît le vendredi soir et le week-end", () => {
    const friday = Array.from({ length: 20 }, (_, i) => pickGreeting({ now: at(4, 19), name: null, artist: null, seed: `u${i}` }).key);
    expect(friday).toContain("octaveHome.greet.fridayEvening");
    const saturday = Array.from({ length: 20 }, (_, i) => pickGreeting({ now: at(5, 9), name: null, artist: null, seed: `u${i}` }).key);
    expect(saturday).toContain("octaveHome.greet.weekendMorning");
  });

  const i18n = initI18n({ lng: "fr" });

  it("chaque clé possible existe en français et en anglais, avec ses variables", () => {
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        for (const seed of ["a", "b", "c", "d", "e", "f"]) {
          for (const name of [null, "Léa"]) {
            const g = pickGreeting({ now: at(day, hour), name, artist: "Air", seed });
            for (const lng of ["fr", "en"]) {
              const text: unknown = i18n.getResource(lng, "music", g.key);
              expect(text, `${g.key} manque (${lng})`).toBeTypeOf("string");
              for (const v of Object.keys(g.params)) expect(text).toContain(`{{${v}}}`);
              expect(String(text).includes("{{name}}")).toBe(name !== null);
            }
          }
        }
      }
    }
  });
});

describe("greetingName", () => {
  it("garde un prénom et le met en capitale", () => {
    expect(greetingName("damien")).toBe("Damien");
    expect(greetingName("Léa Martin")).toBe("Léa");
    expect(greetingName("jean.dupont")).toBe("Jean");
  });
  it("ne dit pas un identifiant", () => {
    expect(greetingName("oa1")).toBeNull();
    expect(greetingName("admin")).toBeNull();
    expect(greetingName("x")).toBeNull();
    expect(greetingName("")).toBeNull();
    expect(greetingName(null)).toBeNull();
  });
});
