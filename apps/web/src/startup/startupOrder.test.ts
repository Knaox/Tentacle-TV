import { describe, expect, it } from "vitest";
import {
  STARTUP_ORDER,
  startupHolder,
  startupWindowMayShow,
  strongestStartupState,
  type StartupStates,
  type StartupWindow,
} from "./startupOrder";

const ALL_DONE: StartupStates = {};

/**
 * Un démarrage joué de bout en bout : chaque fenêtre qui veut paraître est
 * `pending` ; à chaque pas, UNE seule doit avoir son tour — elle s'ouvre, puis
 * se referme. Rend l'ordre dans lequel elles ont paru.
 */
function playStartup(wanted: StartupWindow[], initial: StartupStates = {}): StartupWindow[] {
  const states: StartupStates = { ...initial };
  for (const target of wanted) states[target] = "pending";
  const shown: StartupWindow[] = [];
  for (let step = 0; step < wanted.length; step += 1) {
    const turns = wanted.filter((target) => states[target] === "pending" && startupWindowMayShow(target, states, true));
    expect(turns).toHaveLength(1);
    const [turn] = turns;
    states[turn] = "open";
    // Ouverte, elle est seule : aucune autre ne peut paraître par-dessus.
    for (const other of STARTUP_ORDER) if (other !== turn) expect(startupWindowMayShow(other, states, true)).toBe(false);
    states[turn] = "done";
    shown.push(turn);
  }
  return shown;
}

describe("l'ordre des fenêtres du démarrage", () => {
  it("tout le monde à la fois : profil, PIN, invitation, nouveautés, mise à jour, avatar", () => {
    expect(playStartup(["avatarInvite", "update", "whatsNew", "familyInvitation", "familyPin", "profile"])).toEqual([
      "profile",
      "familyPin",
      "familyInvitation",
      "whatsNew",
      "update",
      "avatarInvite",
    ]);
  });

  it("compte avec famille, sans PIN, nouveautés non vues, sans avatar", () => {
    expect(playStartup(["whatsNew", "avatarInvite", "familyPin"])).toEqual(["familyPin", "whatsNew", "avatarInvite"]);
  });

  it("nouveautés et mise à jour seulement : les nouveautés d'abord", () => {
    expect(playStartup(["update", "whatsNew"])).toEqual(["whatsNew", "update"]);
  });

  it("rien hors session ni sur le lecteur", () => {
    for (const target of STARTUP_ORDER) expect(startupWindowMayShow(target, ALL_DONE, false)).toBe(false);
  });

  it("tant que « Qui regarde ? » peut encore s'imposer, rien ne paraît", () => {
    const states: StartupStates = { profile: "undecided", whatsNew: "pending", familyPin: "pending" };
    expect(startupWindowMayShow("familyPin", states, true)).toBe(false);
    expect(startupWindowMayShow("whatsNew", states, true)).toBe(false);
  });

  it("le rideau du profil choisi ne se lève pas sur les nouveautés : elles attendent qu'il soit levé", () => {
    expect(startupWindowMayShow("whatsNew", { profile: "open" }, true)).toBe(false);
    expect(startupWindowMayShow("whatsNew", { profile: "done" }, true)).toBe(true);
  });

  it("une fenêtre qui n'a pas tranché retient celles qui la suivent, pas celles qui la précèdent", () => {
    const states: StartupStates = { whatsNew: "undecided", update: "pending", familyPin: "pending" };
    expect(startupWindowMayShow("update", states, true)).toBe(false);
    expect(startupWindowMayShow("avatarInvite", states, true)).toBe(false);
    expect(startupWindowMayShow("familyPin", states, true)).toBe(true);
  });

  it("une invitation reçue en direct attend la fermeture des nouveautés, jamais par-dessus", () => {
    const states: StartupStates = { whatsNew: "open", familyInvitation: "pending" };
    expect(startupWindowMayShow("familyInvitation", states, true)).toBe(false);
    states.whatsNew = "done";
    expect(startupWindowMayShow("familyInvitation", states, true)).toBe(true);
  });

  it("une mise à jour qui attend son tour ne retient pas les nouveautés ; ouverte, si", () => {
    expect(startupWindowMayShow("whatsNew", { update: "pending" }, true)).toBe(true);
    expect(startupWindowMayShow("whatsNew", { update: "open" }, true)).toBe(false);
  });

  it("une fenêtre absente (pas montée) vaut « rien à montrer »", () => {
    expect(startupWindowMayShow("avatarInvite", ALL_DONE, true)).toBe(true);
  });

  it("deux sources d'une même fenêtre : la plus contraignante", () => {
    expect(strongestStartupState([])).toBe("done");
    expect(strongestStartupState(["done", "undecided"])).toBe("undecided");
    expect(strongestStartupState(["undecided", "open", "pending"])).toBe("open");
  });

  it("dit qui tient le démarrage", () => {
    expect(startupHolder(ALL_DONE)).toBeNull();
    expect(startupHolder({ familyPin: "pending", whatsNew: "undecided" })).toBe("familyPin");
    expect(startupHolder({ familyPin: "pending", avatarInvite: "open" })).toBe("avatarInvite");
  });
});
