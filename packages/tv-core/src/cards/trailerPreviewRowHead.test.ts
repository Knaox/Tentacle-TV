import { describe, expect, it } from "vitest";
import {
  INITIAL_ROW_HEAD,
  ROW_HEAD_LEAVE_GRACE_MS,
  ROW_HEAD_RELEASE_MS,
  nextRowHeadDeadline,
  reduceRowHead,
  rowHeadTarget,
  type RowHeadContext,
  type RowHeadEvent,
  type RowHeadOptions,
  type RowHeadState,
} from "./trailerPreviewRowHead";

// La scène de l'accueil : vignettes 380 (pas de 416), retrait 176, marge 96, grande carte 806.
const SCENE = { cardWidth: 380, gap: 36, inset: 176, viewportWidth: 1920, rightMargin: 96 };
const TILE = 806;
const STOP: RowHeadOptions = { end: "stop", release: "stay" };
const OVER: RowHeadOptions = { end: "overscroll", release: "stay" };

/** Une rangée simulée : chaque défilement demandé est aussitôt atteint. */
function row(cardCount: number, options: RowHeadOptions, geometry: Partial<typeof SCENE> = {}) {
  let state: RowHeadState = INITIAL_ROW_HEAD;
  let scrollX = 0;
  const moves: number[] = [];
  const send = (event: RowHeadEvent) => {
    const context: RowHeadContext = { ...SCENE, ...geometry, cardCount, ...options, scrollX };
    const step = reduceRowHead(state, event, context);
    state = step.state;
    if (step.scrollTo !== null) {
      moves.push(step.scrollTo);
      scrollX = step.scrollTo;
    }
    return step.scrollTo;
  };
  return {
    send,
    get state() { return state; },
    get scrollX() { return scrollX; },
    set scrollX(x: number) { scrollX = x; },
    moves,
    /** Le focus sur la carte, puis son aperçu qui démarre. */
    preview(index: number, at = 0, tileWidth = TILE) {
      send({ type: "focus", index, at });
      return send({ type: "expand", index, tileWidth, at: at + 900 });
    },
    /** Où la carte se trouve à l'écran (son bord gauche). */
    screenLeft(index: number) {
      return (geometry.inset ?? SCENE.inset) + index * ((geometry.cardWidth ?? SCENE.cardWidth) + SCENE.gap) - scrollX;
    },
  };
}

describe("la carte en aperçu passe en tête de sa rangée", () => {
  it("dès que l'aperçu démarre, la rangée défile pour que la carte prenne la place de la première", () => {
    const r = row(12, STOP);
    expect(r.preview(2)).toBe(832);
    expect(r.screenLeft(2)).toBe(176);
  });

  it("la suivante passe en tête à son tour : la 2e devient la 1re, puis la 3e…", () => {
    const r = row(12, STOP);
    for (const index of [1, 2, 3, 4]) {
      r.preview(index, index * 2000);
      expect(r.screenLeft(index)).toBe(176);
    }
    expect(r.moves).toEqual([416, 832, 1248, 1664]);
  });

  it("rien ne bouge tant que l'aperçu n'a pas démarré : un parcours de carte en carte ne fait pas sauter la rangée", () => {
    const r = row(12, STOP);
    for (let index = 0; index < 12; index += 1) {
      expect(r.send({ type: "focus", index, at: index * 400 })).toBeNull();
      expect(r.send({ type: "blur", index, at: index * 400 + 1 })).toBeNull();
    }
    expect(r.moves).toEqual([]);
  });

  it("la première carte, déjà en tête, ne fait rien bouger", () => {
    expect(row(12, STOP).preview(0)).toBeNull();
  });

  it("une carte déjà en tête (on revient sur elle) ne fait rien bouger", () => {
    const r = row(12, STOP);
    r.preview(3);
    r.send({ type: "blur", index: 3, at: 1000 });
    expect(r.preview(3, 1010)).toBeNull();
  });
});

describe("en bout de rangée — la butée (`stop`)", () => {
  // 12 cartes : le bout du contenu, la carte grandie, est à 3 734.
  it("la carte qui ne peut plus passer en tête s'arrête au bout : la grande carte finit à la marge de droite", () => {
    const r = row(12, STOP);
    expect(r.preview(11)).toBe(3734);
    expect(r.screenLeft(11) + TILE).toBe(1920 - 96);
  });

  it("la place posée au bout permet d'atteindre la butée AVANT que la carte grandisse", () => {
    const r = row(12, STOP);
    r.preview(11);
    expect(r.state.trailing).toBe(426);
  });

  it("l'antépénultième s'arrête à dix points de la tête : la butée, pas un dépassement", () => {
    const r = row(12, STOP);
    r.preview(9);
    expect(r.screenLeft(9)).toBe(186);
  });

  it("une rangée qui tient dans l'écran ne bouge que si la grande carte n'y tient pas", () => {
    const short = row(2, STOP);
    expect(short.preview(1)).toBeNull();
    const four = row(4, STOP);
    expect(four.preview(3)).toBe(406);
    expect(four.screenLeft(3) + TILE).toBe(1920 - 96);
  });
});

describe("en bout de rangée — le dépassement (`overscroll`)", () => {
  it("la rangée défile au-delà de son bout : la dernière carte passe en tête, du vide à sa droite", () => {
    const r = row(12, OVER);
    expect(r.preview(11)).toBe(4576);
    expect(r.screenLeft(11)).toBe(176);
    expect(r.state.trailing).toBe(1268);
  });

  it("une rangée qui tient entière dans l'écran ne dépasse jamais", () => {
    expect(row(2, OVER).preview(1)).toBeNull();
    expect(row(4, OVER).preview(3)).toBe(406);
  });

  it("la place posée ne raccourcit pas tant que le focus reste dans la rangée", () => {
    const r = row(12, OVER);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 1000 });
    r.preview(8, 1010);
    expect(r.state.trailing).toBe(1268);
    expect(r.screenLeft(8)).toBe(176);
  });
});

describe("le focus quitte la rangée", () => {
  it("`stay` : la rangée reste où l'aperçu l'a laissée", () => {
    const r = row(12, STOP);
    r.preview(4);
    r.send({ type: "blur", index: 4, at: 2000 });
    expect(r.send({ type: "tick", at: 2000 + ROW_HEAD_LEAVE_GRACE_MS })).toBeNull();
    expect(r.screenLeft(4)).toBe(176);
    expect(nextRowHeadDeadline(r.state)).toBeNull();
  });

  it("`stay` : un vide au-delà du bout se referme, puis la place posée s'en va", () => {
    const r = row(12, OVER);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 2000 });
    const leaveAt = 2000 + ROW_HEAD_LEAVE_GRACE_MS;
    expect(nextRowHeadDeadline(r.state)).toBe(leaveAt);
    expect(r.send({ type: "tick", at: leaveAt })).toBe(3308);
    expect(r.state.trailing).toBe(1268);
    expect(nextRowHeadDeadline(r.state)).toBe(leaveAt + ROW_HEAD_RELEASE_MS);
    r.send({ type: "tick", at: leaveAt + ROW_HEAD_RELEASE_MS });
    expect(r.state.trailing).toBe(0);
  });

  it("`stay`, butée : le vide laissé par le repli de la dernière carte se referme", () => {
    const r = row(12, STOP);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 2000 });
    expect(r.send({ type: "tick", at: 2000 + ROW_HEAD_LEAVE_GRACE_MS })).toBe(3308);
  });

  it("`return` : la rangée revient où elle était avant le premier passage en tête", () => {
    const r = row(12, { end: "stop", release: "return" });
    r.preview(2);
    r.send({ type: "blur", index: 2, at: 1000 });
    r.preview(3, 1010);
    r.send({ type: "blur", index: 3, at: 3000 });
    expect(r.send({ type: "tick", at: 3000 + ROW_HEAD_LEAVE_GRACE_MS })).toBe(0);
  });

  it("`return` : la dernière carte focalisée reste entière à l'écran", () => {
    const r = row(12, { end: "stop", release: "return" });
    // tvOS a fait défiler la rangée en suivant le focus jusqu'à la 7e carte.
    r.scrollX = 1000;
    r.preview(6);
    r.send({ type: "blur", index: 6, at: 2000 });
    const back = r.send({ type: "tick", at: 2000 + ROW_HEAD_LEAVE_GRACE_MS });
    expect(back).toBe(1228);
    expect(r.screenLeft(6) + 380).toBe(1920 - 96);
  });

  it("un pas d'une carte à sa voisine n'est pas un départ : la grâce l'attend", () => {
    const r = row(12, OVER);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 2000 });
    r.send({ type: "focus", index: 10, at: 2016 });
    expect(nextRowHeadDeadline(r.state)).toBeNull();
    expect(r.send({ type: "tick", at: 2000 + ROW_HEAD_LEAVE_GRACE_MS })).toBeNull();
    expect(r.state.trailing).toBe(1268);
  });

  it("le focus d'une voisine arrivé AVANT la perte de l'ancienne ne compte pas pour un départ", () => {
    const r = row(12, STOP);
    r.preview(3);
    r.send({ type: "focus", index: 4, at: 2000 });
    r.send({ type: "blur", index: 3, at: 2001 });
    expect(r.state.focused).toBe(4);
    expect(nextRowHeadDeadline(r.state)).toBeNull();
  });

  it("revenu pendant le retour, la place posée reste", () => {
    const r = row(12, OVER);
    r.preview(11);
    r.send({ type: "blur", index: 11, at: 2000 });
    r.send({ type: "tick", at: 2000 + ROW_HEAD_LEAVE_GRACE_MS });
    r.send({ type: "focus", index: 11, at: 2300 });
    expect(nextRowHeadDeadline(r.state)).toBeNull();
    expect(r.state.trailing).toBe(1268);
  });

  it("remise au début (`rowRewind`) : tout s'oublie", () => {
    const r = row(12, OVER);
    r.preview(11);
    r.send({ type: "reset" });
    expect(r.state.trailing).toBe(0);
    expect(r.state.restX).toBeNull();
  });
});

describe("le mouvement et la place posée d'avance", () => {
  it("le passage en tête se joue avec la grande carte ; le retour est un défilement ordinaire", () => {
    const state = reduceRowHead(INITIAL_ROW_HEAD, { type: "expand", index: 11, tileWidth: TILE, at: 0 }, { ...SCENE, cardCount: 12, ...OVER, scrollX: 0 });
    expect(state.motion).toBe("withPreview");
    const left = reduceRowHead(state.state, { type: "blur", index: 11, at: 10 }, { ...SCENE, cardCount: 12, ...OVER, scrollX: 4576 });
    const back = reduceRowHead(left.state, { type: "tick", at: 10 + ROW_HEAD_LEAVE_GRACE_MS }, { ...SCENE, cardCount: 12, ...OVER, scrollX: 4576 });
    expect(back).toMatchObject({ scrollTo: 3308, motion: "plain" });
  });

  it("au focus d'une carte de bout de rangée, la place se pose d'avance si la rangée connaît sa grande carte", () => {
    const r = row(12, STOP);
    r.send({ type: "focus", index: 11, at: 0, tileWidth: TILE });
    expect(r.state.trailing).toBe(426);
    expect(r.moves).toEqual([]);
    // L'aperçu venu, la place est déjà là : le défilement part avec la carte.
    const before = r.state.trailing;
    r.send({ type: "expand", index: 11, tileWidth: TILE, at: 900 });
    expect(r.state.trailing).toBe(before);
  });

  it("au milieu de la rangée, le focus ne pose rien (rien à redessiner pendant un parcours)", () => {
    const r = row(12, OVER);
    for (let index = 0; index < 8; index += 1) r.send({ type: "focus", index, at: index * 100, tileWidth: TILE });
    expect(r.state.trailing).toBe(0);
  });
});

describe("les autres gabarits", () => {
  it("des affiches (240, pas de 276) passent en tête de même", () => {
    const r = row(20, STOP, { cardWidth: 240 });
    expect(r.preview(5)).toBe(1380);
    expect(r.screenLeft(5)).toBe(176);
  });

  it("des cartes réglées grandes (vignette 494, grande carte 1 048) ont leur butée", () => {
    const geometry = { cardWidth: 494 };
    const end = rowHeadTarget({ ...SCENE, ...geometry, cardCount: 10, index: 9, tileWidth: 1048, end: "stop" });
    const r = row(10, STOP, geometry);
    expect(r.preview(9, 0, 1048)).toBe(end);
    expect(r.screenLeft(9) + 1048).toBe(1920 - 96);
  });
});
