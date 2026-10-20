import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));
const { clearWtNotices, currentWtNotices, pushWtNotice, WT_NOTICE_MAX } = await import("./wtNotices");

describe("wtNotices", () => {
  afterEach(() => clearWtNotices());
  const noTimer = (() => 0) as unknown as typeof setTimeout;

  it("garde les plus récents, jamais deux fois le même texte", () => {
    for (let i = 0; i < WT_NOTICE_MAX + 2; i++) pushWtNotice("info", `m${i}`, noTimer);
    pushWtNotice("info", `m${WT_NOTICE_MAX + 1}`, noTimer);
    expect(currentWtNotices().map((n) => n.text)).toEqual(["m2", "m3", "m4"]);
  });

  it("s'efface au bout de son délai", () => {
    let fire: () => void = () => undefined;
    const timer = ((fn: () => void) => { fire = fn; return 0; }) as unknown as typeof setTimeout;
    pushWtNotice("success", "X a rejoint le groupe", timer);
    expect(currentWtNotices()).toHaveLength(1);
    fire();
    expect(currentWtNotices()).toHaveLength(0);
  });
});
