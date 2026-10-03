import { describe, expect, it } from "vitest";
import { createTranslator } from "../translate";
import { readTvosEvent, TVOS_BINDINGS, type TvosNativeEvent } from "./tvos";
import { boundSignals } from "./types";

/**
 * La table de la Siri Remote doit couvrir TOUT ce que react-native-tvos 0.80
 * peut livrer à `TVEventHandler` — relevé dans
 * `React/Base/RCTTVRemoteHandlerConstants.mm` (les gestes) et
 * `React/Views/RCTTVView.m` (`select`, `longSelect`, `focus`, `blur`). Un
 * signal oublié serait une touche muette pour tous les comportements, sans
 * que rien ne le signale.
 */
const NATIVE_EVENT_TYPES = [
  "menu", "playPause", "select",
  "longPlayPause", "longSelect", "longUp", "longDown", "longLeft", "longRight",
  "left", "right", "up", "down",
  "pageUp", "pageDown",
  "swipeLeft", "swipeRight", "swipeUp", "swipeDown",
  "pan",
  "focus", "blur",
] as const;

const translator = createTranslator(TVOS_BINDINGS);
const AT = 1_000;
const translate = (event: TvosNativeEvent) => translator.translate(readTvosEvent(event, AT));
const intentOf = (event: TvosNativeEvent) => translate(event)?.intent ?? null;

describe("TVOS_BINDINGS — couverture", () => {
  it("connaît chaque signal que la Siri Remote peut émettre", () => {
    for (const type of NATIVE_EVENT_TYPES) expect(translator.knows(type), type).toBe(true);
  });

  it("n'invente aucun signal", () => {
    expect(new Set(boundSignals(TVOS_BINDINGS))).toEqual(new Set(NATIVE_EVENT_TYPES));
  });

  it("dit ce que le système garde pour lui, et ce que la plateforme impose", () => {
    expect(TVOS_BINDINGS.system.length).toBeGreaterThan(0);
    expect(TVOS_BINDINGS.traits).toMatchObject({ focusMovesBeforeIntent: true, announcedHolds: true, backDecidedAhead: true });
  });
});

describe("TVOS_BINDINGS — appuis", () => {
  it("traduit les bords du pavé en pas, dans le vocabulaire d'origine", () => {
    expect(intentOf({ eventType: "up", eventKeyAction: 1 })).toEqual({ type: "move", direction: "haut" });
    expect(intentOf({ eventType: "down", eventKeyAction: 1 })).toEqual({ type: "move", direction: "bas" });
    expect(intentOf({ eventType: "left", eventKeyAction: 1 })).toEqual({ type: "move", direction: "gauche" });
    expect(intentOf({ eventType: "right", eventKeyAction: 1 })).toEqual({ type: "move", direction: "droite" });
  });

  it("traduit OK, Lecture/Pause, Menu et les pages", () => {
    expect(intentOf({ eventType: "select", eventKeyAction: 1 })).toEqual({ type: "select" });
    expect(intentOf({ eventType: "playPause", eventKeyAction: 1 })).toEqual({ type: "playPause" });
    expect(intentOf({ eventType: "menu", eventKeyAction: 1 })).toEqual({ type: "retour" });
    expect(intentOf({ eventType: "pageUp", eventKeyAction: 1 })).toEqual({ type: "page", direction: "haut" });
    expect(intentOf({ eventType: "pageDown", eventKeyAction: 1 })).toEqual({ type: "page", direction: "bas" });
  });

  it("garde un appui quelle que soit la phase dite — tvOS n'en dit qu'une", () => {
    expect(intentOf({ eventType: "select" })).toEqual({ type: "select" });
    expect(intentOf({ eventType: "up", eventKeyAction: 0 })).toEqual({ type: "move", direction: "haut" });
  });

  it("garde la date d'arrivée et le signal d'origine", () => {
    const event = translate({ eventType: "right", eventKeyAction: 1 });
    expect(event?.at).toBe(AT);
    expect(event?.signal).toEqual({ name: "right", phase: "up", at: AT });
  });
});

describe("TVOS_BINDINGS — maintiens", () => {
  it("lit le cycle d'un maintien dans eventKeyAction : 0 début, 1 fin, rien : il dure", () => {
    expect(intentOf({ eventType: "longSelect", eventKeyAction: 0 })).toEqual({ type: "hold", key: "select", phase: "start" });
    expect(intentOf({ eventType: "longSelect", eventKeyAction: 1 })).toEqual({ type: "hold", key: "select", phase: "end" });
    expect(intentOf({ eventType: "longSelect" })).toEqual({ type: "hold", key: "select", phase: "update" });
  });

  it("nomme la touche maintenue, flèches et Lecture/Pause comprises", () => {
    const keys = ["longUp", "longDown", "longLeft", "longRight", "longPlayPause"].map((eventType) => {
      const intent = intentOf({ eventType, eventKeyAction: 0 });
      return intent?.type === "hold" ? intent.key : null;
    });
    expect(keys).toEqual(["haut", "bas", "gauche", "droite", "playPause"]);
  });
});

describe("TVOS_BINDINGS — pavé tactile", () => {
  it("traduit un glisser rapide, avec ou sans corps", () => {
    expect(intentOf({ eventType: "swipeLeft", body: { state: "Ended" } })).toEqual({ type: "swipe", direction: "gauche" });
    expect(intentOf({ eventType: "swipeRight" })).toEqual({ type: "swipe", direction: "droite" });
    expect(intentOf({ eventType: "swipeUp", body: { state: "Ended" } })).toEqual({ type: "swipe", direction: "haut" });
    expect(intentOf({ eventType: "swipeDown", body: { state: "Ended" } })).toEqual({ type: "swipe", direction: "bas" });
  });

  it("suit le doigt : posé, déplacé, levé — avec translation et vitesse", () => {
    const body = { x: 12, y: -3, velocityX: 140.5, velocityY: -8 };
    expect(intentOf({ eventType: "pan", body: { state: "Began", ...body } })).toEqual({ type: "drag", phase: "start", x: 12, y: -3, vx: 140.5, vy: -8 });
    expect(intentOf({ eventType: "pan", body: { state: "Changed", ...body } })).toMatchObject({ type: "drag", phase: "move" });
    expect(intentOf({ eventType: "pan", body: { state: "Ended", ...body } })).toMatchObject({ type: "drag", phase: "end" });
  });

  it("ignore un pan sans corps, ou dans un état que tvOS ne nomme pas", () => {
    // Comme l'écouteur d'avant (`toRemoteEvent`) : pas de geste lisible, rien.
    expect(intentOf({ eventType: "pan" })).toBeNull();
    expect(intentOf({ eventType: "pan", body: { state: "Cancelled", x: 0, y: 0, velocityX: 0, velocityY: 0 } })).toBeNull();
  });
});

describe("TVOS_BINDINGS — bruit et inconnus", () => {
  it("ne fait pas une intention du focus qui bouge", () => {
    expect(intentOf({ eventType: "focus" })).toBeNull();
    expect(intentOf({ eventType: "blur" })).toBeNull();
  });

  it("ne rend rien d'un signal inconnu, sans erreur", () => {
    expect(intentOf({ eventType: "rewind", eventKeyAction: 1 })).toBeNull();
    expect(translator.knows("rewind")).toBe(false);
  });
});

describe("readTvosEvent", () => {
  it("lit la phase d'un appui dans eventKeyAction", () => {
    expect(readTvosEvent({ eventType: "select", eventKeyAction: 0 }, 5).phase).toBe("down");
    expect(readTvosEvent({ eventType: "select", eventKeyAction: 1 }, 5).phase).toBe("up");
    expect(readTvosEvent({ eventType: "select", eventKeyAction: -1 }, 5).phase).toBeNull();
    expect(readTvosEvent({ eventType: "select" }, 5).phase).toBeNull();
  });

  it("lit la phase d'un geste du pavé dans son état, et ses mesures seulement si elles y sont", () => {
    expect(readTvosEvent({ eventType: "pan", body: { state: "Changed", x: 1, y: 2, velocityX: 3, velocityY: 4 } }, 9)).toEqual({
      name: "pan", phase: "change", motion: { x: 1, y: 2, vx: 3, vy: 4 }, at: 9,
    });
    expect(readTvosEvent({ eventType: "swipeUp", body: { state: "Ended" } }, 9)).toEqual({ name: "swipeUp", phase: "up", at: 9 });
  });
});
