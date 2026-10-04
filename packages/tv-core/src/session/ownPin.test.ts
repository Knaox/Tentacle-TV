import { describe, expect, it } from "vitest";

import { ownPinCurrentRefused, ownPinEntered, ownPinModes, ownPinStart } from "./ownPin";

describe("son code PIN depuis la TV", () => {
  it("offre créer sans code, changer ou retirer avec, rien à un invité", () => {
    expect(ownPinModes("owner", false)).toEqual(["create"]);
    expect(ownPinModes("member", true)).toEqual(["change", "remove"]);
    expect(ownPinModes("guest", true)).toEqual([]);
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
    expect(step).toMatchObject({ flow: { step: "new", mismatch: true, current: "1111", fresh: null }, submit: null });
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
