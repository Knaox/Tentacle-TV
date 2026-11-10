/** Lot « pg » : une rafale de `music:resolved` ne relit qu'une fois par fenêtre ; un geste isolé, tout de suite. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { coalesced, EVENT_COALESCE_MS } from "./eventCoalesce";

afterEach(() => vi.useRealTimers());

describe("coalesced", () => {
  it("le premier tout de suite, 500 suivants en UNE relecture à la fin de la fenêtre", () => {
    vi.useFakeTimers();
    const owner = {};
    const run = vi.fn();
    for (let i = 0; i < 501; i += 1) coalesced(owner, "pending:x", run);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(EVENT_COALESCE_MS);
    expect(run).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(EVENT_COALESCE_MS * 3);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("deux clés, deux propriétaires : aucune ne retient l'autre", () => {
    vi.useFakeTimers();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const owner = {};
    coalesced(owner, "pending:x", a);
    coalesced(owner, "pending:y", b);
    coalesced({}, "pending:x", c);
    expect([a, b, c].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("la fenêtre passée, un évènement isolé relit tout de suite", () => {
    vi.useFakeTimers();
    const owner = {};
    const run = vi.fn();
    coalesced(owner, "k", run);
    vi.advanceTimersByTime(EVENT_COALESCE_MS + 1);
    coalesced(owner, "k", run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
