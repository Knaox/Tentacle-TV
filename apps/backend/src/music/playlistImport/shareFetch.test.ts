/**
 * La porte réseau de la source `tentacle` (SSRF) : une seule adresse construite, HTTPS, aucune adresse
 * interne (jugée à la RÉSOLUTION, pas sur le nom), sauf l'ouverture explicite d'une maison — jamais le lien
 * local. Et le lecteur : un document revérifié, un lien de CE serveur lu sans réseau.
 */

import { describe, expect, it, vi } from "vitest";
import type { LookupAddress } from "dns";
import http from "http";
import type { AddressInfo } from "net";
import { createShareFetcher, guardedLookup, privateShareImportAllowed, shareAddressAllowed, shareDocumentTarget } from "./shareFetch";
import { readTentacleShare } from "./readers/tentacleReader";
import { ImportReadFailure } from "./readers/readerKit";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";
const LINK = `https://ami.example/octave/share/${TOKEN}`;

describe("adresses permises pour un lien de partage", () => {
  it("Internet seulement par défaut ; la maison ouverte à la demande ; le lien local jamais", () => {
    for (const ip of ["93.184.216.34", "2606:4700::1111", "100.64.1.2"]) expect(shareAddressAllowed(ip, false)).toBe(true);
    for (const ip of ["127.0.0.1", "::1", "10.0.0.5", "192.168.1.4", "172.16.3.3", "fd00::1", "169.254.169.254", "0.0.0.0", "224.0.0.1", "::ffff:127.0.0.1"]) {
      expect(shareAddressAllowed(ip, false)).toBe(false);
    }
    expect(shareAddressAllowed("192.168.1.4", true)).toBe(true);
    expect(shareAddressAllowed("127.0.0.1", true)).toBe(true);
    expect(shareAddressAllowed("169.254.169.254", true)).toBe(false);
  });

  it("l'ouverture se lit dans TENTACLE_SHARE_IMPORT_PRIVATE", () => {
    expect(privateShareImportAllowed({})).toBe(false);
    expect(privateShareImportAllowed({ TENTACLE_SHARE_IMPORT_PRIVATE: "on" })).toBe(true);
  });

  it("une seule adresse, construite depuis le lien ; HTTP et IP interne littérale refusés", () => {
    expect(shareDocumentTarget(LINK, false)?.toString()).toBe(`https://ami.example/api/music/share/${TOKEN}`);
    expect(shareDocumentTarget(`http://ami.example/octave/share/${TOKEN}`, false)).toBeNull();
    expect(shareDocumentTarget(`http://192.168.1.4:3000/octave/share/${TOKEN}`, true)?.toString()).toBe(`http://192.168.1.4:3000/api/music/share/${TOKEN}`);
    expect(shareDocumentTarget(`https://10.0.0.1/octave/share/${TOKEN}`, false)).toBeNull();
    expect(shareDocumentTarget(`https://[::1]/octave/share/${TOKEN}`, false)).toBeNull();
    expect(shareDocumentTarget("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", false)).toBeNull();
  });

  it("à la connexion : chaque adresse résolue est jugée (un nom qui mène à la boucle locale est refusé)", async () => {
    const resolveTo = (addresses: LookupAddress[]) => ((_h: string, _o: unknown, cb: (e: null, a: LookupAddress[]) => void) => cb(null, addresses)) as never;
    const run = (addresses: LookupAddress[]) =>
      new Promise<{ error: unknown; address: unknown }>((resolve) =>
        guardedLookup(false, resolveTo(addresses))("ami.example", {}, (error, address) => resolve({ error, address })),
      );
    expect(await run([{ address: "127.0.0.1", family: 4 }])).toMatchObject({ address: "" });
    expect((await run([{ address: "127.0.0.1", family: 4 }])).error).toBeTruthy();
    expect(await run([{ address: "10.1.1.1", family: 4 }, { address: "93.184.216.34", family: 4 }])).toEqual({ error: null, address: "93.184.216.34" });
  });
});

describe("la requête elle-même", () => {
  it("une durée totale bornée (un serveur qui égrène ses octets est coupé) et aucune socket du pool commun", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      const drip = setInterval(() => res.write(" "), 20);
      res.on("close", () => clearInterval(drip));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const get = vi.spyOn(http, "get");
    try {
      const started = Date.now();
      const outcome = await createShareFetcher(true, 200)(`http://127.0.0.1:${port}/octave/share/${TOKEN}`).catch((e: Error) => e);
      expect(outcome).toMatchObject({ reason: "network" });
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(get.mock.calls[0]?.[1]).toMatchObject({ agent: false });
    } finally {
      get.mockRestore();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("lecteur d'un partage Tentacle", () => {
  const body = JSON.stringify({ v: 1, name: "Été", ownerName: "Ami", total: 1, truncated: false, tracks: [{ title: "Un", artists: ["A"], album: null, durationMs: 1000, recording: null }] });

  it("le document revérifié devient une playlist à importer", async () => {
    const playlist = await readTentacleShare(async () => ({ status: 200, body }), LINK, TOKEN);
    expect(playlist).toMatchObject({ source: "tentacle", name: "Été", truncated: false, artworkUrl: null, tracks: [{ index: 0, title: "Un", artists: ["A"] }] });
  });

  it("révoqué : introuvable ; autre réponse : indisponible ; vide : rien à lire", async () => {
    const fail = async (status: number, text = body) =>
      readTentacleShare(async () => ({ status, body: text }), LINK, TOKEN).catch((e: ImportReadFailure) => e.failure);
    expect(await fail(404)).toBe("notFound");
    expect(await fail(500)).toBe("unavailable");
    expect(await fail(200, "<html>")).toBe("unavailable");
    expect(await fail(200, JSON.stringify({ v: 1, tracks: [] }))).toBe("empty");
  });

  it("un jeton de CE serveur se lit sans réseau", async () => {
    let fetched = false;
    const playlist = await readTentacleShare(
      async () => {
        fetched = true;
        return { status: 500, body: "" };
      },
      LINK,
      TOKEN,
      async () => JSON.parse(body),
    );
    expect(fetched).toBe(false);
    expect(playlist.name).toBe("Été");
  });
});
