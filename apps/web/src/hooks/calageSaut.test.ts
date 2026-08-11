import { describe, expect, it } from "vitest";
import {
  jugerSaut, AVANCE_PROUVEE_S, DELAI_CALAGE_SAUT_MS,
  type EchantillonSaut,
} from "./calageSaut";

/**
 * Ce que ces cas protègent ne se voit qu'à l'usage : un faux « abouti » laisse le
 * film figé pour de bon, puisque plus personne ne viendra redemander une session
 * au serveur. Un faux « renégocier » coupe une lecture qui allait bien et fait
 * repartir un transcodage de trois à cinq secondes. Les deux erreurs sont chères,
 * dans des sens opposés.
 */

const releve = (ecoule: number, extra: Partial<EchantillonSaut> = {}): EchantillonSaut =>
  ({ cible: 2700, couverte: false, position: 2700, enPause: false, ecoule, ...extra });

describe("saut qui aboutit", () => {
  it("conclut dès que les données de la cible sont là, sans attendre le délai", () => {
    expect(jugerSaut(releve(0, { couverte: true }))).toBe("abouti");
  });

  it("conclut quand la lecture a franchi la cible d'elle-même", () => {
    // La pile native de LG ne renseigne pas toujours `buffered` fidèlement. Des
    // images sorties au-delà de la cible sont une preuve tout aussi bonne.
    expect(jugerSaut(releve(3000, { position: 2700 + AVANCE_PROUVEE_S + 0.1 }))).toBe("abouti");
  });
});

describe("saut qui n'aboutit pas", () => {
  /**
   * La régression à ne pas commettre. Le filet précédent comparait `currentTime`
   * à la cible — or la ligne qui pose le saut vient d'écrire cette valeur, et
   * l'écriture est synchrone. La position À la cible ne prouve donc rien du tout,
   * et c'est exactement pour cela que le niveau 3 n'était jamais atteint.
   */
  it("ne prend pas une position posée à la cible pour un saut réussi", () => {
    expect(jugerSaut(releve(DELAI_CALAGE_SAUT_MS + 1))).toBe("renegocier");
  });

  it("laisse au serveur le temps d'écrire avant de tout redemander", () => {
    const attente = [0, 1000, 4000, DELAI_CALAGE_SAUT_MS - 1].map((ms) => jugerSaut(releve(ms)));
    expect(attente).not.toContain("renegocier");
    expect(attente.every((v) => v === "attendre")).toBe(true);
  });

  it("escalade une fois le délai passé", () => {
    expect(jugerSaut(releve(DELAI_CALAGE_SAUT_MS))).toBe("renegocier");
  });
});

describe("pause pendant le déplacement", () => {
  it("n'escalade pas sous les doigts de l'utilisateur", () => {
    // Renégocier ferait repartir la lecture alors qu'il vient de l'arrêter.
    expect(jugerSaut(releve(DELAI_CALAGE_SAUT_MS * 2, { enPause: true }))).toBe("attendre");
  });

  it("ne désarme pas pour autant : la cible chargée reste un aboutissement", () => {
    expect(jugerSaut(releve(0, { enPause: true, couverte: true }))).toBe("abouti");
  });
});
