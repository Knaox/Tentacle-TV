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

  it("masque le code d'invitation (`?invite=`), un PIN et un code passés en paramètre — rien d'autre", () => {
    expect(redactUrl("/register?invite=3f2a9c01be44d7e6")).toBe("/register?invite=[redacted]");
    expect(redactUrl("/register?lang=fr&invite=3f2a9c01be44d7e6#form")).toBe("/register?lang=fr&invite=[redacted]#form");
    expect(redactUrl("/x?pin=1234&code=AB2C&ErrorCode=7")).toBe("/x?pin=[redacted]&code=[redacted]&ErrorCode=7");
    // Ce qui sert au diagnostic reste lisible.
    for (const url of [
      "/api/plugins/titles/seasons?key=tv:1399&lang=fr",
      "/api/watch-together/affinity/votes/k?sessionId=42",
      "/support?ticketId=7&invited=1",
      "/api/jellyfin/Users/u1/Items?userId=u1&deviceId=d1&ParentId=p1",
    ]) expect(redactUrl(url)).toBe(url);
  });

  it("masque les secrets portés dans le CHEMIN : le code d'un jumelage de TV, le jeton d'un lien de partage", () => {
    expect(redactUrl("/api/pair/device/status/AB2C")).toBe("/api/pair/device/status/[redacted]");
    expect(redactUrl("/api/pair/status/AB2C?x=1")).toBe("/api/pair/status/[redacted]?x=1");
    expect(redactUrl("/api/share/0123456789abcdef?lang=fr")).toBe("/api/share/[redacted]?lang=fr");
    expect(redactUrl("/api/share/0123456789ABCDEF/item/a1b2")).toBe("/api/share/[redacted]/item/a1b2");
    expect(redactUrl("/share/0123456789abcdef/a1b2")).toBe("/share/[redacted]/a1b2");
    // Les routes fixes voisines ne bougent pas.
    for (const url of ["/api/share/mine", "/api/share/likes/mine", "/api/share/stats/mine", "/api/pair/devices", "/api/pair/device/generate"]) {
      expect(redactUrl(url)).toBe(url);
    }
  });

  it("masque les champs secrets, où qu'un appel de journal les mette", () => {
    const lines: string[] = [];
    // Sans heure ni pid : leurs chiffres croisaient parfois les codes cherchés (« 2468 » dans un horodatage).
    const log = pino({ base: null, timestamp: false, redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" } }, new Writable({ write: (c, _e, done) => void (lines.push(String(c)), done()) }));
    log.info({ password: "p1", body: { apiKey: "k1", Pw: "p2", inviteKey: "i1", pin: "1357", currentPin: "2468" }, user: "Damien" }, "essai");
    expect(lines.join("")).not.toMatch(/p1|k1|p2|i1|1357|2468/);
    expect(lines.join("")).toContain("Damien");
    // Un code d'ERREUR reste lisible : `code` n'est pas un champ masqué.
    log.warn({ code: "family.not_owner" }, "refus");
    expect(lines.join("")).toContain("family.not_owner");
  });
});
