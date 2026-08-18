import { describe, expect, it } from "vitest";
import {
  observer, VEILLE_VIDE, RELEVES_AVANT_GEL, TOLERANCE_PROGRESSION_S, MEDIA_ERR_NETWORK,
  type EchantillonLecture, type EtatVeille, type Verdict,
} from "./freezeRestart";

/**
 * Ce module ne répare plus rien : il DIT. Les enjeux ont donc changé de nature,
 * mais pas d'importance — un faux positif noie le journal d'un gel imaginaire et
 * envoie l'enquête sur une piste morte ; un faux négatif laisse le seul symptôme
 * observable de la panne passer inaperçu, sur une pile média qui, elle, ne dit
 * jamais rien.
 */

const lecture = (position: number, extra: Partial<EchantillonLecture> = {}): EchantillonLecture =>
  ({ position, enPause: false, pret: 4, erreur: null, ...extra });

/** Déroule une suite de relevés et rend le verdict de chacun. */
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
  it("ne dit rien tant que la position progresse", () => {
    const { verdicts } = derouler([lecture(10), lecture(12), lecture(14), lecture(16), lecture(18)]);
    expect(verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne compte pas une pause voulue comme un gel", () => {
    const arret = Array.from({ length: 8 }, () => lecture(42, { enPause: true }));
    expect(derouler(arret).verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne confond pas un chargement avec un gel", () => {
    // Pendant un buffering la position stagne aussi, mais `readyState` retombe.
    // Sans cette garde, le journal crierait au gel au moindre ralentissement.
    const attente = Array.from({ length: 8 }, () => lecture(42, { pret: 2 }));
    expect(derouler(attente).verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne prend pas une progression minuscule pour de la lecture", () => {
    const rampe = Array.from({ length: RELEVES_AVANT_GEL + 1 },
      (_, i) => lecture(42 + i * (TOLERANCE_PROGRESSION_S / 2)));
    expect(derouler([lecture(42), ...rampe]).verdicts).toContain("fige");
  });
});

describe("lecture figée", () => {
  it("le dit une fois passé le délai de confirmation", () => {
    const fige = Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2719.5));
    const { verdicts } = derouler([lecture(2719.5), ...fige]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(1);
    expect(verdicts.at(-1)).toBe("fige");
  });

  /**
   * La régression à ne pas commettre. La veille a longtemps rechargé la source à
   * chaque relevé immobile ; le journal répétait alors le même incident toutes
   * les deux secondes et le rendait illisible. Un gel est UN événement.
   */
  it("ne répète pas le constat à chaque relevé", () => {
    const fige = Array.from({ length: RELEVES_AVANT_GEL + 6 }, () => lecture(2719.5));
    const { verdicts } = derouler([lecture(2719.5), ...fige]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(1);
  });

  it("ne conclut rien avant d'en avoir assez vu", () => {
    const court = Array.from({ length: RELEVES_AVANT_GEL - 1 }, () => lecture(2719.5));
    expect(derouler([lecture(2719.5), ...court]).verdicts).not.toContain("fige");
  });

  it("signale un gel même quand le lecteur n'a pas d'erreur à montrer", () => {
    // Le cas mesuré sur la dalle : readyState 4, du tampon d'avance, aucune
    // erreur — et plus une image. Rien d'autre que la position ne le trahit.
    const fige = Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2719.5, { pret: 4 }));
    expect(derouler([lecture(2719.5), ...fige]).verdicts).toContain("fige");
  });

  it("traite une coupure réseau comme n'importe quel gel", () => {
    // Elle n'appelait un chemin propre que pour décider s'il fallait recharger.
    // On ne recharge plus : ce n'est qu'un renseignement de plus au journal.
    const coupe = Array.from({ length: RELEVES_AVANT_GEL },
      () => lecture(2719.5, { erreur: MEDIA_ERR_NETWORK }));
    expect(derouler([lecture(2719.5), ...coupe]).verdicts.filter((v) => v === "fige")).toHaveLength(1);
  });
});

/**
 * Le fait le plus instructif du dossier, et celui qui a fait retirer le
 * rechargement : la lecture repart TOUTE SEULE, sans que rien n'ait été relancé.
 * Le journal doit pouvoir dire combien de temps ça a duré.
 */
describe("reprise spontanée", () => {
  it("signale le retour de la lecture après un gel", () => {
    const fige = Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2719.5));
    const { verdicts } = derouler([lecture(2719.5), ...fige, lecture(2721)]);
    expect(verdicts.at(-1)).toBe("reprise");
  });

  it("ne signale pas de reprise sans gel préalable", () => {
    expect(derouler([lecture(10), lecture(12), lecture(14)]).verdicts).not.toContain("reprise");
  });

  it("rearme la veille pour le gel suivant", () => {
    const fige = () => Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2719.5));
    const { verdicts } = derouler([
      lecture(2719.5), ...fige(), lecture(2721),
      ...Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2721)),
    ]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(2);
  });

  it("ne prend pas un buffering au milieu du gel pour une reprise", () => {
    // `readyState` retombe pendant un rechargement de tampon : la position n'a
    // pas bougé pour autant, et le gel n'est pas fini.
    const fige = Array.from({ length: RELEVES_AVANT_GEL }, () => lecture(2719.5));
    const { verdicts } = derouler([
      lecture(2719.5), ...fige, lecture(2719.5, { pret: 2 }), lecture(2719.5, { pret: 2 }),
    ]);
    expect(verdicts).not.toContain("reprise");
  });

  it("mémorise l'instant du gel pour qu'on puisse en mesurer la durée", () => {
    const fige = Array.from({ length: RELEVES_AVANT_GEL },
      (_, i) => lecture(2719.5, { instant: 1000 + i * 2000 }));
    const { etat } = derouler([lecture(2719.5, { instant: 0 }), ...fige]);
    expect(etat.fige).toBe(1000 + (RELEVES_AVANT_GEL - 1) * 2000);
  });
});
