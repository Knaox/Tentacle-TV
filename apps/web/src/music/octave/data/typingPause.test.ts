import { describe, expect, it } from "vitest";
import { createTypingPause, TYPING_PAUSE_MS, typingPauseRoute } from "./typingPause";

/** La recherche préparée, côté barre : une annonce par pause, jamais pendant la frappe, jamais deux fois. */

function fakeTimers() {
  const pending = new Map<number, { fn: () => void; at: number }>();
  let now = 0;
  let next = 1;
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        pending.set(next, { fn, at: now + ms });
        return next++;
      },
      clear: (h: unknown) => void pending.delete(h as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at > now) continue;
        pending.delete(id);
        t.fn();
      }
    },
  };
}

describe("pause de frappe", () => {
  it("annonce le texte une fois la barre tue, pas pendant la frappe", () => {
    const sent: string[] = [];
    const clock = fakeTimers();
    const pause = createTypingPause((q) => sent.push(q), clock.timers);
    for (const q of ["th", "thu", "thun", "thund", "thunder "]) {
      pause.note(q);
      clock.advance(150);
    }
    expect(sent).toEqual([]);
    clock.advance(TYPING_PAUSE_MS);
    expect(sent).toEqual(["thunder"]);
  });

  it("jamais trop court, jamais deux fois le même texte de suite, annulée à Entrée", () => {
    const sent: string[] = [];
    const clock = fakeTimers();
    const pause = createTypingPause((q) => sent.push(q), clock.timers);
    pause.note("ab");
    clock.advance(TYPING_PAUSE_MS);
    pause.note("Thunder");
    clock.advance(TYPING_PAUSE_MS);
    pause.note(" thunder ");
    clock.advance(TYPING_PAUSE_MS);
    pause.note("thunder imagine");
    pause.cancel();
    clock.advance(TYPING_PAUSE_MS);
    expect(sent).toEqual(["Thunder"]);
  });

  it("la route n'existe que si l'extension la déclare", () => {
    const provider = (music: Record<string, unknown>) => ({ pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", ...music } }) as never;
    expect(typingPauseRoute(null)).toBeNull();
    expect(typingPauseRoute(provider({}))).toBeNull();
    expect(typingPauseRoute(provider({ typingPause: "/music/warm/typing" }))).toBe("/music/warm/typing");
    expect(typingPauseRoute(provider({ typingPause: "https://ailleurs" }))).toBeNull();
  });
});
