import { describe, expect, it } from "vitest";

import { ownPinCurrentRefused, ownPinEntered, ownPinModes, ownPinModesFor, ownPinStart } from "./ownPin";

describe("son code PIN depuis la TV", () => {
  it("offre créer sans code, changer ou retirer avec, rien à un invité", () => {
    expect(ownPinModes("owner", false)).toEqual(["create"]);
    expect(ownPinModes("member", true)).toEqual(["change", "remove"]);
    expect(ownPinModes("guest", true)).toEqual([]);
  });

  it("le compte de démonstration n'a aucun geste : ni « Créer », ni l'entrée de la section", () => {
    expect(ownPinModesFor({ kind: "owner", hasPin: false, manage: "none" })).toEqual([]);
    expect(ownPinModesFor({ kind: "member", hasPin: false, manage: "none" })).toEqual([]);
  });

  it("hors démonstration, les gestes de toujours", () => {
    expect(ownPinModesFor({ kind: "owner", hasPin: false, manage: "needsPin" })).toEqual(["create"]);
    expect(ownPinModesFor({ kind: "member", hasPin: true, manage: "manage" })).toEqual(["change", "remove"]);
    expect(ownPinModesFor({ kind: "guest", hasPin: false, manage: "none" })).toEqual([]);
    // Un code déjà là n'est jamais celui de la démonstration : on peut le changer ou le retirer.
    expect(ownPinModesFor({ kind: "member", hasPin: true, manage: "none" })).toEqual(["change", "remove"]);
  });

  it("créer : le nouveau code, sa confirmation, puis le serveur", () => {
    let step = ownPinEntered(ownPinStart("create"), "1234");
    expect(step).toMatchObject({ flow: { step: "confirm" }, submit: null });
    step = ownPinEntered(step.flow, "1234");
    expect(step.submit).toEqual({ pin: "1234" });
  });

  it("changer : l'ancien d'abord, et il part avec le nouveau", () => {
    let step = ownPinEntered(ownPinStart("change"), "1111");
    expect(step.flow.step).toBe("new");
    step = ownPinEntered(step.flow, "2222");
    step = ownPinEntered(step.flow, "2222");
    expect(step.submit).toEqual({ pin: "2222", currentPin: "1111" });
  });

  it("une confirmation différente fait recommencer le nouveau code, pas l'ancien", () => {
    let step = ownPinEntered(ownPinStart("change"), "1111");
    step = ownPinEntered(step.flow, "2222");
    step = ownPinEntered(step.flow, "2223");
    expect(step).toMatchObject({ flow: { step: "new", mismatch: true, current: "1111", fresh: null, restarts: 1 }, submit: null });
  });

  it("chaque confirmation différente compte une reprise de zéro (le focus revient au début du pavé)", () => {
    let step = ownPinEntered(ownPinStart("create"), "1234");
    expect(step.flow.restarts).toBe(0);
    step = ownPinEntered(step.flow, "4321");
    expect(step.flow.restarts).toBe(1);
    step = ownPinEntered(step.flow, "1234");
    expect(step.flow.restarts).toBe(1);
    step = ownPinEntered(step.flow, "9999");
    expect(step.flow).toMatchObject({ step: "new", mismatch: true, restarts: 2 });
  });

  it("retirer : l'ancien code suffit", () => {
    expect(ownPinEntered(ownPinStart("remove"), "1111").submit).toEqual({ pin: null, currentPin: "1111" });
  });

  it("un code actuel refusé par le serveur se redemande, rien n'est gardé", () => {
    let step = ownPinEntered(ownPinStart("change"), "9999");
    step = ownPinEntered(step.flow, "2222");
    expect(ownPinCurrentRefused(step.flow)).toMatchObject({ step: "current", current: null, fresh: null });
  });
});
