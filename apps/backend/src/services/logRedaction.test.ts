import pino from "pino";
import { Writable } from "stream";
import { describe, expect, it } from "vitest";
import { LOG_REDACT_PATHS, redactUrl } from "./logRedaction";

describe("journaux sans secret", () => {
  it("masque les jetons des URL, garde le reste", () => {
    expect(redactUrl("/api/jellyfin/videos/x/hls1/main/0.ts?api_key=abc123&MediaSourceId=9")).toBe(
      "/api/jellyfin/videos/x/hls1/main/0.ts?api_key=[redacted]&MediaSourceId=9",
    );
    expect(redactUrl("/Items?ApiKey=k&Token=t&x=1")).toBe("/Items?ApiKey=[redacted]&Token=[redacted]&x=1");
    expect(redactUrl("/api/setup/status")).toBe("/api/setup/status");
  });

  it("masque les champs secrets, où qu'un appel de journal les mette", () => {
    const lines: string[] = [];
    const log = pino({ redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" } }, new Writable({ write: (c, _e, done) => void (lines.push(String(c)), done()) }));
    log.info({ password: "p1", body: { apiKey: "k1", Pw: "p2" }, user: "Damien" }, "essai");
    expect(lines.join("")).not.toMatch(/p1|k1|p2/);
    expect(lines.join("")).toContain("Damien");
  });
});
