import { describe, expect, it } from "vitest";
import { NO_ACCOUNT_ABILITIES, parseAccountAbilities } from "@tentacle-tv/shared";
import { mayShow, watchTogetherAbility } from "./accountAbilitiesGate";

/** Un geste n'apparaît qu'une fois permis ; un serveur d'avant garde le comportement d'avant. */

describe("mayShow", () => {
  it("su : le droit tel que le serveur le dit", () => {
    const abilities = parseAccountAbilities({ keepOffline: true, tickets: false, watchTogether: "joinOnly" });
    expect(mayShow({ kind: "known", abilities }, "keepOffline")).toBe(true);
    expect(mayShow({ kind: "known", abilities }, "tickets")).toBe(false);
    expect(watchTogetherAbility({ kind: "known", abilities })).toBe("joinOnly");
  });

  it("pas encore su : rien ne s'affiche", () => {
    expect(mayShow({ kind: "pending" }, "keepOffline")).toBe(false);
    expect(watchTogetherAbility({ kind: "pending" })).toBe("none");
  });

  it("serveur d'avant : la règle d'avant de l'écran", () => {
    expect(mayShow({ kind: "legacy" }, "tickets")).toBe(true);
    expect(mayShow({ kind: "legacy" }, "invites", false)).toBe(false);
    expect(watchTogetherAbility({ kind: "legacy" }, "joinOnly")).toBe("joinOnly");
  });

  it("réponse illisible : rien de permis (fermé à l'échec)", () => {
    expect(parseAccountAbilities("oops")).toEqual(NO_ACCOUNT_ABILITIES);
    expect(parseAccountAbilities({ playback: "oui", session: "root" })).toMatchObject({ playback: false, session: "personal" });
  });
});
