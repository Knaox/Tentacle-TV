import { describe, expect, it, vi } from "vitest";
import { createRemoteContexts, REMOTE_CONTEXT_ORDER } from "./contexts";
import type { RemoteIntent } from "./intents";
import type { IntentEvent } from "./signals";

/**
 * La pile des contextes décide QUI prend une intention. Les comportements
 * d'essai ci-dessous ne font que dire leur nom : ce qui compte ici, c'est
 * l'ordre de consultation, le passage au suivant, et la séparation entre la
 * décision (pure, appelable d'avance) et son application (au geste).
 */

const PLAY_PAUSE: RemoteIntent = { type: "playPause" };
const BACK: RemoteIntent = { type: "retour" };
const event = (intent: RemoteIntent): IntentEvent => ({ intent, at: 7, signal: { name: "essai", phase: "up", at: 7 } });

/** Un contexte qui prend tout, sous son nom. */
const taking = (name: string) => ({ decide: () => name, apply: vi.fn() });

describe("createRemoteContexts — ordre", () => {
  it("consulte clavier > panneau > lecteur > écran, quel que soit l'ordre d'inscription", () => {
    const contexts = createRemoteContexts();
    contexts.register({ kind: "screen", name: "écran", ...taking("écran") });
    contexts.register({ kind: "panel", name: "panneau", ...taking("panneau") });
    contexts.register({ kind: "player", name: "lecteur", ...taking("lecteur") });
    expect(contexts.resolve(PLAY_PAUSE)?.name).toBe("panneau");
    contexts.register({ kind: "keyboard", name: "clavier", ...taking("clavier") });
    expect(contexts.stack().map((c) => c.kind)).toEqual([...REMOTE_CONTEXT_ORDER]);
  });

  it("à rang égal, consulte d'abord le plus récemment activé", () => {
    const contexts = createRemoteContexts();
    const first = contexts.register({ kind: "panel", name: "premier", ...taking("premier") });
    contexts.register({ kind: "panel", name: "second", ...taking("second") });
    expect(contexts.resolve(BACK)?.name).toBe("second");
    first.setActive(false);
    first.setActive(true);
    expect(contexts.resolve(BACK)?.name).toBe("premier");
  });

  it("ne change pas le rang d'un contexte dont on remplace les comportements", () => {
    const contexts = createRemoteContexts();
    const first = contexts.register({ kind: "panel", name: "premier", ...taking("premier") });
    contexts.register({ kind: "panel", name: "second", ...taking("second") });
    first.update(taking("premier, neuf"));
    expect(contexts.resolve(BACK)).toMatchObject({ name: "second", decision: "second" });
  });

  it("suit un autre ordre de rangs, et met les rangs inconnus en dernier", () => {
    const layers = createRemoteContexts(["menu", "overlay", "page", "rail"]);
    layers.register({ kind: "rail", name: "rail", ...taking("rail") });
    layers.register({ kind: "overlay", name: "surimpression", ...taking("surimpression") });
    layers.register({ kind: "inconnu" as "page", name: "inconnu", ...taking("inconnu") });
    expect(layers.stack().map((c) => c.name)).toEqual(["surimpression", "rail", "inconnu"]);
  });
});

describe("createRemoteContexts — résolution", () => {
  it("laisse passer au contexte du dessous ce qu'un contexte ne décide pas", () => {
    const contexts = createRemoteContexts();
    contexts.register({ kind: "screen", name: "écran", ...taking("écran") });
    contexts.register({
      kind: "panel", name: "feuille",
      decide: (intent) => (intent.type === "playPause" ? "demander" : null),
      apply: vi.fn(),
    });
    expect(contexts.resolve(PLAY_PAUSE)).toEqual({ name: "feuille", kind: "panel", decision: "demander" });
    expect(contexts.resolve(BACK)).toEqual({ name: "écran", kind: "screen", decision: "écran" });
  });

  it("ignore un contexte inactif — un écran d'arrière-plan", () => {
    const contexts = createRemoteContexts();
    const behind = contexts.register({ kind: "screen", name: "derrière", active: false, ...taking("derrière") });
    expect(contexts.resolve(BACK)).toBeNull();
    behind.setActive(true);
    expect(contexts.resolve(BACK)?.name).toBe("derrière");
  });

  it("ne rend rien quand personne ne décide : la plateforme garde la main", () => {
    const contexts = createRemoteContexts();
    contexts.register({ kind: "screen", name: "muet", decide: () => null, apply: vi.fn() });
    expect(contexts.resolve(BACK)).toBeNull();
    expect(contexts.dispatch(event(BACK))).toBeNull();
  });

  it("résout d'avance sans rien appliquer, applique une fois au geste", () => {
    const contexts = createRemoteContexts();
    const behavior = taking("fermer");
    contexts.register({ kind: "panel", name: "panneau", ...behavior });
    contexts.resolve(BACK);
    expect(behavior.apply).not.toHaveBeenCalled();
    const gesture = event(BACK);
    expect(contexts.dispatch(gesture)?.decision).toBe("fermer");
    expect(behavior.apply).toHaveBeenCalledTimes(1);
    expect(behavior.apply).toHaveBeenCalledWith("fermer", gesture);
  });

  it("n'applique que le contexte qui a décidé", () => {
    const contexts = createRemoteContexts();
    const below = taking("dessous");
    const above = taking("dessus");
    contexts.register({ kind: "screen", name: "dessous", ...below });
    contexts.register({ kind: "panel", name: "dessus", ...above });
    contexts.dispatch(event(PLAY_PAUSE));
    expect(above.apply).toHaveBeenCalledTimes(1);
    expect(below.apply).not.toHaveBeenCalled();
  });
});

describe("createRemoteContexts — avis", () => {
  it("prévient à chaque inscription, (dés)activation, rafraîchissement et retrait — pas pour rien", () => {
    const contexts = createRemoteContexts();
    const listener = vi.fn();
    contexts.subscribe(listener);
    const handle = contexts.register({ kind: "screen", name: "écran", ...taking("écran") });
    handle.setActive(true); // déjà actif : rien ne change
    handle.setActive(false);
    handle.refresh();
    handle.update(taking("autre")); // silencieux : `refresh` le dirait
    handle.remove();
    handle.remove();
    handle.setActive(true); // retiré : sans effet
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("cesse de prévenir après le désabonnement", () => {
    const contexts = createRemoteContexts();
    const listener = vi.fn();
    const unsubscribe = contexts.subscribe(listener);
    unsubscribe();
    contexts.register({ kind: "screen", name: "écran", ...taking("écran") });
    expect(listener).not.toHaveBeenCalled();
    expect(contexts.size()).toBe(1);
  });
});
