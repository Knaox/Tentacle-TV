/**
 * La sonde répond à « est-ce que quelque chose est sorti ». Une erreur de
 * comptage, et le verdict s'inverse : un silence deviendrait du trafic, ou
 * l'inverse. Le `fetch` et l'horloge entrent par la porte — rien à simuler.
 */

import { describe, expect, it } from "vitest";
import { createProbe } from "./networkProbe";

function clock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1_000;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

function response(status = 200): Response {
  return new Response(null, { status });
}

describe("sonde reseau", () => {
  it("journalise methode, url, statut et duree", async () => {
    const h = clock();
    const probe = createProbe({
      fetch: async () => { h.advance(47); return response(200); },
      now: h.now,
    });

    await probe.fetch("https://tv.exemple/api/jellyfin/Items/x/MediaSegments");

    expect(probe.log()).toHaveLength(1);
    const r = probe.log()[0];
    expect(r?.method).toBe("GET");
    expect(r?.url).toContain("MediaSegments");
    expect(r?.status).toBe(200);
    expect(r?.durationMs).toBe(47);
    expect(r?.failed).toBe(false);
  });

  it("un rejet reseau n'est pas un statut, et se distingue", async () => {
    const h = clock();
    const probe = createProbe({
      fetch: async () => { h.advance(12_000); throw new TypeError("Failed to fetch"); },
      now: h.now,
    });

    await expect(probe.fetch("https://tv.exemple/api/x")).rejects.toThrow();

    const r = probe.log()[0];
    expect(r?.failed).toBe(true);
    expect(r?.status).toBeNull();
    expect(r?.durationMs).toBe(12_000);
  });

  it("l'erreur est RELAYEE : la sonde observe, elle n'avale rien", async () => {
    const probe = createProbe({
      fetch: async () => { throw new Error("boum"); },
      now: () => 0,
    });
    await expect(probe.fetch("https://tv.exemple/x")).rejects.toThrow("boum");
  });

  it("la methode vient de l'init, ou de la Request", async () => {
    const probe = createProbe({ fetch: async () => response(), now: () => 0 });
    await probe.fetch("https://tv.exemple/x", { method: "post" });
    await probe.fetch(new Request("https://tv.exemple/y", { method: "DELETE" }));
    expect(probe.log().map((r) => r.method)).toEqual(["POST", "DELETE"]);
  });

  it("le journal est borne : c'est le recent qui informe", async () => {
    const probe = createProbe({ fetch: async () => response(), now: () => 0, max: 3 });
    for (const n of [1, 2, 3, 4, 5]) await probe.fetch(`https://tv.exemple/${n}`);
    expect(probe.log()).toHaveLength(3);
    expect(probe.log().map((r) => r.url.slice(-1))).toEqual(["3", "4", "5"]);
  });

  it("vider rend le journal vide — c'est le geste d'avant lecture", async () => {
    const probe = createProbe({ fetch: async () => response(), now: () => 0 });
    await probe.fetch("https://tv.exemple/x");
    probe.clear();
    expect(probe.log()).toHaveLength(0);
  });

  it("une requete en vol est deja journalisee, statut inconnu", async () => {
    // Initialisée plutôt que `| null` : l'analyse de flux de TypeScript ne voit
    // pas l'affectation faite dans l'exécuteur de la promesse et réduirait le
    // type à `never`.
    let release: () => void = () => undefined;
    const wait = new Promise<void>((r) => { release = r; });
    const probe = createProbe({
      fetch: async () => { await wait; return response(); },
      now: () => 0,
    });

    const inFlight = probe.fetch("https://tv.exemple/lent");
    // Sans attendre : c'est tout l'interet, on voit ce qui est PARTI.
    expect(probe.log()).toHaveLength(1);
    expect(probe.log()[0]?.status).toBeNull();

    release();
    await inFlight;
    expect(probe.log()[0]?.status).toBe(200);
  });
});
