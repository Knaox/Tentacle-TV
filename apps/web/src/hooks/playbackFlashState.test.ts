import { describe, expect, it } from "vitest";
import {
  armer, deciderFlash, etatFlashInitial, PEREMPTION_MS, type EtatFlash,
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
function rejouer(
  etats: { paused: boolean; muted?: boolean; inerte?: boolean; t?: number; armer?: boolean }[],
  depart: EtatFlash = etatFlashInitial,
) {
  let etat = depart;
  const badges: (string | null)[] = [];
  for (const e of etats) {
    if (e.armer) etat = armer(etat, e.t ?? T0);
    const r = deciderFlash(etat, {
      paused: e.paused,
      muted: e.muted ?? false,
      inerte: e.inerte ?? false,
      maintenant: e.t ?? T0,
    });
    etat = r.etat;
    badges.push(r.kind);
  }
  return { badges: badges.filter((b): b is string => b !== null), etat };
}

describe("démarrage", () => {
  it("n'annonce rien à l'ouverture d'un film", () => {
    // Un lecteur qui monte passe par la pause, puis par la lecture. Personne n'a
    // rien demandé : la seconde étape n'est pas une bascule, c'est le départ.
    const { badges } = rejouer([{ paused: true }, { paused: false }]);
    expect(badges).toEqual([]);
  });

  it("annonce ce qui vient APRÈS le départ", () => {
    const { badges } = rejouer([
      { paused: true }, { paused: false },
      { paused: true }, { paused: false },
    ]);
    expect(badges).toEqual(["pause", "play"]);
  });
});

describe("glissement de la barre de progression", () => {
  const demarre = rejouer([{ paused: true }, { paused: false }]).etat;

  it("n'annonce NI la pause du glissement NI la reprise", () => {
    // C'est le défaut signalé : chercher un passage affichait « pause » puis
    // « lecture » en pleine image.
    const { badges } = rejouer(
      [
        { paused: true, armer: true }, // mousedown → le lecteur met en pause
        { paused: false, armer: true }, // mouseup → il reprend
      ],
      demarre,
    );
    expect(badges).toEqual([]);
  });

  it("laisse passer la pause que l'utilisateur demande juste après", () => {
    const { badges } = rejouer(
      [
        { paused: true, armer: true },
        { paused: false, armer: true },
        { paused: true }, // barre d'espace
      ],
      demarre,
    );
    expect(badges).toEqual(["pause"]);
  });

  it("ne consomme qu'UNE bascule par armement", () => {
    const { badges } = rejouer(
      [{ paused: true, armer: true }, { paused: false }],
      demarre,
    );
    expect(badges).toEqual(["play"]);
  });

  it("oublie un armement que rien n'est venu consommer", () => {
    // Sans péremption, une pause qui n'arrive jamais ferait taire la SUIVANTE —
    // celle de l'utilisateur. On arme, aucune bascule ne suit, puis l'utilisateur
    // met en pause bien plus tard : son geste doit s'annoncer.
    const { badges } = rejouer(
      [
        { paused: false, armer: true, t: T0 }, // armé, mais `paused` ne bouge pas
        { paused: true, t: T0 + PEREMPTION_MS + 1 }, // barre d'espace, longtemps après
      ],
      demarre,
    );
    expect(badges).toEqual(["pause"]);
  });

  it("garde un armement encore frais", () => {
    // Le pendant du cas ci-dessus : dans la fenêtre de validité, la bascule est
    // bien celle du lecteur, et elle reste muette.
    const { badges } = rejouer(
      [
        { paused: false, armer: true, t: T0 },
        { paused: true, t: T0 + PEREMPTION_MS - 1 },
      ],
      demarre,
    );
    expect(badges).toEqual([]);
  });
});

describe("rechargement de source", () => {
  const demarre = rejouer([{ paused: true }, { paused: false }]).etat;

  it("n'annonce rien pendant le rechargement, ni à sa sortie", () => {
    // Un saut lointain bascule en transcodage : mpv recharge, donc il repasse
    // par la pause. Deux badges pour un simple saut.
    const { badges } = rejouer(
      [
        { paused: true, inerte: true },
        { paused: false, inerte: true },
        { paused: false, inerte: false }, // retour au calme
      ],
      demarre,
    );
    expect(badges).toEqual([]);
  });

  it("reprend son travail après le rechargement", () => {
    const { badges } = rejouer(
      [
        { paused: true, inerte: true },
        { paused: false, inerte: true },
        { paused: false, inerte: false },
        { paused: true, inerte: false },
      ],
      demarre,
    );
    expect(badges).toEqual(["pause"]);
  });
});

describe("son", () => {
  const demarre = rejouer([{ paused: true }, { paused: false }]).etat;

  it("annonce la coupure et le retour du son", () => {
    const { badges } = rejouer(
      [{ paused: false, muted: true }, { paused: false, muted: false }],
      demarre,
    );
    expect(badges).toEqual(["mute", "unmute"]);
  });

  it("laisse la pause primer quand les deux changent d'un coup", () => {
    // Un seul badge à la fois : deux icônes au même endroit ne se lisent pas.
    const { badges } = rejouer([{ paused: true, muted: true }], demarre);
    expect(badges).toEqual(["pause"]);
  });
});
