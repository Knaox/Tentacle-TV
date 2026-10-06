import { describe, expect, it } from "vitest";
import { LONG_OUTAGE_NOTICE_MS, OUTAGE_NOTICE_MS } from "@tentacle-tv/shared";
import { outageNoticeOf } from "./outageNotice";

/** Le message d'une panne : temporaire, et de retour à chaque nouvelle occasion. */
describe("message d'une panne de Jellyfin", () => {
  it("rien hors panne, rien pendant la reprise", () => {
    expect(outageNoticeOf({ phase: "none", state: "up" }, null)).toBeNull();
    expect(outageNoticeOf({ phase: "recovering", state: "up" }, null)).toBeNull();
  });

  it("une panne : son titre, un compte à rebours ; la panne longue : plus long", () => {
    const short = outageNoticeOf({ phase: "outage", state: "restarting" }, null)!;
    expect(short.copy.titleKey).toBe("player:jellyfinOutage.restarting");
    expect(short.durationMs).toBe(OUTAGE_NOTICE_MS);
    const long = outageNoticeOf({ phase: "long", state: "down" }, null)!;
    expect(long.long).toBe(true);
    expect(long.durationMs).toBe(LONG_OUTAGE_NOTICE_MS);
  });

  it("effacé, il ne reparaît qu'à la prochaine occasion — Jellyfin qui redémarre DE NOUVEAU compris", () => {
    const first = outageNoticeOf({ phase: "outage", state: "restarting" }, null)!;
    expect(outageNoticeOf({ phase: "outage", state: "restarting" }, first.occasion)).toBeNull();
    const next = outageNoticeOf({ phase: "outage", state: "starting" }, first.occasion)!;
    expect(next).not.toBeNull();
    expect(outageNoticeOf({ phase: "outage", state: "restarting" }, next.occasion)).not.toBeNull();
    expect(outageNoticeOf({ phase: "long", state: "starting" }, next.occasion)).not.toBeNull();
  });
});
