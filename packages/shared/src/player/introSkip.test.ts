import { describe, expect, it } from "vitest";
import {
  INTRO_SKIP_START_SECONDS,
  SKIP_GUARD_MS,
  INTRO_SKIP_IDLE,
  displayedCountdown,
  decideIntroSkip,
  showSkipPill,
  type IntroSkipAction,
  type IntroSkipInput,
  type IntroSkipState,
} from "./introSkip";

/** Déroule une suite d'entrées en tenant le front de `visible` comme le hook. */
function run(inputs: IntroSkipInput[], initial: IntroSkipState = INTRO_SKIP_IDLE) {
  let state = initial;
  let previousVisible = false;
  const skips: number[] = [];
  inputs.forEach((input, i) => {
    let action: IntroSkipAction;
    [state, action] = decideIntroSkip(state, input, previousVisible);
    if (action === "skip") skips.push(i);
    if (input.type === "frame") previousVisible = input.visible;
  });
  return { state, skips };
}

const tick = (visible: boolean, active = true): IntroSkipInput =>
  ({ type: "frame", visible, active, elapsedMs: 1000 });

describe("decideIntroSkip", () => {
  it("compte trois secondes puis saute", () => {
    const { state, skips } = run([tick(true), tick(true), tick(true), tick(true)]);
    expect(skips).toEqual([3]);
    expect(state.name).toBe("skipped");
  });

  it("ne compte pas quand la préférence est éteinte", () => {
    const { state, skips } = run([tick(true, false), tick(true, false), tick(true, false)]);
    expect(skips).toEqual([]);
    expect(displayedCountdown(state)).toBeNull();
    expect(showSkipPill(state, true)).toBe(true); // le bouton manuel reste
  });

  it("la croix arrête le décompte sans masquer la pilule", () => {
    const { state, skips } = run([tick(true), { type: "dismiss" }, tick(true), tick(true), tick(true)]);
    expect(skips).toEqual([]);
    expect(state.name).toBe("dismissed");
    expect(displayedCountdown(state)).toBeNull();
    expect(showSkipPill(state, true)).toBe(true);
  });

  // Le premier défaut signalé : annuler, laisser l'intro filer, revenir dessus.
  it("réarme quand on revient dans l'intro après avoir annulé", () => {
    const { state, skips } = run([
      tick(true), { type: "dismiss" }, tick(true), // refusé, on reste dans l'intro
      tick(false),                              // l'intro est passée
      tick(true),                               // retour en arrière : ça réarme
    ]);
    expect(skips).toEqual([]);
    expect(displayedCountdown(state)).toBe(INTRO_SKIP_START_SECONDS);
  });

  // Le second : la pilule ne doit pas réapparaître pendant que la position
  // rattrape — elle est échantillonnée à 1 Hz et un saut HLS prend des secondes.
  it("masque la pilule tant que la lecture n'a pas rejoint la cible", () => {
    const { state } = run([tick(true), tick(true), tick(true), tick(true), tick(true), tick(true)]);
    expect(state.name).toBe("skipped");
    expect(showSkipPill(state, true)).toBe(false);
  });

  it("rend le bouton manuel si le saut n'aboutit jamais", () => {
    const after = Array.from({ length: SKIP_GUARD_MS / 1000 + 4 }, () => tick(true));
    const { state } = run(after);
    expect(state.name).toBe("idle");
    expect(showSkipPill(state, true)).toBe(true);
  });

  it("une réévaluation sans temps écoulé ne consomme pas de seconde", () => {
    const reevaluate: IntroSkipInput = { type: "frame", visible: true, active: true, elapsedMs: 0 };
    const { state } = run([tick(true), reevaluate, reevaluate, reevaluate]);
    expect(displayedCountdown(state)).toBe(INTRO_SKIP_START_SECONDS);
  });

  it("un saut manuel masque la pilule comme un saut automatique", () => {
    const { state, skips } = run([tick(true), { type: "skipNow" }]);
    expect(skips).toEqual([1]);
    expect(showSkipPill(state, true)).toBe(false);
  });

  it("quitter l'intro remet tout à zéro", () => {
    const { state } = run([tick(true), { type: "dismiss" }, tick(false)]);
    expect(state).toEqual(INTRO_SKIP_IDLE);
    expect(showSkipPill(state, false)).toBe(false);
  });

  // Le délai vient désormais du réglage utilisateur, en millisecondes.
  it("respecte un délai personnalisé", () => {
    const long = (): IntroSkipInput =>
      ({ type: "frame", visible: true, active: true, elapsedMs: 1000, delayMs: 5000 });
    const { state, skips } = run([long(), long(), long(), long()]);
    expect(skips).toEqual([]);
    expect(displayedCountdown(state)).toBe(2);
    const full = run(Array.from({ length: 6 }, long));
    expect(full.skips).toEqual([5]);
  });

  // La cadence mobile est de 250 ms : le décompte en ms l'absorbe sans biais.
  it("tient la cadence 4 Hz du mobile", () => {
    const quarter = (): IntroSkipInput =>
      ({ type: "frame", visible: true, active: true, elapsedMs: 250 });
    // Le premier cadre ARME sans décrémenter : 3000 ms = 1 + 12 cadres.
    const { state, skips } = run(Array.from({ length: 13 }, quarter));
    expect(skips).toEqual([12]);
    expect(state.name).toBe("skipped");
    const partial = run(Array.from({ length: 5 }, quarter));
    expect(displayedCountdown(partial.state)).toBe(2); // 2000 ms restants → « 2 »
  });
});

describe("sauter puis revenir dans le passage", () => {
  it("le bouton se réaffiche dès que la fenêtre est ré-entrée", () => {
    // On saute : l'état masque la pilule le temps que la position rattrape.
    const [apresSaut, action] = decideIntroSkip(INTRO_SKIP_IDLE, { type: "skipNow" }, true);
    expect(action).toBe("skip");
    expect(showSkipPill(apresSaut, true)).toBe(false);

    // La position sort de l'intro : tout retombe.
    const [dehors] = decideIntroSkip(
      apresSaut,
      { type: "frame", visible: false, active: false, elapsedMs: 1_000 },
      true,
    );
    expect(dehors).toEqual(INTRO_SKIP_IDLE);

    // Retour en arrière DANS l'intro : front montant, la pilule revient.
    const [dedans] = decideIntroSkip(
      dehors,
      { type: "frame", visible: true, active: false, elapsedMs: 1_000 },
      false,
    );
    expect(showSkipPill(dedans, true)).toBe(true);
  });

  it("un REFUS, lui, ne se défait pas par une simple ré-entrée du passage", () => {
    // (la sourdine posée par la croix vit dans la coquille — voir skipMuting.ts)
    const [refuse] = decideIntroSkip(INTRO_SKIP_IDLE, { type: "dismiss" }, true);
    const [encore] = decideIntroSkip(
      refuse,
      { type: "frame", visible: true, active: true, elapsedMs: 1_000 },
      true,
    );
    expect(encore.name).toBe("dismissed");
  });
});
