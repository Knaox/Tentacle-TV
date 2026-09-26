import { describe, expect, it } from "vitest";
import { INITIAL_SLOTS, arrived, settled, veiled, want, type BackdropSlots } from "./backdropSlots";

/**
 * Ce que la machine à deux emplacements doit tenir, et qu'un rendu ne
 * montrerait pas : l'image voulue finit toujours seule à l'écran, jamais deux
 * images pleines ne restent composées l'une sur l'autre, une image arrivée en
 * retard ne s'affiche pas, et aucun emplacement n'attend un chargement qui ne
 * viendra jamais.
 */

const A = "https://serveur/Items/aaa/Images/Backdrop";
const B = "https://serveur/Items/bbb/Images/Backdrop";
const C = "https://serveur/Items/ccc/Images/Backdrop";

const phases = (state: BackdropSlots) =>
  state.slots.map((slot) => `${slot.url?.match(/Items\/(\w+)\//)?.[1] ?? "—"}:${slot.phase}`);

/** A arrivée et installée, dessus — l'état de départ de la plupart des cas. */
function withA(): BackdropSlots {
  let state = want(INITIAL_SLOTS, A);
  state = arrived(state, 1, A);
  return settled(state, 1);
}

describe("fond au focus — deux emplacements", () => {
  it("la première image entre dessus, en fondu, une fois arrivée", () => {
    const wanted = want(INITIAL_SLOTS, A);
    expect(wanted.target).toBe(1);
    expect(phases(wanted)).toEqual(["—:hidden", "aaa:hidden"]);
    const fading = arrived(wanted, 1, A);
    expect(phases(fading)).toEqual(["—:hidden", "aaa:in"]);
    expect(phases(settled(fading, 1))).toEqual(["—:hidden", "aaa:shown"]);
  });

  it("le voile se pose dès qu'une image est voulue, avant son arrivée", () => {
    expect(veiled(INITIAL_SLOTS)).toBe(false);
    expect(veiled(want(INITIAL_SLOTS, A))).toBe(true);
  });

  it("la même image redemandée ne change rien — même référence", () => {
    const state = withA();
    expect(want(state, A)).toBe(state);
  });

  it("l'entrante posée DESSOUS : la sortante s'efface par-dessus, puis se cache", () => {
    let state = want(withA(), B);
    expect(state.target).toBe(0);
    state = arrived(state, 0, B);
    expect(phases(state)).toEqual(["bbb:shown", "aaa:handoff"]);
    state = settled(state, 1);
    expect(phases(state)).toEqual(["bbb:shown", "aaa:hidden"]);
  });

  it("l'entrante posée DESSUS : elle monte en fondu, et l'image couverte se cache", () => {
    let state = want(withA(), B);
    state = settled(arrived(state, 0, B), 1);
    state = want(state, C);
    expect(state.target).toBe(1);
    state = arrived(state, 1, C);
    expect(phases(state)).toEqual(["bbb:shown", "ccc:in"]);
    state = settled(state, 1);
    expect(phases(state)).toEqual(["bbb:hidden", "ccc:shown"]);
  });

  it("une image arrivée après qu'on en a voulu une autre ne s'affiche pas", () => {
    let state = want(withA(), B);
    state = want(state, C);
    expect(arrived(state, 0, B)).toBe(state);
    state = arrived(state, 0, C);
    expect(phases(state)).toEqual(["ccc:shown", "aaa:handoff"]);
  });

  it("une image neuve en plein fondu achève le fondu d'un coup", () => {
    let state = want(withA(), B);
    state = arrived(state, 0, B);
    state = want(state, C);
    expect(phases(state)).toEqual(["bbb:shown", "ccc:hidden"]);
    state = arrived(state, 1, C);
    expect(phases(state)).toEqual(["bbb:shown", "ccc:in"]);
  });

  it("revenir à l'image précédente la réutilise, sans rien recharger", () => {
    let state = want(withA(), B);
    state = settled(arrived(state, 0, B), 1);
    state = want(state, A);
    // A est restée décodée dans son emplacement : le fondu part tout de suite.
    expect(phases(state)).toEqual(["bbb:shown", "aaa:in"]);
    expect(state.target).toBe(1);
  });

  it("plus rien à montrer : l'image s'efface, puis le voile part avec elle", () => {
    let state = want(withA(), null);
    expect(phases(state)).toEqual(["—:hidden", "aaa:out"]);
    expect(veiled(state)).toBe(true);
    state = settled(state, 1);
    expect(veiled(state)).toBe(false);
  });

  it("l'image qui s'effaçait revient en fondu si on la redemande", () => {
    let state = want(withA(), null);
    state = want(state, A);
    expect(phases(state)).toEqual(["—:hidden", "aaa:in"]);
    expect(state.target).toBe(1);
  });

  it("une image voulue puis abandonnée avant son arrivée ne laisse rien derrière elle", () => {
    let state = want(INITIAL_SLOTS, A);
    state = want(state, null);
    expect(veiled(state)).toBe(false);
    expect(arrived(state, 1, A).slots[1].phase).toBe("hidden");
  });

  it("ne rien vouloir quand rien n'est montré rend la même référence", () => {
    expect(want(INITIAL_SLOTS, null)).toBe(INITIAL_SLOTS);
  });
});
