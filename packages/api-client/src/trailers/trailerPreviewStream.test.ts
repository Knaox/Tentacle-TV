/**
 * La demande d'un aperçu au serveur : une bande-annonce vérifiée passe, tout
 * refus du contrat — et toute panne — vaut « rien à montrer », gardé autant
 * que le serveur garde sa décision. Seul l'abandon (survol fini) remonte.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TRAILER_PREVIEW_NO_TRAILER_TTL_MS,
  TRAILER_PREVIEW_TIMING,
  TRAILER_PREVIEW_UNAVAILABLE_TTL_MS,
  type TrailerPreview,
} from "@tentacle-tv/shared";
import {
  fetchTrailerPreviewStream, isTransientPreviewRefusal, previewRetryAfterMs, previewRetryDelayMs, trailerPreviewQueryKey,
  trailerPreviewResultTtl,
} from "./trailerPreviewStream";

const ITEM = { kind: "item", itemId: "90d50b74d48412cfc9db9a256b1d0c64" } as const;

const PREVIEW: TrailerPreview = {
  ytId: "FFUGtw7uzB4",
  path: "/api/trailers/hls/FFUGtw7uzB4/master.m3u8?t=abc",
  mimeType: "application/vnd.apple.mpegurl",
  expiresAt: Date.now() + 4 * 3_600_000,
  heights: [1080, 720],
  qualities: [{ height: 1080, path: "/api/trailers/hls/FFUGtw7uzB4/master-1080.m3u8?t=abc" }],
};

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchTrailerPreviewStream", () => {
  it("une bande-annonce vérifiée : trouvée, demandée par le chemin du contrat", async () => {
    const fetchMock = respond(PREVIEW);
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "found", preview: PREVIEW });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/trailers/preview?itemId=90d50b74d48412cfc9db9a256b1d0c64&lang=fr");
  });

  it("un titre TMDB se demande par son identité", async () => {
    const fetchMock = respond(PREVIEW);
    await fetchTrailerPreviewStream({ kind: "tmdb", tmdbId: 603, mediaType: "movie" }, "en");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/trailers/preview?tmdbId=603&mediaType=movie&lang=en");
  });

  it("chaque refus du contrat est une réponse : rien à montrer", async () => {
    for (const [status, error] of [[404, "no_trailer"], [404, "unavailable"], [400, "invalid_request"]] as const) {
      respond({ error }, status);
      await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: error });
    }
  });

  it("un 429 dit quand redemander : `Retry-After` s'il est lisible", async () => {
    respond({ error: "rate_limited" }, 429, { "Retry-After": "3" });
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "rate_limited", retryAfterMs: 3_000 });
    // Caché (autre origine, en-tête non exposé) : le délai reste inconnu.
    respond({ error: "rate_limited" }, 429);
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "rate_limited" });
  });

  it("le délai du corps (`retryAfterS`) passe avant l'en-tête — il se lit de toute origine", async () => {
    respond({ error: "rate_limited", retryAfterS: 4 }, 429, { "Retry-After": "2" });
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "rate_limited", retryAfterMs: 4_000 });
    respond({ error: "rate_limited", retryAfterS: 30 }, 429);
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "rate_limited", retryAfterMs: 10_000 });
    // Un corps sans délai lisible laisse l'en-tête décider.
    respond({ error: "rate_limited", retryAfterS: "bientôt" }, 429, { "Retry-After": "3" });
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "rate_limited", retryAfterMs: 3_000 });
  });

  it("une panne, une réponse illisible : rien à montrer non plus", async () => {
    respond("boom", 502);
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "failed" });
    respond({ ytId: "court" });
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "unreadable" });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(fetchTrailerPreviewStream(ITEM, "fr")).resolves.toEqual({ status: "missing", reason: "failed" });
  });

  it("un sujet que le contrat refuse d'avance ne part pas", async () => {
    const fetchMock = respond(PREVIEW);
    await expect(fetchTrailerPreviewStream({ kind: "item", itemId: "pas-un-id" }, "fr")).resolves.toEqual({ status: "missing", reason: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("l'abandon (survol fini) remonte ; le délai propre n'est pas une panne : « le serveur décide encore »", async () => {
    const hanging = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", hanging);
    const controller = new AbortController();
    const abandoned = fetchTrailerPreviewStream(ITEM, "fr", controller.signal);
    controller.abort();
    await expect(abandoned).rejects.toMatchObject({ name: "AbortError" });
    await expect(fetchTrailerPreviewStream(ITEM, "fr", undefined, 5)).resolves.toEqual({ status: "missing", reason: "timeout" });
  });
});

describe("trailerPreviewResultTtl", () => {
  it("une bande-annonce vaut jusqu'à son jeton (moins une minute), une heure au plus", () => {
    const now = 1_000_000;
    const soon = { status: "found", preview: { ...PREVIEW, expiresAt: now + 10 * 60_000 } } as const;
    expect(trailerPreviewResultTtl(soon, now)).toBe(9 * 60_000);
    const late = { status: "found", preview: { ...PREVIEW, expiresAt: now + 4 * 3_600_000 } } as const;
    expect(trailerPreviewResultTtl(late, now)).toBe(TRAILER_PREVIEW_TIMING.streamCacheMaxMs);
    const expired = { status: "found", preview: { ...PREVIEW, expiresAt: now } } as const;
    expect(trailerPreviewResultTtl(expired, now)).toBe(0);
  });

  it("un refus vaut ce que le serveur en dit : une heure sans bande-annonce, dix minutes sinon", () => {
    expect(trailerPreviewResultTtl({ status: "missing", reason: "no_trailer" }, 0)).toBe(TRAILER_PREVIEW_NO_TRAILER_TTL_MS);
    expect(trailerPreviewResultTtl({ status: "missing", reason: "unavailable" }, 0)).toBe(TRAILER_PREVIEW_UNAVAILABLE_TTL_MS);
    expect(trailerPreviewResultTtl({ status: "missing", reason: "unreadable" }, 0)).toBe(TRAILER_PREVIEW_UNAVAILABLE_TTL_MS);
    expect(trailerPreviewResultTtl(undefined, 0)).toBe(0);
  });

  it("un refus passager ne vaut que le temps d'attendre : le 429 son délai, la panne 10 s", () => {
    expect(trailerPreviewResultTtl({ status: "missing", reason: "rate_limited", retryAfterMs: 3_000 }, 0)).toBe(3_000);
    expect(trailerPreviewResultTtl({ status: "missing", reason: "rate_limited" }, 0)).toBe(TRAILER_PREVIEW_TIMING.rateLimitDefaultMs);
    expect(trailerPreviewResultTtl({ status: "missing", reason: "failed" }, 0)).toBe(TRAILER_PREVIEW_TIMING.transientFailureMs);
    expect(isTransientPreviewRefusal({ status: "missing", reason: "rate_limited" })).toBe(true);
    expect(isTransientPreviewRefusal({ status: "missing", reason: "failed" })).toBe(true);
    expect(isTransientPreviewRefusal({ status: "missing", reason: "timeout" })).toBe(true);
    expect(trailerPreviewResultTtl({ status: "missing", reason: "timeout" }, 0)).toBe(TRAILER_PREVIEW_TIMING.timeoutRetryMs);
    for (const reason of ["no_trailer", "unavailable", "invalid_request", "unreadable"] as const) {
      expect(isTransientPreviewRefusal({ status: "missing", reason })).toBe(false);
    }
    expect(isTransientPreviewRefusal(undefined)).toBe(false);
  });

  it("le délai d'un 429 est borné : au moins 1 s, au plus 10 s, inconnu s'il est illisible", () => {
    expect(previewRetryAfterMs("2")).toBe(2_000);
    expect(previewRetryAfterMs("0")).toBe(1_000);
    expect(previewRetryAfterMs("60")).toBe(10_000);
    expect(previewRetryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
    expect(previewRetryAfterMs(null)).toBeUndefined();
    expect(previewRetryAfterMs("")).toBeUndefined();
  });

  it("quand redemander : le délai dit, sinon 2 s puis 4 s ; 10 s après une panne", () => {
    expect(previewRetryDelayMs({ status: "missing", reason: "rate_limited", retryAfterMs: 3_000 }, 1)).toBe(3_000);
    expect(previewRetryDelayMs({ status: "missing", reason: "rate_limited" }, 0)).toBe(2_000);
    expect(previewRetryDelayMs({ status: "missing", reason: "rate_limited" }, 1)).toBe(4_000);
    expect(previewRetryDelayMs({ status: "missing", reason: "rate_limited" }, 5)).toBe(10_000);
    expect(previewRetryDelayMs({ status: "missing", reason: "failed" }, 0)).toBe(10_000);
    // Notre délai expiré : on redemande aussitôt, la demande rejoint la décision en cours.
    expect(previewRetryDelayMs({ status: "missing", reason: "timeout" }, 0)).toBe(1_500);
  });

  it("la clé du cache : le titre et la langue", () => {
    expect(trailerPreviewQueryKey(ITEM, "fr")).toEqual(["trailer-preview", `item:${ITEM.itemId}`, "fr"]);
    expect(trailerPreviewQueryKey(null, "fr")).toEqual(["trailer-preview", null, "fr"]);
  });
});
