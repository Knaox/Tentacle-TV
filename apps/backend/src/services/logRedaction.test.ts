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

  it("masque le jeton du relais des bandes-annonces (`?t=`), lecture comme aperçu — et rien d'autre", () => {
    expect(redactUrl("/api/trailers/hls/Way9Dexny3w/s/95/0.ts?t=tmwgp9.p.SIGNATURE")).toBe(
      "/api/trailers/hls/Way9Dexny3w/s/95/0.ts?t=[redacted]",
    );
    expect(redactUrl("/api/trailers/file/Way9Dexny3w.mp4?t=tmwgp9.SIGNATURE")).toBe("/api/trailers/file/Way9Dexny3w.mp4?t=[redacted]");
    expect(redactUrl("/x?type=Movie&tag=abc&t=s")).toBe("/x?type=Movie&tag=abc&t=[redacted]");
  });

  it("masque les champs secrets, où qu'un appel de journal les mette", () => {
    const lines: string[] = [];
    const log = pino({ redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" } }, new Writable({ write: (c, _e, done) => void (lines.push(String(c)), done()) }));
    log.info({ password: "p1", body: { apiKey: "k1", Pw: "p2" }, user: "Damien" }, "essai");
    expect(lines.join("")).not.toMatch(/p1|k1|p2/);
    expect(lines.join("")).toContain("Damien");
  });
});
