import { describe, expect, it } from "vitest";
import { networkResumeActions, resumeActions } from "./resumeRule";

describe("resumeActions", () => {
  it("rien hors séance", () => {
    expect(resumeActions("background", "active", false)).toEqual([]);
  });
  it("retour d'arrière-plan en séance : reconnexion, état, horloge", () => {
    expect(resumeActions("background", "active", true)).toEqual(["reconnect", "syncRequest", "clockBurst"]);
  });
  it("un passage en « inactive » seul ne relance que l'état", () => {
    expect(resumeActions("inactive", "active", true)).toEqual(["syncRequest"]);
  });
  it("rien en partant", () => {
    expect(resumeActions("active", "background", true)).toEqual([]);
  });
});

describe("networkResumeActions", () => {
  it("le réseau revient en séance", () => {
    expect(networkResumeActions(false, true, true)).toEqual(["reconnect", "syncRequest", "clockBurst"]);
    expect(networkResumeActions(true, true, true)).toEqual([]);
    expect(networkResumeActions(false, true, false)).toEqual([]);
  });
});
