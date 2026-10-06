import { describe, expect, it } from "vitest";
import { LONG_OUTAGE_NOTICE_MS, OUTAGE_NOTICE_MS } from "@tentacle-tv/shared";
import { outageNoticeOf } from "./outageNotice";

/** Le message d'une panne : temporaire, et de retour à chaque nouvelle occasion. */
describe("message d'une panne de Jellyfin", () => {
  it("rien hors panne, rien pendant la reprise", () => {
    expect(outageNoticeOf({ phase: "none", state: "up", recoveries: 0 }, null)).toBeNull();
    expect(outageNoticeOf({ phase: "recovering", state: "up", recoveries: 1 }, null)).toBeNull();
  });

  it("une panne : son titre, un compte à rebours ; la panne longue : plus long", () => {
    const short = outageNoticeOf({ phase: "outage", state: "restarting", recoveries: 0 }, null)!;
    expect(short.copy.titleKey).toBe("player:jellyfinOutage.restarting");
    expect(short.durationMs).toBe(OUTAGE_NOTICE_MS);
    const long = outageNoticeOf({ phase: "long", state: "down", recoveries: 0 }, null)!;
    expect(long.long).toBe(true);
    expect(long.durationMs).toBe(LONG_OUTAGE_NOTICE_MS);
  });

  it("effacé, il ne reparaît qu'à la prochaine occasion — Jellyfin qui redémarre DE NOUVEAU compris", () => {
    const first = outageNoticeOf({ phase: "outage", state: "restarting", recoveries: 0 }, null)!;
    expect(outageNoticeOf({ phase: "outage", state: "restarting", recoveries: 0 }, first.occasion)).toBeNull();
    const next = outageNoticeOf({ phase: "outage", state: "starting", recoveries: 0 }, first.occasion)!;
    expect(next).not.toBeNull();
    expect(outageNoticeOf({ phase: "outage", state: "restarting", recoveries: 0 }, next.occasion)).not.toBeNull();
    expect(outageNoticeOf({ phase: "long", state: "starting", recoveries: 0 }, next.occasion)).not.toBeNull();
  });

  it("une NOUVELLE panne redit chaque état, même déjà dit à la panne d'avant", () => {
    const first = outageNoticeOf({ phase: "outage", state: "starting", recoveries: 0 }, null)!;
    expect(outageNoticeOf({ phase: "outage", state: "starting", recoveries: 0 }, first.occasion)).toBeNull();
    expect(outageNoticeOf({ phase: "outage", state: "starting", recoveries: 1 }, first.occasion)).not.toBeNull();
  });
});
