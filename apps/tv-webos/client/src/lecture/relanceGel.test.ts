import { describe, expect, it } from "vitest";
import {
  observer, VEILLE_VIDE, RELEVES_AVANT_GEL, RELANCES_MAX,
  MEDIA_ERR_NETWORK, RELANCES_PAR_FENETRE, FENETRE_CUMUL_MS,
  type EchantillonLecture, type EtatVeille, type Verdict,
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

/**
 * Le cas mesuré sur la dalle : la lecture tient quarante secondes, se fige,
 * repart après rechargement, se refige. Le compteur consécutif retombant à zéro
 * à chaque reprise, la veille relançait sans fin — et le film restait
 * inregardable sans que rien ne le dise jamais.
 */
describe("gels répétés séparés par de vraies reprises", () => {
  /** Un gel complet à l'instant donné, précédé d'une reprise de lecture. */
  function gel(etat: EtatVeille, instant: number, position: number): [EtatVeille, Verdict] {
    let courant = etat;
    let dernier: Verdict = "rien";
    // La reprise : la position avance, ce qui remettait `relances` à zéro.
    [courant] = observer(courant, lecture(position, { instant }));
    [courant] = observer(courant, lecture(position + 10, { instant: instant + 2000 }));
    for (let i = 0; i <= RELEVES_AVANT_GEL; i += 1) {
      [courant, dernier] = observer(courant, lecture(position + 10, { instant: instant + 4000 + i * 2000 }));
      if (dernier !== "rien") break;
    }
    return [courant, dernier];
  }

  it("finit par abandonner quand les gels se répètent dans la fenêtre", () => {
    let etat = VEILLE_VIDE;
    const verdicts: Verdict[] = [];
    for (let n = 0; n < RELANCES_PAR_FENETRE + 1; n += 1) {
      const [suivant, verdict] = gel(etat, n * 40_000, 100 + n * 40);
      etat = suivant;
      verdicts.push(verdict);
    }
    expect(verdicts.filter((v) => v === "relancer")).toHaveLength(RELANCES_PAR_FENETRE);
    expect(verdicts.at(-1)).toBe("epuise");
  });

  it("relance encore quand les gels sont espacés au-delà de la fenêtre", () => {
    // Un incident par heure n'est pas une lecture hachée : on relance.
    let etat = VEILLE_VIDE;
    const verdicts: Verdict[] = [];
    for (let n = 0; n < RELANCES_PAR_FENETRE + 2; n += 1) {
      const [suivant, verdict] = gel(etat, n * (FENETRE_CUMUL_MS + 60_000), 100 + n * 40);
      etat = suivant;
      verdicts.push(verdict);
    }
    expect(verdicts.every((v) => v === "relancer")).toBe(true);
  });

  it("ne garde dans l'historique que les relances de la fenêtre", () => {
    let etat = VEILLE_VIDE;
    [etat] = gel(etat, 0, 100);
    [etat] = gel(etat, FENETRE_CUMUL_MS + 10_000, 200);
    expect(etat.historique).toHaveLength(1);
  });
});
