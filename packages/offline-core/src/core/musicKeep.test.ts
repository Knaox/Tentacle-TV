/**
 * La musique gardée (Octave, bureau) dans le moteur des films : la mise en
 * file, la validation (le jeton ne part que vers le serveur Tentacle), l'URL
 * tirée de `source_path`, la pochette, et la séparation d'avec les films.
 */

import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openInMemory } from "../node/nodeDatabase";
import { nodeVolume } from "../node/nodeFiles";
import { enqueueBatch } from "./enqueue";
import { heal } from "./heal";
import { listForUser } from "./listing";
import { enqueueMusicBatch, isPublicArtUrl, isServerPath, musicItemId, musicRelPath, type MusicKeepItem } from "./musicKeep";
import { isMusicItem, listMusicCollections, listMusicForUser, musicItemOfKey, saveMusicCollection } from "./musicLibrary";
import { getFile } from "./queue";
import { repairUsage } from "./usage";
import { deleteClaim } from "./store";
import type { TransferNet } from "./transferNet";
import { CREDS, makeEngine, preparedRoot } from "./testkit";
import { mediaUrl } from "./worker";

const GIB = 1024 * 1024 * 1024;
const JF = "0123456789abcdef0123456789abcdef";

function track(partial: Partial<MusicKeepItem> = {}): MusicKeepItem {
  return {
    trackKey: `jf:${JF}`,
    origin: "library",
    sourcePath: `/api/downloads/original/${JF}?mediaSourceId=${JF}`,
    variant: "original",
    preset: null,
    containerExt: "flac",
    expectedSize: 3,
    estimatedSize: null,
    title: "Atlantean Twilight",
    artist: "Elegant Piano",
    album: "Piano",
    albumKey: "jf:album1",
    discNumber: 1,
    trackNumber: 2,
    durationMs: 20_000,
    artworkPath: `/api/music/artwork/${JF}`,
    trackJson: JSON.stringify({ key: `jf:${JF}`, title: "Atlantean Twilight" }),
    ...partial,
  };
}

const EXTERNAL = track({
  trackKey: "ext:sillon:ytm:t:dQw4w9WgXcQ",
  origin: "external",
  sourcePath: "/api/plugins/sillon/music/offline/ytm%3At%3AdQw4w9WgXcQ",
  containerExt: "audio",
  expectedSize: null,
  estimatedSize: 5_000_000,
  artworkPath: null,
});

describe("identifiants et chemins", () => {
  it("un titre de la bibliothèque garde son identifiant Jellyfin, un titre d'ailleurs une empreinte stable", () => {
    expect(musicItemId(`jf:${JF}`)).toBe(JF);
    const id = musicItemId("ext:sillon:rec:11111111-2222-3333-4444-555555555555~rel:66666666-7777-8888-9999-000000000000");
    expect(id).toMatch(/^ext-[0-9a-f]{32}$/);
    expect(musicItemId("ext:sillon:rec:11111111-2222-3333-4444-555555555555~rel:66666666-7777-8888-9999-000000000000")).toBe(id);
    expect(musicItemId("ext:sillon:ytm:t:a")).not.toBe(musicItemId("ext:sillon:ytm:t:b"));
    expect(musicItemId("jf:../../etc")).toBeNull();
    expect(musicItemId("autre")).toBeNull();
  });

  it("n'admet qu'un chemin du serveur Tentacle (le jeton y part)", () => {
    expect(isServerPath("/api/plugins/sillon/music/offline/abc")).toBe(true);
    expect(isServerPath("https://ailleurs.exemple/x")).toBe(false);
    expect(isServerPath("//ailleurs.exemple/api/x")).toBe(false);
    expect(isServerPath("/api/../secret")).toBe(false);
    expect(isServerPath("/autre/chose")).toBe(false);
  });

  it("une pochette par nom de Sillon (espaces en « + ») est un chemin du serveur", () => {
    expect(isServerPath("/api/plugins/sillon/music/art/q/7ccc7db2f0e090e3/250?ar=D.Meletis&ti=Giyu+VS+Akaza+-+Tomioka+Slayer+Mark+-+%28From+%27Demon+Slayer+Infinity+Castle%27%29&al=Giyu+VS+Akaza")).toBe(true);
    expect(isServerPath("/api/x?a=b*c")).toBe(true);
    expect(isServerPath("/api/x?a=<b>")).toBe(false);
  });

  it("une pochette d'ailleurs : https publique seulement, jamais un jeton dedans", () => {
    expect(isPublicArtUrl("https://lh3.googleusercontent.com/abc=w544-h544")).toBe(true);
    expect(isPublicArtUrl("http://ailleurs.exemple/a.jpg")).toBe(false);
    expect(isPublicArtUrl("https://u:p@ailleurs.exemple/a.jpg")).toBe(false);
    expect(isPublicArtUrl("https://ailleurs.exemple/a.jpg?token=x")).toBe(false);
    expect(isPublicArtUrl(`https://ailleurs.exemple/${"a".repeat(600)}`)).toBe(false);
  });

  it("nomme le média d'après la variante", () => {
    expect(musicRelPath(JF, track())).toBe(`media/${JF}/audio-original.flac`);
    expect(musicRelPath(JF, track({ variant: "light", preset: "a256" }))).toBe(`media/${JF}/audio-a256.m4a`);
  });
});

describe("mise en file", () => {
  it("refuse un lot dont une source n'est pas sur le serveur", () => {
    const db = openInMemory();
    expect(() => enqueueMusicBatch(db, "u", [track({ sourcePath: "https://ailleurs.exemple/a.flac" })], 100 * GIB, 1)).toThrow("invalid-item");
    expect(() => enqueueMusicBatch(db, "u", [track({ origin: "external" })], 100 * GIB, 1)).toThrow("invalid-item");
    expect(() => enqueueMusicBatch(db, "u", [], 100 * GIB, 1)).toThrow("empty-batch");
  });

  it("une pochette qu'on ne peut pas garder part seule : le titre est gardé, sans elle (27/10 : tout le lot était refusé)", () => {
    const db = openInMemory();
    // Un autre hôte : jamais pour un titre de la bibliothèque (la sienne est au serveur) ; jamais un jeton dans l'adresse.
    const library = enqueueMusicBatch(db, "u", [track({ artworkPath: "https://ailleurs.exemple/a.jpg" })], 100 * GIB, 1);
    const external = enqueueMusicBatch(db, "u", [{ ...EXTERNAL, artworkPath: "https://ailleurs.exemple/a.jpg?api_key=x" }], 100 * GIB, 1);
    expect([library.accepted, external.accepted]).toEqual([true, true]);
    const rows = db.prepare("SELECT artwork_path FROM music_meta").all() as Array<{ artwork_path: string | null }>;
    expect(rows.map((row) => row.artwork_path)).toEqual([null, null]);
  });

  it("refuse l'album entier faute de place, jamais la moitié", () => {
    const db = openInMemory();
    const outcome = enqueueMusicBatch(db, "u", [track({ expectedSize: GIB }), EXTERNAL], GIB, 1);
    expect(outcome.accepted).toBe(false);
    expect(listMusicForUser(db, "u")).toEqual([]);
  });

  it("garde le titre dans le moteur des films, sans paraître dans leur liste", () => {
    const db = openInMemory();
    const outcome = enqueueMusicBatch(db, "u", [track(), EXTERNAL], 100 * GIB, 1_000);
    expect(outcome.accepted).toBe(true);
    const kept = listMusicForUser(db, "u");
    expect(kept.map((k) => k.trackKey)).toEqual([`jf:${JF}`, EXTERNAL.trackKey]);
    expect(kept[0]).toMatchObject({ status: "queued", origin: "library", title: "Atlantean Twilight", trackNumber: 2 });
    expect(listForUser(db, "u")).toEqual([]);
    expect(listMusicForUser(db, "autre")).toEqual([]);
    expect(isMusicItem(db, JF)).toBe(true);
    expect(musicItemOfKey(db, EXTERNAL.trackKey)).toBe(musicItemId(EXTERNAL.trackKey));
    const file = getFile(db, outcome.fileIds[1]!)!;
    expect(mediaUrl("https://s", file)).toBe(`https://s${EXTERNAL.sourcePath}`);
  });

  it("un film reste une entrée de la liste des films", () => {
    const db = openInMemory();
    enqueueMusicBatch(db, "u", [track()], 100 * GIB, 1_000);
    enqueueBatch(db, "u", [{
      itemId: "film1", mediaSourceId: "ms1", variant: "original", preset: null, containerExt: "mkv", expectedSize: 10,
      estimatedSize: null, kind: "movie", seriesId: null, seasonId: null, libraryId: null, runtimeTicks: null, title: "Film",
      seriesName: null, indexNumber: null, parentIndexNumber: null, autoDeleteAfterWatch: false, autoDeleteDelayMinutes: 0,
      audioStreamIndex: null, burnSubtitleIndex: null, subtitles: null,
    }], 100 * GIB, 2_000);
    expect(listForUser(db, "u").map((e) => e.itemId)).toEqual(["film1"]);
    expect(getFile(db, listForUser(db, "u")[0]!.id)!.sourcePath).toBeNull();
  });

  it("deux comptes partagent un fichier ; le dernier qui le retire emporte la fiche", () => {
    const db = openInMemory();
    const root = preparedRoot();
    const first = enqueueMusicBatch(db, "u", [track()], 100 * GIB, 1).fileIds[0]!;
    const second = enqueueMusicBatch(db, "v", [track()], 100 * GIB, 2).fileIds[0]!;
    expect(second).toBe(first);
    deleteClaim(db, nodeVolume(root), "u", first);
    expect(isMusicItem(db, JF)).toBe(true);
    deleteClaim(db, nodeVolume(root), "v", first);
    expect(isMusicItem(db, JF)).toBe(false);
  });
});

describe("collections", () => {
  it("garde un album dans son ordre, par compte", () => {
    const db = openInMemory();
    saveMusicCollection(db, "u", { key: "album:jf:a1", kind: "album", title: "Piano", subtitle: "Elegant", coverItemId: JF, trackKeys: ["jf:2", "jf:1"] }, 5);
    saveMusicCollection(db, "u", { key: "album:jf:a1", kind: "album", title: "Piano", subtitle: "Elegant", coverItemId: JF, trackKeys: ["jf:1", "jf:2"] }, 6);
    expect(listMusicCollections(db, "u")).toEqual([
      { key: "album:jf:a1", kind: "album", title: "Piano", subtitle: "Elegant", coverItemId: JF, trackKeys: ["jf:1", "jf:2"], updatedAt: 6 },
    ]);
    expect(listMusicCollections(db, "v")).toEqual([]);
  });
});

describe("transfert", () => {
  it("tire le média depuis le chemin du titre, puis pose sa pochette ; la réparation n'y touche pas", async () => {
    const db = openInMemory();
    const root = preparedRoot("tentacle-music-");
    const opened: string[] = [];
    const net: TransferNet = {
      async open(url) {
        opened.push(url);
        return { status: 200, header: () => null, chunks: (async function* () { yield new Uint8Array([1, 2, 3]); })() };
      },
      async killTranscode() {
        /* rien */
      },
    };
    const fetched: string[] = [];
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    const { engine } = makeEngine(db, root, net, {
      makeFetcher: () => async (url) => {
        fetched.push(url);
        return jpeg;
      },
    });
    const fileId = enqueueMusicBatch(db, "u", [track()], 100 * GIB, 1).fileIds[0]!;
    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)!.status).toBe("complete"));
    expect(opened).toEqual([`${CREDS.serverUrl}${track().sourcePath}`]);
    expect(fetched).toEqual([`${CREDS.serverUrl}/api/music/artwork/${JF}`]);
    const kept = listMusicForUser(db, "u")[0]!;
    expect(kept.coverRel).toBe(`media/${JF}/cover.jpg`);
    expect(fs.readFileSync(path.join(root, kept.coverRel!))).toEqual(Buffer.from(jpeg));
    // La réparation : ni fiche Jellyfin, ni planches pour un titre (la pochette est déjà là).
    fetched.length = 0;
    await heal(async (url) => (fetched.push(url), null), db, CREDS.serverUrl, nodeVolume(root), 10);
    expect(fetched).toEqual([]);
    // Le balayage des orphelins (chaque démarrage du mobile) garde la pochette : elle a son propriétaire.
    repairUsage(db, nodeVolume(root), 11, { skipFileIds: new Set(), removeOrphans: true });
    expect(fs.existsSync(path.join(root, kept.coverRel!))).toBe(true);
    // Une pochette posée puis disparue (balayée par un moteur d'avant) : la réparation la reprend.
    fs.rmSync(path.join(root, kept.coverRel!));
    await heal(async (url) => (fetched.push(url), jpeg), db, CREDS.serverUrl, nodeVolume(root), 12);
    expect(fetched).toEqual([`${CREDS.serverUrl}/api/music/artwork/${JF}`]);
    expect(fs.readFileSync(path.join(root, kept.coverRel!))).toEqual(Buffer.from(jpeg));
    // Retiré (une playlist tenue à jour l'a perdu) : ni média, ni pochette, ni dossier ne restent sur le disque.
    deleteClaim(db, nodeVolume(root), "u", fileId);
    expect(fs.existsSync(path.join(root, "media", JF))).toBe(false);
    expect(listMusicForUser(db, "u")).toEqual([]);
  });

  it("un titre hors bibliothèque garde SA pochette d'un autre hôte, demandée SANS jeton", async () => {
    const db = openInMemory();
    const root = preparedRoot("tentacle-music-");
    const net: TransferNet = {
      async open() {
        return { status: 200, header: () => null, chunks: (async function* () { yield new Uint8Array([1, 2, 3]); })() };
      },
      async killTranscode() {
        /* rien */
      },
    };
    const withToken: string[] = [];
    const withoutToken: string[] = [];
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    const art = "https://lh3.googleusercontent.com/abc=w544-h544";
    const { engine } = makeEngine(db, root, net, {
      makeFetcher: () => async (url) => (withToken.push(url), jpeg),
      makePublicFetcher: () => async (url) => (withoutToken.push(url), jpeg),
    });
    const fileId = enqueueMusicBatch(db, "u", [{ ...EXTERNAL, artworkPath: art }], 100 * GIB, 1).fileIds[0]!;
    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)!.status).toBe("complete"));
    await vi.waitFor(() => expect(listMusicForUser(db, "u")[0]?.coverRel).toMatch(/cover\.jpg$/));
    expect(withoutToken).toEqual([art]);
    expect(withToken).toEqual([]);
  });

  it("sans récupérateur sans jeton, la pochette d'ailleurs n'est pas gardée — jamais demandée avec le jeton", async () => {
    const db = openInMemory();
    const root = preparedRoot("tentacle-music-");
    enqueueMusicBatch(db, "u", [{ ...EXTERNAL, artworkPath: "https://lh3.googleusercontent.com/x" }], 100 * GIB, 1);
    const withToken: string[] = [];
    // La réparation d'un titre complet sans pochette, sans `fetchPublic` : rien ne part.
    db.prepare("UPDATE files SET status = 'complete'").run();
    await heal(async (url) => (withToken.push(url), null), db, CREDS.serverUrl, nodeVolume(root), 10);
    expect(withToken).toEqual([]);
  });
});