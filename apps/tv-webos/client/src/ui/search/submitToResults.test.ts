import { describe, expect, it } from "vitest";
import { submitAnswer, type AnswerState } from "./submitToResults";

/** Une réponse à « dune » à l'écran, trois rangées : l'état qu'on atteint en tapant sans se presser. */
const ANSWERED: AnswerState = {
  typed: "dune",
  debounced: "dune",
  current: true,
  fetching: false,
  failed: false,
  sections: 3,
};

describe("validation de la saisie", () => {
  it("mène aux résultats quand la réponse à ce qui est tapé est à l'écran", () => {
    expect(submitAnswer(ANSWERED)).toBe("results");
  });

  it("attend la réponse quand la dernière lettre n'a pas encore été envoyée", () => {
    // Valider aussitôt après la frappe : le délai de 250 ms n'est pas écoulé.
    expect(submitAnswer({ ...ANSWERED, typed: "dune ", debounced: "dun" })).toBe("pending");
  });

  it("ne prend pas la réponse d'une frappe précédente pour la bonne", () => {
    // `current` faux : ce sont les rangées de « dun », gardées pendant la requête.
    expect(submitAnswer({ ...ANSWERED, current: false, fetching: true })).toBe("pending");
  });

  it("attend encore tant qu'une réponse vide peut se remplir", () => {
    expect(submitAnswer({ ...ANSWERED, sections: 0, fetching: true })).toBe("pending");
  });

  it("reste à la barre quand il n'y a rien à atteindre", () => {
    expect(submitAnswer({ ...ANSWERED, sections: 0 })).toBe("none");
    expect(submitAnswer({ ...ANSWERED, typed: "   ", debounced: "" })).toBe("none");
    expect(submitAnswer({ ...ANSWERED, failed: true })).toBe("none");
  });

  it("ignore les espaces de fin, comme la requête", () => {
    expect(submitAnswer({ ...ANSWERED, typed: "dune  " })).toBe("results");
  });
});
