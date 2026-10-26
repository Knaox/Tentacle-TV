/**
 * La porte réseau de l'import : jamais une adresse hors de la liste fermée,
 * même au bout d'une redirection (SSRF), taille bornée.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedImportUrl, ImportFetchError, networkFetcher } from "./importFetch";

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, headers: Record<string, string> = {}, body = ""): Response {
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
}

describe("allowedImportUrl", () => {
  it.each(["https://open.spotify.com/embed/playlist/x", "https://api.deezer.com/playlist/1", "https://music.apple.com/us/playlist/x/pl.abc"])("permet %s", (url) => {
    expect(allowedImportUrl(url)).not.toBeNull();
  });

  it.each([
    "http://open.spotify.com/embed/playlist/x",
    "https://open.spotify.com:8443/embed/playlist/x",
    "https://user:pw@open.spotify.com/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost:3001/api/admin",
    "https://open.spotify.com.evil.example/x",
    "https://evil.example/?u=https://open.spotify.com",
    "file:///etc/passwd",
  ])("refuse %s", (url) => {
    expect(allowedImportUrl(url)).toBeNull();
  });
});

describe("networkFetcher", () => {
  it("suit une redirection vers un hôte de la liste, et dit l'adresse finale", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(302, { location: "https://www.deezer.com/fr/playlist/42" }))
      .mockResolvedValueOnce(respond(200, {}, "ok"));
    vi.stubGlobal("fetch", fetchMock);
    const page = await networkFetcher("https://link.deezer.com/s/abc", "html");
    expect(page).toEqual({ status: 200, url: "https://www.deezer.com/fr/playlist/42", body: "ok" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("refuse une redirection vers un hôte hors liste (aucune requête vers lui)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(302, { location: "http://127.0.0.1:3001/api/admin" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(networkFetcher("https://spotify.link/abc", "html")).rejects.toMatchObject({ reason: "host" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuse une adresse de départ hors liste sans rien demander", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(networkFetcher("https://evil.example/x", "html")).rejects.toBeInstanceOf(ImportFetchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("s'arrête après trois redirections", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => respond(302, { location: "https://www.deezer.com/playlist/1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(networkFetcher("https://www.deezer.com/playlist/1", "html")).rejects.toMatchObject({ reason: "host" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("refuse une réponse trop grande", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-length": String(50 * 1024 * 1024) }, "x")));
    await expect(networkFetcher("https://api.deezer.com/playlist/1", "json")).rejects.toMatchObject({ reason: "tooLarge" });
  });
});
