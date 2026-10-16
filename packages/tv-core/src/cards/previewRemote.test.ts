import { describe, expect, it } from "vitest";
import { createTranslator } from "../remote/translate";
import { ANDROIDTV_BINDINGS, createAndroidTvReader } from "../remote/bindings/androidtv";
import { TVOS_BINDINGS, readTvosEvent } from "../remote/bindings/tvos";
import { previewPausedAfter, previewRemoteAction, previewRemoteHintIds } from "./previewRemote";

describe("la télécommande pendant un aperçu", () => {
  it("Lecture/Pause met en pause et reprend ; Lecture et Pause font ce qu'elles disent", () => {
    expect(previewRemoteAction({ type: "playPause" })).toBe("togglePause");
    expect(previewRemoteAction({ type: "transport", command: "lecture" })).toBe("play");
    expect(previewRemoteAction({ type: "transport", command: "pause" })).toBe("pause");
    expect(previewPausedAfter(false, "togglePause")).toBe(true);
    expect(previewPausedAfter(true, "togglePause")).toBe(false);
    expect(previewPausedAfter(true, "play")).toBe(false);
    expect(previewPausedAfter(false, "pause")).toBe(true);
    expect(previewPausedAfter(true, "toggleMute")).toBe(true);
  });

  it("Lecture/Pause maintenue coupe ou remet le son, une fois par maintien", () => {
    expect(previewRemoteAction({ type: "hold", key: "playPause", phase: "start" })).toBe("toggleMute");
    expect(previewRemoteAction({ type: "hold", key: "playPause", phase: "update" })).toBe("holding");
    expect(previewRemoteAction({ type: "hold", key: "playPause", phase: "end" })).toBe("holding");
  });

  it("ne prend rien d'autre : OK, OK maintenu, la croix, Retour, l'avance rapide", () => {
    for (const intent of [
      { type: "select" }, { type: "hold", key: "select", phase: "start" }, { type: "move", direction: "droite" },
      { type: "retour" }, { type: "transport", command: "avance" }, { type: "transport", command: "arret" },
    ] as const) {
      expect(previewRemoteAction(intent), JSON.stringify(intent)).toBeNull();
    }
  });

  it("les deux télécommandes y arrivent par les mêmes intentions (Siri Remote, Shield)", () => {
    const tvos = createTranslator(TVOS_BINDINGS);
    const hold = tvos.translate(readTvosEvent({ eventType: "longPlayPause", eventKeyAction: 0 }, 1));
    expect(previewRemoteAction(hold!.intent)).toBe("toggleMute");
    const android = createTranslator(ANDROIDTV_BINDINGS);
    const read = createAndroidTvReader();
    const actions = [0, 0, 1].map((action, at) => android.translate(read({ eventType: "playPause", eventKeyAction: action }, at)))
      .map((event) => (event ? previewRemoteAction(event.intent) : null));
    expect(actions).toEqual([null, "toggleMute", "holding"]);
  });

  it("l'indice dit ce que fera la touche, selon l'état", () => {
    expect(previewRemoteHintIds({ paused: false, muted: false })).toEqual(["previewPause", "previewMute"]);
    expect(previewRemoteHintIds({ paused: true, muted: true })).toEqual(["previewResume", "previewUnmute"]);
  });
});
