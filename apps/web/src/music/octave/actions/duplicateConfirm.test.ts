import { describe, expect, it } from "vitest";
import { answerDuplicate, askDuplicate } from "./duplicateConfirm";

/** « Déjà dans la playlist — l'ajouter quand même ? » : une seule boîte, une réponse par demande (25/10). */
describe("confirmation d'un doublon de playlist", () => {
  it("« Ajouter quand même » → oui ; « Annuler » → non", async () => {
    const yes = askDuplicate("Worth It", "Soirée");
    answerDuplicate(true);
    expect(await yes).toBe(true);
    const no = askDuplicate("Worth It", "Soirée");
    answerDuplicate(false);
    expect(await no).toBe(false);
  });

  it("une demande nouvelle remplace l'ancienne, qui vaut « non » (jamais un ajout par mégarde)", async () => {
    const first = askDuplicate("A", "P");
    const second = askDuplicate("B", "P");
    expect(await first).toBe(false);
    answerDuplicate(true);
    expect(await second).toBe(true);
  });
});
