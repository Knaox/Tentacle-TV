import { describe, expect, it } from "vitest";
import { createTranslator } from "../translate";
import { ANDROIDTV_BACK_SIGNAL, ANDROIDTV_BINDINGS, createAndroidTvReader, readAndroidTvEvent, type AndroidTvNativeEvent } from "./androidtv";
import { boundSignals } from "./types";

/**
 * La table d'Android TV doit couvrir TOUT ce que react-native-tvos 0.80 peut
 * livrer à `TVEventHandler` sur Android — relevé dans
 * `ReactAndroid/.../modules/core/ReactAndroidHWInputDeviceHelper.java`
 * (`KEY_EVENTS_ACTIONS`, `KEY_EVENTS_LONG_PRESS_ACTIONS`, `focus`, `blur`) —,
 * plus Retour, que l'adaptateur lit dans `BackHandler`. Un signal oublié
 * serait une touche muette pour tous les comportements.
 */
const NATIVE_EVENT_TYPES = [
  "select", "playPause", "play", "pause", "next", "previous", "rewind", "fastForward", "record", "stop",
  "up", "right", "down", "left",
  "info", "captions", "menu",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "channelDown", "channelUp", "bookmark", "avrInput", "avrPower", "dvr", "guide",
  "red", "green", "blue", "yellow", "stbInput", "stbPower", "tv", "tvInput", "window", "teletext",
  "longSelect", "longUp", "longRight", "longDown", "longLeft",
  "longPlayPause", "longRewind", "longFastForward", "longChannelDown", "longChannelUp",
  "focus", "blur",
] as const;

const translator = createTranslator(ANDROIDTV_BINDINGS);
const AT = 2_000;
const translate = (event: AndroidTvNativeEvent) => translator.translate(readAndroidTvEvent(event, AT));
const intentOf = (event: AndroidTvNativeEvent) => translate(event)?.intent ?? null;
const UP = 1;
const DOWN = 0;

describe("ANDROIDTV_BINDINGS — couverture", () => {
  it("connaît chaque signal que react-native-tvos peut émettre, et Retour", () => {
    for (const type of [...NATIVE_EVENT_TYPES, ANDROIDTV_BACK_SIGNAL]) expect(translator.knows(type), type).toBe(true);
  });

  it("n'invente aucun signal", () => {
    expect(new Set(boundSignals(ANDROIDTV_BINDINGS))).toEqual(new Set([...NATIVE_EVENT_TYPES, ANDROIDTV_BACK_SIGNAL]));
  });

  it("dit honnêtement ce qui diffère de tvOS : pas de surface tactile, Retour décidé au geste", () => {
    expect(ANDROIDTV_BINDINGS.swipes).toEqual([]);
    expect(ANDROIDTV_BINDINGS.drags).toEqual([]);
    expect(ANDROIDTV_BINDINGS.traits).toEqual({
      focusMovesBeforeIntent: true,
      pressOnRelease: true,
      announcedHolds: true,
      holdThresholdMs: 500,
      backDecidedAhead: false,
      touchSurface: false,
      dragOnDemand: false,
      dragUnit: null,
      playPauseKey: "sometimes",
    });
    expect(ANDROIDTV_BINDINGS.system.length).toBeGreaterThan(0);
  });
});

describe("ANDROIDTV_BINDINGS — appuis", () => {
  it("traduit la croix en pas, au relâchement", () => {
    expect(intentOf({ eventType: "up", eventKeyAction: UP })).toEqual({ type: "move", direction: "haut" });
    expect(intentOf({ eventType: "down", eventKeyAction: UP })).toEqual({ type: "move", direction: "bas" });
    expect(intentOf({ eventType: "left", eventKeyAction: UP })).toEqual({ type: "move", direction: "gauche" });
    expect(intentOf({ eventType: "right", eventKeyAction: UP })).toEqual({ type: "move", direction: "droite" });
  });

  it("ne compte pas l'enfoncement : un appui ne vaut qu'une fois (l'app livre les deux phases)", () => {
    expect(intentOf({ eventType: "select", eventKeyAction: DOWN })).toBeNull();
    expect(intentOf({ eventType: "up", eventKeyAction: DOWN })).toBeNull();
    expect(intentOf({ eventType: "select", eventKeyAction: -1 })).toBeNull();
  });

  it("traduit OK, Lecture/Pause, Retour et les chaînes", () => {
    expect(intentOf({ eventType: "select", eventKeyAction: UP })).toEqual({ type: "select" });
    expect(intentOf({ eventType: "playPause", eventKeyAction: UP })).toEqual({ type: "playPause" });
    expect(intentOf({ eventType: ANDROIDTV_BACK_SIGNAL, eventKeyAction: UP })).toEqual({ type: "retour" });
    expect(intentOf({ eventType: "channelUp", eventKeyAction: UP })).toEqual({ type: "page", direction: "haut" });
    expect(intentOf({ eventType: "channelDown", eventKeyAction: UP })).toEqual({ type: "page", direction: "bas" });
  });

  it("traduit les touches de transport dédiées dans le vocabulaire d'origine", () => {
    const commands = ["play", "pause", "stop"].map((eventType) => {
      const intent = intentOf({ eventType, eventKeyAction: UP });
      return intent?.type === "transport" ? intent.command : null;
    });
    expect(commands).toEqual(["lecture", "pause", "arret"]);
  });

  it("avance et recul rapides comptent à l'enfoncement, répétitions comprises — jamais au relâchement", () => {
    expect(intentOf({ eventType: "fastForward", eventKeyAction: DOWN })).toEqual({ type: "transport", command: "avance" });
    expect(intentOf({ eventType: "rewind", eventKeyAction: DOWN })).toEqual({ type: "transport", command: "retour" });
    expect(intentOf({ eventType: "fastForward", eventKeyAction: UP })).toBeNull();
    expect(intentOf({ eventType: "rewind", eventKeyAction: UP })).toBeNull();
  });

  it("garde la date d'arrivée et le signal d'origine", () => {
    const event = translate({ eventType: "right", eventKeyAction: UP });
    expect(event?.at).toBe(AT);
    expect(event?.signal).toEqual({ name: "right", phase: "up", at: AT });
  });
});

describe("ANDROIDTV_BINDINGS — maintiens", () => {
  it("lit le cycle annoncé : long… à 0 au seuil, long… à 1 au relâchement", () => {
    expect(intentOf({ eventType: "longSelect", eventKeyAction: DOWN })).toEqual({ type: "hold", key: "select", phase: "start" });
    expect(intentOf({ eventType: "longSelect", eventKeyAction: UP })).toEqual({ type: "hold", key: "select", phase: "end" });
  });

  it("la croix maintenue : la direction tenue (le défilement rapide)", () => {
    const keys = ["longUp", "longDown", "longLeft", "longRight"].map((eventType) => {
      const intent = intentOf({ eventType, eventKeyAction: DOWN });
      return intent?.type === "hold" ? intent.key : null;
    });
    expect(keys).toEqual(["haut", "bas", "gauche", "droite"]);
  });

  it("ne fait rien des maintiens que react-native-tvos n'émet jamais", () => {
    for (const eventType of ["longPlayPause", "longRewind", "longFastForward", "longChannelUp", "longChannelDown"]) {
      expect(intentOf({ eventType, eventKeyAction: DOWN }), eventType).toBeNull();
    }
  });
});

describe("ANDROIDTV_BINDINGS — bruit et inconnus", () => {
  it("ne fait pas une intention du focus, de Menu, des chiffres ni des couleurs", () => {
    for (const eventType of ["focus", "blur", "menu", "info", "5", "red", "next"]) {
      expect(intentOf({ eventType, eventKeyAction: UP }), eventType).toBeNull();
    }
  });

  it("ne rend rien d'un signal inconnu, ni des gestes du pavé d'Apple TV", () => {
    for (const eventType of ["swipeUp", "pan", "pageUp"]) {
      expect(intentOf({ eventType, eventKeyAction: UP }), eventType).toBeNull();
      expect(translator.knows(eventType)).toBe(false);
    }
  });
});

describe("readAndroidTvEvent", () => {
  it("lit la phase dans eventKeyAction ; −1 (focus, blur) : aucune", () => {
    expect(readAndroidTvEvent({ eventType: "select", eventKeyAction: 0 }, 5).phase).toBe("down");
    expect(readAndroidTvEvent({ eventType: "select", eventKeyAction: 1 }, 5).phase).toBe("up");
    expect(readAndroidTvEvent({ eventType: "focus", eventKeyAction: -1 }, 5).phase).toBeNull();
    expect(readAndroidTvEvent({ eventType: "back" }, 5)).toEqual({ name: "back", phase: null, at: 5 });
  });
});

describe("createAndroidTvReader — les répétitions d'une touche tenue", () => {
  it("marque repeat un enfoncement redit sans relâchement, et repart à zéro après", () => {
    const read = createAndroidTvReader();
    expect(read({ eventType: "fastForward", eventKeyAction: 0 }, 1).repeat).toBeUndefined();
    expect(read({ eventType: "fastForward", eventKeyAction: 0 }, 2)).toEqual({ name: "fastForward", phase: "down", repeat: true, at: 2 });
    expect(read({ eventType: "fastForward", eventKeyAction: 1 }, 3).repeat).toBeUndefined();
    expect(read({ eventType: "fastForward", eventKeyAction: 0 }, 4).repeat).toBeUndefined();
  });

  it("ne fait qu'une intention d'une touche de transport tenue : au relâchement", () => {
    const read = createAndroidTvReader();
    const intents = [0, 0, 0, 1].map((action, at) => translator.translate(read({ eventType: "rewind", eventKeyAction: action }, at))?.intent ?? null);
    expect(intents).toEqual([null, null, null, { type: "transport", command: "retour" }]);
  });

  it("suit chaque touche à part : le maintien de OK ne marque pas la croix", () => {
    const read = createAndroidTvReader();
    read({ eventType: "select", eventKeyAction: 0 }, 1);
    expect(read({ eventType: "longSelect", eventKeyAction: 0 }, 2).repeat).toBeUndefined();
    expect(read({ eventType: "down", eventKeyAction: 0 }, 3).repeat).toBeUndefined();
  });
});
