import { describe, expect, it } from "vitest";
import { createWindowFocusBridge } from "./windowFocusBridge";

function harness(initial: boolean) {
  let push: (value: unknown) => void = () => undefined;
  const bridge = createWindowFocusBridge(initial, (onChange) => {
    push = onChange;
  });
  return { bridge, push: (value: unknown) => push(value) };
}

describe("createWindowFocusBridge", () => {
  it("rend la valeur initiale, puis celle du principal, en synchrone", () => {
    const h = harness(false);
    expect(h.bridge.isFocused()).toBe(false);
    h.push(true);
    expect(h.bridge.isFocused()).toBe(true);
  });

  it("ne rappelle qu'aux CHANGEMENTS, et plus après désabonnement", () => {
    const h = harness(true);
    const seen: boolean[] = [];
    const off = h.bridge.subscribe((focused) => seen.push(focused));
    h.push(true);
    h.push(false);
    h.push(false);
    off();
    h.push(true);
    expect(seen).toEqual([false]);
    expect(h.bridge.isFocused()).toBe(true);
  });

  it("ignore ce qui n'est pas un booléen, et un abonné qui lève ne prive pas les autres", () => {
    const h = harness(false);
    const seen: boolean[] = [];
    h.bridge.subscribe(() => {
      throw new Error("abonné fautif");
    });
    h.bridge.subscribe((focused) => seen.push(focused));
    h.push("oui");
    h.push(null);
    h.push(true);
    expect(seen).toEqual([true]);
  });

  it("un abonné qui n'est pas une fonction est refusé sans erreur", () => {
    const h = harness(false);
    const off = h.bridge.subscribe(42 as unknown as (focused: boolean) => void);
    expect(() => off()).not.toThrow();
  });
});
