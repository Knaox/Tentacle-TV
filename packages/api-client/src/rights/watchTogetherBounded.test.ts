import { describe, expect, it } from "vitest";
import { bounded } from "./useWatchTogetherAccess";

/** L'accès Watch Together du compte, borné par ce que la SESSION peut (`account.abilities`). */
describe("Watch Together borné par les droits de la session", () => {
  const full = { access: "full" as const, mayCreate: true, mayJoin: true };

  it("tout permis : rien ne change", () => {
    expect(bounded(full, "full")).toEqual(full);
  });

  it("rejoindre seulement : plus rien qui crée un salon", () => {
    expect(bounded(full, "joinOnly")).toEqual({ access: "full", mayCreate: false, mayJoin: true });
  });

  it("rien (un invité, ou la réponse pas encore là) : plus aucune trace", () => {
    expect(bounded(full, "none")).toEqual({ access: "full", mayCreate: false, mayJoin: false });
  });

  it("jamais plus que l'accès du compte", () => {
    const joinOnly = { access: "joinOnly" as const, mayCreate: false, mayJoin: true };
    expect(bounded(joinOnly, "full")).toEqual(joinOnly);
  });
});
