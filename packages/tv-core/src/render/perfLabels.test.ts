import { describe, expect, it } from "vitest";
import { jsStallLabel, perfLabelOf } from "./perfLabels";

describe("le nom d'un geste dans le journal du mode de mesure", () => {
  it("distingue l'appui d'une flèche de sa répétition tenue", () => {
    expect(perfLabelOf({ type: "move", direction: "bas" })).toBe("flèche:bas");
    expect(perfLabelOf({ type: "move", direction: "droite", repeat: true })).toBe("tenu:droite");
  });

  it("ne note un maintien qu'à son départ, et OK une fois", () => {
    expect(perfLabelOf({ type: "hold", key: "select", phase: "start" })).toBe("maintien:select");
    expect(perfLabelOf({ type: "hold", key: "select", phase: "end" })).toBeNull();
    expect(perfLabelOf({ type: "select" })).toBe("ok");
    expect(perfLabelOf({ type: "select", repeat: true })).toBeNull();
  });

  it("nomme Retour, le transport et Lecture/Pause", () => {
    expect(perfLabelOf({ type: "retour" })).toBe("retour");
    expect(perfLabelOf({ type: "transport", command: "avance" })).toBe("transport:avance");
    expect(perfLabelOf({ type: "playPause" })).toBe("lecture/pause");
  });
});

describe("le nom d'un blocage du fil JS", () => {
  it("ne note rien sous 50 ms de retard", () => {
    expect(jsStallLabel(0)).toBeNull();
    expect(jsStallLabel(49.9)).toBeNull();
  });

  it("range un retard dans son palier", () => {
    expect(jsStallLabel(50)).toBe("js≥50");
    expect(jsStallLabel(99)).toBe("js≥50");
    expect(jsStallLabel(150)).toBe("js≥100");
    expect(jsStallLabel(250)).toBe("js≥200");
    expect(jsStallLabel(1200)).toBe("js≥400");
  });
});
