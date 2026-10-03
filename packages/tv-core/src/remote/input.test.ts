import { describe, expect, it, vi } from "vitest";
import { createRemoteInput } from "./input";
import { TVOS_BINDINGS } from "./bindings/tvos";
import type { RemoteSignal } from "./signals";

/**
 * L'entrée unique : un signal, une fois, dans un ordre fixe — signaux bruts,
 * puis intention vue par les observateurs, puis résolution par la pile.
 */

const signal = (name: string, phase: RemoteSignal["phase"] = "up"): RemoteSignal => ({ name, phase, at: 3 });

describe("createRemoteInput", () => {
  it("fait passer chaque signal dans l'ordre : bruts, observateurs, contextes", () => {
    const input = createRemoteInput(TVOS_BINDINGS);
    const order: string[] = [];
    input.observeSignals((s) => order.push(`signal:${s.name}`));
    input.observe((e) => order.push(`intention:${e.intent.type}`));
    input.contexts.register({
      kind: "panel", name: "feuille",
      decide: (intent) => (intent.type === "playPause" ? "demander" : null),
      apply: (decision) => order.push(`appliqué:${String(decision)}`),
    });
    input.receive(signal("playPause"));
    expect(order).toEqual(["signal:playPause", "intention:playPause", "appliqué:demander"]);
  });

  it("montre aux observateurs de signaux ce qui n'est pas une intention, et s'arrête là", () => {
    const input = createRemoteInput(TVOS_BINDINGS);
    const signals = vi.fn();
    const intents = vi.fn();
    input.observeSignals(signals);
    input.observe(intents);
    expect(input.receive(signal("focus", null))).toBeNull();
    expect(input.receive(signal("inconnu"))).toBeNull();
    expect(signals).toHaveBeenCalledTimes(2);
    expect(intents).not.toHaveBeenCalled();
  });

  it("rend l'intention reçue, datée", () => {
    const input = createRemoteInput(TVOS_BINDINGS);
    expect(input.receive(signal("select"))).toEqual({ intent: { type: "select" }, at: 3, signal: signal("select") });
  });

  it("laisse un observateur se retirer pendant la diffusion sans priver les autres", () => {
    const input = createRemoteInput(TVOS_BINDINGS);
    const late = vi.fn();
    const stop = input.observe(() => stop());
    input.observe(late);
    input.receive(signal("select"));
    input.receive(signal("select"));
    expect(late).toHaveBeenCalledTimes(2);
  });

  it("dit quand écouter le natif devient utile, puis inutile — observateurs et contextes confondus", () => {
    const input = createRemoteInput(TVOS_BINDINGS);
    const demand = vi.fn();
    input.onDemand(demand);
    expect(input.needed()).toBe(false);

    const stopObserving = input.observe(() => {});
    const context = input.contexts.register({ kind: "screen", name: "écran", decide: () => null, apply: () => {} });
    stopObserving();
    stopObserving(); // rejoué : compte une fois
    expect(input.needed()).toBe(true);
    context.remove();

    expect(demand.mock.calls).toEqual([[true], [false]]);
    expect(input.needed()).toBe(false);
  });
});
