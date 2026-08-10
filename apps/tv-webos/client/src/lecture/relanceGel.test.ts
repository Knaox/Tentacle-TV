import { describe, expect, it } from "vitest";
import {
  observer, VEILLE_VIDE, RELEVES_AVANT_GEL, RELANCES_MAX,
  MEDIA_ERR_NETWORK, type EchantillonLecture, type EtatVeille, type Verdict,
} from "./relanceGel";

/**
 * Ce qui se joue ici ne se voit pas non plus : un faux positif RECHARGE la
 * source, donc coupe une lecture qui allait bien. Un faux négatif laisse le film
 * figé pour de bon. Les deux erreurs sont chères, dans des sens opposés.
 */

const lecture = (position: number, extra: Partial<EchantillonLecture> = {}): EchantillonLecture =>
  ({ position, enPause: false, pret: 4, erreur: null, ...extra });

/** Déroule une suite de relevés et rend le dernier verdict de chacun. */
function derouler(echantillons: EchantillonLecture[]): { verdicts: Verdict[]; etat: EtatVeille } {
  let etat = VEILLE_VIDE;
  const verdicts: Verdict[] = [];
  for (const e of echantillons) {
    const [suivant, verdict] = observer(etat, e);
    etat = suivant;
    verdicts.push(verdict);
  }
  return { verdicts, etat };
}

describe("lecture qui avance", () => {
  it("ne touche à rien tant que la position progresse", () => {
    const { verdicts } = derouler([lecture(10), lecture(12), lecture(14), lecture(16), lecture(18)]);
    expect(verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne compte pas une pause voulue comme un gel", () => {
    const arret = Array.from({ length: 8 }, () => lecture(42, { enPause: true }));
    const { verdicts } = derouler(arret);
    expect(verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne confond pas un chargement avec un gel", () => {
    // Pendant un buffering la position stagne aussi, mais `readyState` retombe.
    // Sans cette garde, on rechargerait la source au moindre ralentissement —
    // en aggravant exactement ce qu'on veut corriger.
    const attente = Array.from({ length: 8 }, () => lecture(42, { pret: 2 }));
    const { verdicts } = derouler(attente);
    expect(verdicts.every((v) => v === "rien")).toBe(true);
  });
});

describe("lecture figée", () => {
  it("relance après assez de relevés immobiles, pas avant", () => {
    const fige = Array.from({ length: RELEVES_AVANT_GEL + 1 }, () => lecture(2719.5));
    const { verdicts } = derouler([lecture(2719.5), ...fige]);
    // Le premier relevé sert de référence, les suivants comptent.
    expect(verdicts.filter((v) => v === "relancer")).toHaveLength(1);
    expect(verdicts.indexOf("relancer")).toBe(RELEVES_AVANT_GEL);
  });

  it("relance sans attendre sur une erreur réseau", () => {
    // `MEDIA_ERR_NETWORK` est déjà la preuve que le lecteur a renoncé : il n'y a
    // rien à confirmer. C'est le code que l'échelle de repli n'écoutait pas, et
    // le film restait figé sans que personne ne le sache.
    const { verdicts } = derouler([lecture(100), lecture(100, { erreur: MEDIA_ERR_NETWORK })]);
    expect(verdicts[1]).toBe("relancer");
  });

  it("repart proprement une fois la lecture reprise", () => {
    const { etat } = derouler([lecture(100), lecture(100), lecture(100), lecture(100), lecture(106)]);
    expect(etat.immobiles).toBe(0);
    // La progression efface le compteur de relances : un gel une heure plus tard
    // ne doit pas hériter de celui du début de film.
    expect(etat.relances).toBe(0);
  });

  it("abandonne plutôt que de hacher la lecture indéfiniment", () => {
    let etat = VEILLE_VIDE;
    const verdicts: Verdict[] = [];
    // Une position qui ne bouge JAMAIS, quoi qu'on tente.
    for (let i = 0; i < (RELEVES_AVANT_GEL + 1) * (RELANCES_MAX + 2); i += 1) {
      const [suivant, verdict] = observer(etat, lecture(2719.5));
      etat = suivant;
      if (verdict !== "rien") verdicts.push(verdict);
    }
    expect(verdicts.filter((v) => v === "relancer")).toHaveLength(RELANCES_MAX);
    expect(verdicts.at(-1)).toBe("epuise");
  });
});
