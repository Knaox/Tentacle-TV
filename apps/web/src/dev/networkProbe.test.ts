/**
 * La sonde répond à « est-ce que quelque chose est sorti ». Une erreur de
 * comptage, et le verdict s'inverse : un silence deviendrait du trafic, ou
 * l'inverse. Le `fetch` et l'horloge entrent par la porte — rien à simuler.
 */

import { describe, expect, it } from "vitest";
import { creerSonde } from "./networkProbe";

function horloge(): { now: () => number; avancer: (ms: number) => void } {
  let t = 1_000;
  return { now: () => t, avancer: (ms) => { t += ms; } };
}

function reponse(status = 200): Response {
  return new Response(null, { status });
}

describe("sonde reseau", () => {
  it("journalise methode, url, statut et duree", async () => {
    const h = horloge();
    const sonde = creerSonde({
      fetch: async () => { h.avancer(47); return reponse(200); },
      now: h.now,
    });

    await sonde.fetch("https://tv.exemple/api/jellyfin/Items/x/MediaSegments");

    expect(sonde.journal()).toHaveLength(1);
    const r = sonde.journal()[0];
    expect(r?.methode).toBe("GET");
    expect(r?.url).toContain("MediaSegments");
    expect(r?.status).toBe(200);
    expect(r?.dureeMs).toBe(47);
    expect(r?.echec).toBe(false);
  });

  it("un rejet reseau n'est pas un statut, et se distingue", async () => {
    const h = horloge();
    const sonde = creerSonde({
      fetch: async () => { h.avancer(12_000); throw new TypeError("Failed to fetch"); },
      now: h.now,
    });

    await expect(sonde.fetch("https://tv.exemple/api/x")).rejects.toThrow();

    const r = sonde.journal()[0];
    expect(r?.echec).toBe(true);
    expect(r?.status).toBeNull();
    expect(r?.dureeMs).toBe(12_000);
  });

  it("l'erreur est RELAYEE : la sonde observe, elle n'avale rien", async () => {
    const sonde = creerSonde({
      fetch: async () => { throw new Error("boum"); },
      now: () => 0,
    });
    await expect(sonde.fetch("https://tv.exemple/x")).rejects.toThrow("boum");
  });

  it("la methode vient de l'init, ou de la Request", async () => {
    const sonde = creerSonde({ fetch: async () => reponse(), now: () => 0 });
    await sonde.fetch("https://tv.exemple/x", { method: "post" });
    await sonde.fetch(new Request("https://tv.exemple/y", { method: "DELETE" }));
    expect(sonde.journal().map((r) => r.methode)).toEqual(["POST", "DELETE"]);
  });

  it("le journal est borne : c'est le recent qui informe", async () => {
    const sonde = creerSonde({ fetch: async () => reponse(), now: () => 0, max: 3 });
    for (const n of [1, 2, 3, 4, 5]) await sonde.fetch(`https://tv.exemple/${n}`);
    expect(sonde.journal()).toHaveLength(3);
    expect(sonde.journal().map((r) => r.url.slice(-1))).toEqual(["3", "4", "5"]);
  });

  it("vider rend le journal vide — c'est le geste d'avant lecture", async () => {
    const sonde = creerSonde({ fetch: async () => reponse(), now: () => 0 });
    await sonde.fetch("https://tv.exemple/x");
    sonde.vider();
    expect(sonde.journal()).toHaveLength(0);
  });

  it("une requete en vol est deja journalisee, statut inconnu", async () => {
    // Initialisée plutôt que `| null` : l'analyse de flux de TypeScript ne voit
    // pas l'affectation faite dans l'exécuteur de la promesse et réduirait le
    // type à `never`.
    let liberer: () => void = () => undefined;
    const attente = new Promise<void>((r) => { liberer = r; });
    const sonde = creerSonde({
      fetch: async () => { await attente; return reponse(); },
      now: () => 0,
    });

    const enCours = sonde.fetch("https://tv.exemple/lent");
    // Sans attendre : c'est tout l'interet, on voit ce qui est PARTI.
    expect(sonde.journal()).toHaveLength(1);
    expect(sonde.journal()[0]?.status).toBeNull();

    liberer();
    await enCours;
    expect(sonde.journal()[0]?.status).toBe(200);
  });
});
