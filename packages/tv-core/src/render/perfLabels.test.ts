import { describe, expect, it } from "vitest";
import { perfLabelOf } from "./perfLabels";

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
