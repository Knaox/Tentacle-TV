import { describe, expect, it } from "vitest";
import {
  arm, decideFlash, initialFlashState, EXPIRY_MS, type FlashState,
} from "./playbackFlashState";

/**
 * Décision du badge central « pause / lecture ».
 *
 * Chaque cas ci-dessous correspond à un badge qui s'est réellement affiché là où
 * il n'avait rien à faire. Le badge se déduit de l'état `paused`, et le lecteur
 * met lui-même en pause pour des raisons qui ne sont pas des intentions.
 */

const T0 = 1_000_000;

/** Rejoue une suite d'états et rend les badges annoncés. */
function replay(
  states: { paused: boolean; muted?: boolean; inert?: boolean; t?: number; arm?: boolean }[],
  start: FlashState = initialFlashState,
) {
  let state = start;
  const badges: (string | null)[] = [];
  for (const e of states) {
    if (e.arm) state = arm(state, e.t ?? T0);
    const r = decideFlash(state, {
      paused: e.paused,
      muted: e.muted ?? false,
      inert: e.inert ?? false,
      now: e.t ?? T0,
    });
    state = r.state;
    badges.push(r.kind);
  }
  return { badges: badges.filter((b): b is string => b !== null), state };
}

describe("démarrage", () => {
  it("n'annonce rien à l'ouverture d'un film", () => {
    // Un lecteur qui monte passe par la pause, puis par la lecture. Personne n'a
    // rien demandé : la seconde étape n'est pas une bascule, c'est le départ.
    const { badges } = replay([{ paused: true }, { paused: false }]);
    expect(badges).toEqual([]);
  });

  it("annonce ce qui vient APRÈS le départ", () => {
    const { badges } = replay([
      { paused: true }, { paused: false },
      { paused: true }, { paused: false },
    ]);
    expect(badges).toEqual(["pause", "play"]);
  });
});

describe("glissement de la barre de progression", () => {
  const started = replay([{ paused: true }, { paused: false }]).state;

  it("n'annonce NI la pause du glissement NI la reprise", () => {
    // C'est le défaut signalé : chercher un passage affichait « pause » puis
    // « lecture » en pleine image.
    const { badges } = replay(
      [
        { paused: true, arm: true }, // mousedown → le lecteur met en pause
        { paused: false, arm: true }, // mouseup → il reprend
      ],
      started,
    );
    expect(badges).toEqual([]);
  });

  it("laisse passer la pause que l'utilisateur demande juste après", () => {
    const { badges } = replay(
      [
        { paused: true, arm: true },
        { paused: false, arm: true },
        { paused: true }, // barre d'espace
      ],
      started,
    );
    expect(badges).toEqual(["pause"]);
  });

  it("ne consomme qu'UNE bascule par armement", () => {
    const { badges } = replay(
      [{ paused: true, arm: true }, { paused: false }],
      started,
    );
    expect(badges).toEqual(["play"]);
  });

  it("oublie un armement que rien n'est venu consommer", () => {
    // Sans péremption, une pause qui n'arrive jamais ferait taire la SUIVANTE —
    // celle de l'utilisateur. On arme, aucune bascule ne suit, puis l'utilisateur
    // met en pause bien plus tard : son geste doit s'annoncer.
    const { badges } = replay(
      [
        { paused: false, arm: true, t: T0 }, // armé, mais `paused` ne bouge pas
        { paused: true, t: T0 + EXPIRY_MS + 1 }, // barre d'espace, longtemps après
      ],
      started,
    );
    expect(badges).toEqual(["pause"]);
  });

  it("garde un armement encore frais", () => {
    // Le pendant du cas ci-dessus : dans la fenêtre de validité, la bascule est
    // bien celle du lecteur, et elle reste muette.
    const { badges } = replay(
      [
        { paused: false, arm: true, t: T0 },
        { paused: true, t: T0 + EXPIRY_MS - 1 },
      ],
      started,
    );
    expect(badges).toEqual([]);
  });
});

describe("rechargement de source", () => {
  const started = replay([{ paused: true }, { paused: false }]).state;

  it("n'annonce rien pendant le rechargement, ni à sa sortie", () => {
    // Un saut lointain bascule en transcodage : mpv recharge, donc il repasse
    // par la pause. Deux badges pour un simple saut.
    const { badges } = replay(
      [
        { paused: true, inert: true },
        { paused: false, inert: true },
        { paused: false, inert: false }, // retour au calme
      ],
      started,
    );
    expect(badges).toEqual([]);
  });

  it("reprend son travail après le rechargement", () => {
    const { badges } = replay(
      [
        { paused: true, inert: true },
        { paused: false, inert: true },
        { paused: false, inert: false },
        { paused: true, inert: false },
      ],
      started,
    );
    expect(badges).toEqual(["pause"]);
  });
});

describe("son", () => {
  const started = replay([{ paused: true }, { paused: false }]).state;

  it("annonce la coupure et le retour du son", () => {
    const { badges } = replay(
      [{ paused: false, muted: true }, { paused: false, muted: false }],
      started,
    );
    expect(badges).toEqual(["mute", "unmute"]);
  });

  it("laisse la pause primer quand les deux changent d'un coup", () => {
    // Un seul badge à la fois : deux icônes au même endroit ne se lisent pas.
    const { badges } = replay([{ paused: true, muted: true }], started);
    expect(badges).toEqual(["pause"]);
  });
});
