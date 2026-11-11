import { beforeEach, describe, expect, it } from "vitest";
import { guardFinish, installWaapiFinishGuard, isHandedOffAnimation, resetWaapiFinishGuardForTests } from "./waapiFinishGuard";

/** Une animation de test : ses écouteurs `finish`, dans l'ordre où ils ont été posés. */
function fakeAnimation(commit: () => void = () => undefined) {
  const order: string[] = [];
  const listeners: Array<() => void> = [];
  const animation = {
    order,
    onfinish: null as (() => void) | null,
    addEventListener: (type: string, listener: () => void) => {
      if (type === "finish") listeners.push(listener);
    },
    commitStyles: () => {
      order.push("commit");
      commit();
    },
    /** Comme le navigateur : les écouteurs d'abord (posés avant), puis `onfinish` (posé après). */
    finish: () => {
      for (const listener of listeners) listener();
      animation.onfinish?.();
    },
  };
  return animation;
}

describe("la garde de fin d'animation WAAPI", () => {
  beforeEach(() => resetWaapiFinishGuardForTests());

  it("reconnaît la forme de framer-motion : une propriété en objet, fill both", () => {
    expect(isHandedOffAnimation({ opacity: [0, 1] }, { duration: 200, fill: "both" })).toBe(true);
    expect(isHandedOffAnimation({ transform: ["scale(0.97)", "scale(1)"] }, { fill: "both" })).toBe(true);
  });

  it("laisse nos animations : tableau d'images clés, ou sans fill both", () => {
    expect(isHandedOffAnimation([{ opacity: 0 }, { opacity: 1 }], { fill: "both" })).toBe(false);
    expect(isHandedOffAnimation({ opacity: [0, 1] }, { duration: 200 })).toBe(false);
    expect(isHandedOffAnimation({ opacity: [0, 1] }, 200)).toBe(false);
    expect(isHandedOffAnimation(null, { fill: "both" })).toBe(false);
  });

  it("fige le style AVANT le onfinish posé ensuite par framer-motion", () => {
    const animation = fakeAnimation();
    guardFinish(animation as unknown as Animation);
    animation.onfinish = () => animation.order.push("cancel");
    animation.finish();
    expect(animation.order).toEqual(["commit", "cancel"]);
  });

  it("ne casse rien quand la cible n'est plus rendue", () => {
    const animation = fakeAnimation(() => {
      throw new Error("InvalidStateError");
    });
    guardFinish(animation as unknown as Animation);
    expect(() => animation.finish()).not.toThrow();
  });

  it("ne garde que les animations à la forme de framer-motion, et rend l'animation d'origine", () => {
    const created: ReturnType<typeof fakeAnimation>[] = [];
    const host = {
      animate: (() => {
        const animation = fakeAnimation();
        created.push(animation);
        return animation;
      }) as unknown as Element["animate"],
    };
    installWaapiFinishGuard(host);
    const handed = host.animate.call({} as Element, { opacity: [0, 1] } as unknown as Keyframe[], { fill: "both" });
    const ours = host.animate.call({} as Element, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    expect(handed).toBe(created[0]);
    created[0].finish();
    created[1].finish();
    expect(created[0].order).toEqual(["commit"]);
    expect(created[1].order).toEqual([]);
    expect(ours).toBe(created[1]);
  });

  it("ne s'installe qu'une fois, et pas sans `animate`", () => {
    const calls: number[] = [];
    const host = { animate: (() => (calls.push(1), fakeAnimation())) as unknown as Element["animate"] };
    installWaapiFinishGuard(host);
    const once = host.animate;
    installWaapiFinishGuard(host);
    expect(host.animate).toBe(once);
    resetWaapiFinishGuardForTests();
    expect(() => installWaapiFinishGuard({})).not.toThrow();
  });
});
