import { describe, expect, it } from "vitest";
import {
  observeSeek, EMPTY_SEEK, SEEK_STALL_MS, LOADING_MS, SEEK_WATCH_PERIOD_MS,
  MIN_PROGRESS_S, LANDING_TOLERANCE_S,
  type SeekSample, type SeekVerdict,
} from "./seekLanding";

/**
 * Ce que ces cas protègent ne se voit qu'à l'usage : un faux « abouti » laisse le
 * film figé pour de bon, puisque plus personne ne viendra redemander une session
 * au serveur. Un faux « renégocier » coupe une lecture qui allait bien et fait
 * repartir un transcodage de trois à cinq secondes. Les deux erreurs sont chères,
 * dans des sens opposés.
 */

const TARGET = 2700;

const sample = (elapsed: number, extra: Partial<SeekSample> = {}): SeekSample =>
  ({ target: TARGET, position: TARGET, bufferEnd: null, paused: false, ready: 4, elapsed, ...extra });

/** Déroule une suite de relevés et rend le verdict de chacun. */
function unroll(echantillons: SeekSample[]): SeekVerdict[] {
  let state = EMPTY_SEEK;
  const verdicts: SeekVerdict[] = [];
  for (const e of echantillons) {
    const [next, verdict] = observeSeek(state, e);
    state = next;
    verdicts.push(verdict);
  }
  return verdicts;
}

describe("saut qui aboutit", () => {
  it("conclut dès que la vidéo avance au voisinage de la cible", () => {
    const verdicts = unroll([sample(0), sample(SEEK_WATCH_PERIOD_MS, { position: TARGET + 1 })]);
    expect(verdicts).toEqual(["wait", "landed"]);
  });

  it("conclut sur un saut fait à l'arrêt quand le serveur a servi au-delà", () => {
    // À l'arrêt rien n'avancera jamais : sans cette règle, une pause sur une
    // cible parfaitement chargée attendrait indéfiniment.
    const stopped = { paused: true, bufferEnd: TARGET + 30 };
    expect(unroll([sample(0, stopped), sample(1000, stopped)])).toContain("landed");
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
    expect(unroll([sample(0), sample(SEEK_STALL_MS)])).toEqual(["wait", "renegotiate"]);
  });

  /**
   * L'autre régression, propre au téléviseur : `buffered` y rend TOUJOURS une
   * plage unique partant de zéro. Juger sur « la cible est dans le tampon »
   * rendrait « abouti » d'office à tout saut en arrière — le cas le plus
   * fréquent — et le filet ne servirait à rien.
   */
  it("ne se fie pas à un tampon qui part de zéro", () => {
    const backwards = { target: 600, position: 600, bufferEnd: 3000 };
    expect(unroll([sample(0, backwards), sample(SEEK_STALL_MS, backwards)]))
      .toEqual(["wait", "renegotiate"]);
  });

  it("ne prend pas une reprise LOIN de la cible pour un atterrissage", () => {
    // Mesuré : la pile rejoue une seconde d'une position ancienne avant de se
    // figer. Ça avance, mais pas là où on l'avait envoyée.
    const ailleurs = TARGET - LANDING_TOLERANCE_S - 100;
    const verdicts = unroll([
      sample(0, { position: ailleurs }),
      sample(SEEK_STALL_MS, { position: ailleurs + 1 }),
    ]);
    expect(verdicts).not.toContain("landed");
  });

  it("laisse au serveur le temps d'écrire avant de tout redemander", () => {
    // Un saut qui ABOUTIT a été mesuré à 4,5 s : l'échéance ne doit pas bouger.
    const wait = unroll([0, 1000, 4500, SEEK_STALL_MS - 1].map((ms) => sample(ms)));
    expect(wait).not.toContain("renegotiate");
  });
});

/**
 * Dire que ça charge, sans le crier pour rien. L'ancien indicateur avait été
 * retiré parce qu'il se montrait à CHAQUE saut, y compris ceux qui
 * aboutissaient dans l'instant — un témoin qui clignote n'apprend rien et fatigue.
 * Ce qui suit borne les deux erreurs.
 */
describe("témoin de chargement", () => {
  it("se tait tant que le saut peut encore aboutir tout seul", () => {
    expect(unroll([sample(0), sample(LOADING_MS - 1)])).not.toContain("loading");
  });

  it("le dit une fois le seuil franchi", () => {
    expect(unroll([sample(0), sample(LOADING_MS)]).at(-1)).toBe("loading");
  });

  it("ne se montre jamais sur un saut qui aboutit dans l'instant", () => {
    // Le cas de tous les sauts de ±30 s : la réserve fait quarante secondes.
    const verdicts = unroll([
      sample(0), sample(LOADING_MS, { position: TARGET + 1 }),
    ]);
    expect(verdicts).not.toContain("loading");
    expect(verdicts.at(-1)).toBe("landed");
  });

  /**
   * La régression à ne pas commettre. En pause, la veille attend indéfiniment
   * — elle ne doit pas renégocier sous les doigts de l'utilisateur. Si elle
   * disait « ça charge » dans le même souffle, le témoin resterait allumé
   * jusqu'à ce qu'il reprenne, par-dessus une image parfaitement figée.
   */
  it("ne s'allume pas sur une pause", () => {
    const verdicts = unroll([
      sample(0), sample(LOADING_MS * 4, { paused: true }),
    ]);
    expect(verdicts).not.toContain("loading");
  });

  it("laisse la place à la renégociation une fois le vrai délai atteint", () => {
    expect(unroll([sample(0), sample(SEEK_STALL_MS)]).at(-1)).toBe("renegotiate");
  });
});

describe("pause pendant le déplacement", () => {
  it("n'escalade pas sous les doigts de l'utilisateur", () => {
    const verdicts = unroll([sample(0), sample(SEEK_STALL_MS * 2, { paused: true })]);
    expect(verdicts).not.toContain("renegotiate");
  });

  it("ne confond pas une progression minuscule avec une reprise", () => {
    const verdicts = unroll([
      sample(0),
      sample(SEEK_STALL_MS, { position: TARGET + MIN_PROGRESS_S / 2 }),
    ]);
    expect(verdicts.at(-1)).toBe("renegotiate");
  });
});
