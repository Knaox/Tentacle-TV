/**
 * Le partage d'une playlist, ses règles pures : le document public (rien que des métadonnées), son chargement
 * dans les droits du propriétaire, la page (échappée, un seul état « indisponible »), et la redirection vers
 * la page d'import du Tentacle du visiteur (un chemin fixe, jamais une adresse d'un tiers).
 */

import { describe, expect, it } from "vitest";
import type { MusicPlaylistDetail } from "../contract/musicCoreApi";
import type { MusicTrack } from "../contract/musicTypes";
import { loadShareDocument, sharedDocumentOf, type ShareDocumentDeps } from "./shareDocument";
import { musicSharePageHtml } from "./sharePageHtml";
import { importTargetUrl } from "./sharePage";

const track = (id: string, over: Partial<MusicTrack> = {}): MusicTrack => ({
  key: `jf:${id}`, jellyfinId: id, external: null, title: `T${id}`, artists: [{ name: "Artiste", mbid: null } as never], album: { title: "Album" } as never,
  durationMs: 180_000, trackNumber: 1, discNumber: 1, year: 2020, artworkUrl: `/api/music/art/${id}?api_key=secret`,
  mbids: { recording: "0f6e4b6c-1111-2222-3333-444455556666", release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  ...over,
});

const detail = (count: number): MusicPlaylistDetail =>
  ({ jellyfinId: "pl1", name: "Été <3", description: "Pour la plage", editable: true, artworkUrl: "/x", entries: Array.from({ length: count }, (_, i) => ({ entryId: `e${i}`, position: i, track: track(`t${i}`) })) }) as never;

describe("document public d'un partage", () => {
  it("les métadonnées des titres seulement : aucun identifiant Jellyfin, aucune image, aucun jeton", () => {
    const doc = sharedDocumentOf(detail(2), "Damien");
    expect(doc).toMatchObject({ v: 1, name: "Été <3", description: "Pour la plage", ownerName: "Damien", total: 2, truncated: false });
    expect(doc.tracks[0]).toEqual({ title: "Tt0", artists: ["Artiste"], album: "Album", durationMs: 180_000, recording: "0f6e4b6c-1111-2222-3333-444455556666" });
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/"t0"|jf:|api_key|entryId|art\//);
  });

  it("plafonné à 1 000 titres, le reste dit", () => {
    const doc = sharedDocumentOf(detail(1_003), "D");
    expect(doc.tracks).toHaveLength(1_000);
    expect(doc).toMatchObject({ total: 1_003, truncated: true });
  });

  const deps = (over: Partial<ShareDocumentDeps> = {}): ShareDocumentDeps => ({
    find: async (token) => (token === "tok" ? { token, playlistId: "pl1", ownerUserId: "owner", ownerName: "Damien", createdAt: 1 } : null),
    mayShare: async () => true,
    view: async (userId) => ({ userId, access: { mode: "all" } as never, favorites: new Set() }),
    detail: async () => detail(1),
    ...over,
  });

  it("relu dans les droits du propriétaire : jeton inconnu, droit perdu, musique ou playlist plus vue", async () => {
    expect(await loadShareDocument("tok", deps())).toMatchObject({ ok: true, document: { ownerName: "Damien" } });
    expect(await loadShareDocument("autre", deps())).toEqual({ ok: false, reason: "not_found" });
    expect(await loadShareDocument("tok", deps({ mayShare: async () => false }))).toEqual({ ok: false, reason: "unavailable" });
    expect(await loadShareDocument("tok", deps({ view: async (userId) => ({ userId, access: { mode: "none" } as never, favorites: new Set() }) }))).toEqual({ ok: false, reason: "unavailable" });
    expect(await loadShareDocument("tok", deps({ detail: async () => null }))).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("page du lien", () => {
  const link = "https://moi.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv";
  it("tout texte échappé ; l'import part vers CE serveur ; l'app par son schéma", () => {
    const html = musicSharePageHtml({ lang: "fr", document: sharedDocumentOf(detail(1), "<b>Damien</b>"), path: "/octave/share/AbCdEfGhIjKlMnOpQrStUv", link, nonce: "n" });
    expect(html).toContain("Été &lt;3");
    expect(html).toContain("Par &lt;b&gt;Damien&lt;/b&gt;");
    expect(html).not.toContain("<b>Damien");
    expect(html).toContain('action="/octave/share/AbCdEfGhIjKlMnOpQrStUv/import"');
    expect(html).toContain(`href="tentacle://octave-share?link=${encodeURIComponent(link)}"`);
    expect(html).not.toMatch(/<script/i);
  });

  it("sans document : un seul état, qui ne dit pas pourquoi", () => {
    const html = musicSharePageHtml({ lang: "en", document: null, path: "/octave/share/x", link, nonce: "n" });
    expect(html).toContain("Link unavailable");
    expect(html).not.toContain("<form");
  });
});

describe("« Importer dans mon Tentacle » : la page d'import du serveur TAPÉ", () => {
  const link = "https://moi.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv";
  const share = encodeURIComponent(link);
  it("https par défaut, port et préfixe gardés, la page d'Octave rabattue sur la racine", () => {
    expect(importTargetUrl("ami.fr", link)).toBe(`https://ami.fr/octave/import?share=${share}`);
    expect(importTargetUrl(" http://192.168.1.4:3000/ ", link)).toBe(`http://192.168.1.4:3000/octave/import?share=${share}`);
    expect(importTargetUrl("https://ami.fr/tentacle/octave/playlists?x=1", link)).toBe(`https://ami.fr/tentacle/octave/import?share=${share}`);
  });

  it("refusé : vide, autre protocole, identifiants", () => {
    expect(importTargetUrl("", link)).toBeNull();
    expect(importTargetUrl(undefined, link)).toBeNull();
    expect(importTargetUrl("javascript:alert(1)", link)).toBeNull();
    expect(importTargetUrl("ftp://ami.fr", link)).toBeNull();
    expect(importTargetUrl("https://a:b@ami.fr", link)).toBeNull();
  });
});
