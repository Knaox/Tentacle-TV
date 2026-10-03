import { describe, expect, it } from "vitest";
import { describeProblem } from "./describeProblem";
import { detailText, problemCopyText, problemDetails, redactSecrets } from "./problemDetails";

/**
 * Les détails techniques : dans l'ordre où l'administrateur les lit, jamais
 * un jeton (adresse, en-tête, « Bearer »), et le texte copié dit quoi,
 * pourquoi, puis les détails.
 */
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.entries(values).map(([name, value]) => `${name}=${value}`).join(",")})` : key;

describe("détails d'une erreur", () => {
  it("masque les jetons des adresses, des en-têtes et des « Bearer »", () => {
    expect(redactSecrets("GET /Videos/1/stream?api_key=abc123&Static=true")).toBe("GET /Videos/1/stream?api_key=•••&Static=true");
    expect(redactSecrets("https://h/master.m3u8?DeviceId=d1&PlaySessionId=p2&ApiKey=k3")).toBe("https://h/master.m3u8?DeviceId=•••&PlaySessionId=•••&ApiKey=•••");
    expect(redactSecrets("X-Emby-Token: secret")).toBe("X-Emby-Token: •••");
    expect(redactSecrets("Authorization: Bearer eyJhbGciOi.abc.def")).toBe("Authorization: •••");
    expect(redactSecrets('MediaBrowser Client="Tentacle", Token="s3cr3t"')).toBe('MediaBrowser Client="Tentacle", Token="•••"');
    expect(redactSecrets("Bearer abc.def")).toBe("Bearer •••");
  });

  it("range les lignes dans l'ordre de lecture, sans valeur vide", () => {
    const lines = problemDetails({
      status: 500, jellyfinErrorCode: "NoCompatibleStream", engine: "mpv", stream: "transcode", code: "",
      request: "GET /videos/1/master.m3u8?api_key=x", message: "  loading   failed ", app: "Tentacle mobile 1.10.3",
    });
    expect(lines.map((line) => line.key)).toEqual([
      "errors:detailHttp", "errors:detailJellyfin", "errors:detailEngine", "errors:detailStream",
      "errors:detailRequest", "errors:detailMessage", "errors:detailApp",
    ]);
    expect(lines[4].values.request).toBe("GET /videos/1/master.m3u8?api_key=•••");
    expect(lines[5].values.message).toBe("loading failed");
    expect(problemDetails({})).toEqual([]);
  });

  it("un message démesuré est tronqué", () => {
    const [line] = problemDetails({ message: "x".repeat(500) });
    expect(String(line.values.message)).toHaveLength(298);
  });

  it("traduit une valeur qui est elle-même une clé, et compose le texte copié", () => {
    const [stream] = problemDetails({ stream: "direct" });
    expect(detailText(stream, t)).toBe("errors:detailStream(stream=errors:streamDirect)");
    const model = describeProblem({
      cause: "fileMissing", context: "playbackStart", details: problemDetails({ status: 404 }),
    });
    expect(problemCopyText(model, t)).toBe([
      "errors:titlePlaybackStart", "errors:reasonFileMissing()", "errors:detailHttp(status=404)",
    ].join("\n"));
  });
});
