import { describe, expect, it } from "vitest";
import {
  observer, EMPTY_WATCH, SAMPLES_BEFORE_FREEZE, TOLERANCE_PROGRESSION_S, MEDIA_ERR_NETWORK,
  type PlaybackSample, type WatchState, type Verdict,
} from "./freezeRestart";

/**
 * Ce module ne répare plus rien : il DIT. Les enjeux ont donc changé de nature,
 * mais pas d'importance — un faux positif noie le journal d'un gel imaginaire et
 * envoie l'enquête sur une piste morte ; un faux négatif laisse le seul symptôme
 * observable de la panne passer inaperçu, sur une pile média qui, elle, ne dit
 * jamais rien.
 */

const lecture = (position: number, extra: Partial<PlaybackSample> = {}): PlaybackSample =>
  ({ position, enPause: false, pret: 4, error: null, ...extra });

/** Déroule une suite de relevés et rend le verdict de chacun. */
function unroll(samples: PlaybackSample[]): { verdicts: Verdict[]; state: WatchState } {
  let state = EMPTY_WATCH;
  const verdicts: Verdict[] = [];
  for (const e of samples) {
    const [next, verdict] = observer(state, e);
    state = next;
    verdicts.push(verdict);
  }
  return { verdicts, state };
}

describe("lecture qui avance", () => {
  it("ne dit rien tant que la position progresse", () => {
    const { verdicts } = unroll([lecture(10), lecture(12), lecture(14), lecture(16), lecture(18)]);
    expect(verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne compte pas une pause voulue comme un gel", () => {
    const stop = Array.from({ length: 8 }, () => lecture(42, { enPause: true }));
    expect(unroll(stop).verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne confond pas un chargement avec un gel", () => {
    // Pendant un buffering la position stagne aussi, mais `readyState` retombe.
    // Sans cette garde, le journal crierait au gel au moindre ralentissement.
    const wait = Array.from({ length: 8 }, () => lecture(42, { pret: 2 }));
    expect(unroll(wait).verdicts.every((v) => v === "rien")).toBe(true);
  });

  it("ne prend pas une progression minuscule pour de la lecture", () => {
    const ramp = Array.from({ length: SAMPLES_BEFORE_FREEZE + 1 },
      (_, i) => lecture(42 + i * (TOLERANCE_PROGRESSION_S / 2)));
    expect(unroll([lecture(42), ...ramp]).verdicts).toContain("fige");
  });
});

describe("lecture figée", () => {
  it("le dit une fois passé le délai de confirmation", () => {
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2719.5));
    const { verdicts } = unroll([lecture(2719.5), ...frozen]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(1);
    expect(verdicts.at(-1)).toBe("fige");
  });

  /**
   * La régression à ne pas commettre. La veille a longtemps rechargé la source à
   * chaque relevé immobile ; le journal répétait alors le même incident toutes
   * les deux secondes et le rendait illisible. Un gel est UN événement.
   */
  it("ne répète pas le constat à chaque relevé", () => {
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE + 6 }, () => lecture(2719.5));
    const { verdicts } = unroll([lecture(2719.5), ...frozen]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(1);
  });

  it("ne conclut rien avant d'en avoir assez vu", () => {
    const court = Array.from({ length: SAMPLES_BEFORE_FREEZE - 1 }, () => lecture(2719.5));
    expect(unroll([lecture(2719.5), ...court]).verdicts).not.toContain("fige");
  });

  it("signale un gel même quand le lecteur n'a pas d'erreur à montrer", () => {
    // Le cas mesuré sur la dalle : readyState 4, du tampon d'avance, aucune
    // erreur — et plus une image. Rien d'autre que la position ne le trahit.
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2719.5, { pret: 4 }));
    expect(unroll([lecture(2719.5), ...frozen]).verdicts).toContain("fige");
  });

  it("traite une coupure réseau comme n'importe quel gel", () => {
    // Elle n'appelait un chemin propre que pour décider s'il fallait recharger.
    // On ne recharge plus : ce n'est qu'un renseignement de plus au journal.
    const coupe = Array.from({ length: SAMPLES_BEFORE_FREEZE },
      () => lecture(2719.5, { error: MEDIA_ERR_NETWORK }));
    expect(unroll([lecture(2719.5), ...coupe]).verdicts.filter((v) => v === "fige")).toHaveLength(1);
  });
});

/**
 * Le fait le plus instructif du dossier, et celui qui a fait retirer le
 * rechargement : la lecture repart TOUTE SEULE, sans que rien n'ait été relancé.
 * Le journal doit pouvoir dire combien de temps ça a duré.
 */
describe("reprise spontanée", () => {
  it("signale le retour de la lecture après un gel", () => {
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2719.5));
    const { verdicts } = unroll([lecture(2719.5), ...frozen, lecture(2721)]);
    expect(verdicts.at(-1)).toBe("reprise");
  });

  it("ne signale pas de reprise sans gel préalable", () => {
    expect(unroll([lecture(10), lecture(12), lecture(14)]).verdicts).not.toContain("reprise");
  });

  it("rearme la veille pour le gel suivant", () => {
    const frozen = () => Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2719.5));
    const { verdicts } = unroll([
      lecture(2719.5), ...frozen(), lecture(2721),
      ...Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2721)),
    ]);
    expect(verdicts.filter((v) => v === "fige")).toHaveLength(2);
  });

  it("ne prend pas un buffering au milieu du gel pour une reprise", () => {
    // `readyState` retombe pendant un rechargement de tampon : la position n'a
    // pas bougé pour autant, et le gel n'est pas fini.
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE }, () => lecture(2719.5));
    const { verdicts } = unroll([
      lecture(2719.5), ...frozen, lecture(2719.5, { pret: 2 }), lecture(2719.5, { pret: 2 }),
    ]);
    expect(verdicts).not.toContain("reprise");
  });

  it("mémorise l'instant du gel pour qu'on puisse en mesurer la durée", () => {
    const frozen = Array.from({ length: SAMPLES_BEFORE_FREEZE },
      (_, i) => lecture(2719.5, { instant: 1000 + i * 2000 }));
    const { state } = unroll([lecture(2719.5, { instant: 0 }), ...frozen]);
    expect(state.frozen).toBe(1000 + (SAMPLES_BEFORE_FREEZE - 1) * 2000);
  });
});
