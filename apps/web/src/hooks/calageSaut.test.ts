import { describe, expect, it } from "vitest";
import {
  observerSaut, SAUT_VIDE, DELAI_CALAGE_SAUT_MS, PERIODE_VEILLE_SAUT_MS,
  PROGRESSION_MINIMALE_S, TOLERANCE_ATTERRISSAGE_S,
  type EchantillonSaut, type VerdictSaut,
} from "./calageSaut";

/**
 * Ce que ces cas protègent ne se voit qu'à l'usage : un faux « abouti » laisse le
 * film figé pour de bon, puisque plus personne ne viendra redemander une session
 * au serveur. Un faux « renégocier » coupe une lecture qui allait bien et fait
 * repartir un transcodage de trois à cinq secondes. Les deux erreurs sont chères,
 * dans des sens opposés.
 */

const CIBLE = 2700;

const releve = (ecoule: number, extra: Partial<EchantillonSaut> = {}): EchantillonSaut =>
  ({ cible: CIBLE, position: CIBLE, bufferFin: null, enPause: false, pret: 4, ecoule, ...extra });

/** Déroule une suite de relevés et rend le verdict de chacun. */
function derouler(echantillons: EchantillonSaut[]): VerdictSaut[] {
  let etat = SAUT_VIDE;
  const verdicts: VerdictSaut[] = [];
  for (const e of echantillons) {
    const [suivant, verdict] = observerSaut(etat, e);
    etat = suivant;
    verdicts.push(verdict);
  }
  return verdicts;
}

describe("saut qui aboutit", () => {
  it("conclut dès que la vidéo avance au voisinage de la cible", () => {
    const verdicts = derouler([releve(0), releve(PERIODE_VEILLE_SAUT_MS, { position: CIBLE + 1 })]);
    expect(verdicts).toEqual(["attendre", "abouti"]);
  });

  it("conclut sur un saut fait à l'arrêt quand le serveur a servi au-delà", () => {
    // À l'arrêt rien n'avancera jamais : sans cette règle, une pause sur une
    // cible parfaitement chargée attendrait indéfiniment.
    const arret = { enPause: true, bufferFin: CIBLE + 30 };
    expect(derouler([releve(0, arret), releve(1000, arret)])).toContain("abouti");
  });
});

describe("saut qui n'aboutit pas", () => {
  /**
   * La régression à ne pas commettre. Le filet précédent comparait `currentTime`
   * à la cible — or la ligne qui pose le saut vient d'écrire cette valeur, et
   * l'écriture est synchrone. La position À la cible ne prouve donc rien, et
   * c'est exactement pour cela que le niveau 3 n'était jamais atteint.
   */
  it("ne prend pas une position posée à la cible pour un saut réussi", () => {
    expect(derouler([releve(0), releve(DELAI_CALAGE_SAUT_MS)])).toEqual(["attendre", "renegocier"]);
  });

  /**
   * L'autre régression, propre au téléviseur : `buffered` y rend TOUJOURS une
   * plage unique partant de zéro. Juger sur « la cible est dans le tampon »
   * rendrait « abouti » d'office à tout saut en arrière — le cas le plus
   * fréquent — et le filet ne servirait à rien.
   */
  it("ne se fie pas à un tampon qui part de zéro", () => {
    const enArriere = { cible: 600, position: 600, bufferFin: 3000 };
    expect(derouler([releve(0, enArriere), releve(DELAI_CALAGE_SAUT_MS, enArriere)]))
      .toEqual(["attendre", "renegocier"]);
  });

  it("ne prend pas une reprise LOIN de la cible pour un atterrissage", () => {
    // Mesuré : la pile rejoue une seconde d'une position ancienne avant de se
    // figer. Ça avance, mais pas là où on l'avait envoyée.
    const ailleurs = CIBLE - TOLERANCE_ATTERRISSAGE_S - 100;
    const verdicts = derouler([
      releve(0, { position: ailleurs }),
      releve(DELAI_CALAGE_SAUT_MS, { position: ailleurs + 1 }),
    ]);
    expect(verdicts).not.toContain("abouti");
  });

  it("laisse au serveur le temps d'écrire avant de tout redemander", () => {
    // Un saut qui ABOUTIT a été mesuré à 4,5 s : l'échéance ne doit pas bouger.
    const attente = derouler([0, 1000, 4500, DELAI_CALAGE_SAUT_MS - 1].map((ms) => releve(ms)));
    expect(attente.every((v) => v === "attendre")).toBe(true);
  });
});

describe("pause pendant le déplacement", () => {
  it("n'escalade pas sous les doigts de l'utilisateur", () => {
    const verdicts = derouler([releve(0), releve(DELAI_CALAGE_SAUT_MS * 2, { enPause: true })]);
    expect(verdicts).not.toContain("renegocier");
  });

  it("ne confond pas une progression minuscule avec une reprise", () => {
    const verdicts = derouler([
      releve(0),
      releve(DELAI_CALAGE_SAUT_MS, { position: CIBLE + PROGRESSION_MINIMALE_S / 2 }),
    ]);
    expect(verdicts.at(-1)).toBe("renegocier");
  });
});
