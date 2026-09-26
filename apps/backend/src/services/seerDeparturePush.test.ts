import { describe, expect, it } from "vitest";
import { departurePushBody, parseSeerDeparture } from "./seerDeparturePush";

describe("départ d'une demande Seer", () => {
  it("reconnaît le texte écrit par Vigie, et lui seul", () => {
    expect(parseSeerDeparture({ body: "« Dune » est en route" })).toBe("Dune");
    expect(parseSeerDeparture({ body: "« Dune » est sorti sur Tentacle TV" })).toBeNull();
    expect(parseSeerDeparture({ body: "Votre demande pour « Dune » a été refusée" })).toBeNull();
    expect(parseSeerDeparture({ body: null })).toBeNull();
  });

  it("parle la langue de l'utilisateur", () => {
    expect(departurePushBody("Dune", "en")).toBe("“Dune” is on its way");
    expect(departurePushBody("Dune", "fr")).toBe("« Dune » est en route");
  });
});
