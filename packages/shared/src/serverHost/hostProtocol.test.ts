import { describe, expect, it } from "vitest";
import { SERVER_EXIT_CODES, SHUTDOWN_TIMINGS, parseHostMessage, parseServerMessage } from "./hostProtocol";

describe("protocole hôte ↔ serveur", () => {
  it("un message inconnu ou mal formé est ignoré, jamais une erreur", () => {
    expect(parseHostMessage(null)).toBeNull();
    expect(parseHostMessage("tentacle:shutdown")).toBeNull();
    expect(parseHostMessage({ type: "tentacle:future" })).toBeNull();
    expect(parseServerMessage({ type: "tentacle:ready", port: "3000", bootId: "x" })).toBeNull();
  });

  it("un arrêt à la raison inconnue reste un arrêt", () => {
    expect(parseHostMessage({ type: "tentacle:shutdown", reason: "later" })).toEqual({ type: "tentacle:shutdown", reason: "quit" });
    expect(parseHostMessage({ type: "tentacle:shutdown", reason: "session-end" })).toEqual({ type: "tentacle:shutdown", reason: "session-end" });
  });

  it("le bonjour de l'hôte ne garde que des noms de méthodes", () => {
    expect(parseHostMessage({ type: "tentacle:host-hello", protocol: 1, hostVersion: "1.0.0", methods: ["pickFolder", 3] }))
      .toEqual({ type: "tentacle:host-hello", protocol: 1, hostVersion: "1.0.0", methods: ["pickFolder"] });
  });

  it("question et réponse se lisent dans les deux sens", () => {
    expect(parseHostMessage({ type: "tentacle:request", id: "1", method: "status" })).toEqual({ type: "tentacle:request", id: "1", method: "status" });
    expect(parseServerMessage({ type: "tentacle:request", id: "", method: "pickFolder" })).toBeNull();
    expect(parseServerMessage({ type: "tentacle:response", id: "2", ok: false, error: "boom" }))
      .toEqual({ type: "tentacle:response", id: "2", ok: false, error: "failed" });
    expect(parseHostMessage({ type: "tentacle:response", id: "3", ok: true, result: { path: "D:\Films" } }))
      .toEqual({ type: "tentacle:response", id: "3", ok: true, result: { path: "D:\Films" } });
  });

  it("un échec de démarrage hors liste devient « unexpected »", () => {
    expect(parseServerMessage({ type: "tentacle:startup-failed", reason: "disk" })).toEqual({ type: "tentacle:startup-failed", reason: "unexpected" });
    expect(parseServerMessage({ type: "tentacle:startup-failed", reason: "port_in_use", detail: "3000" }))
      .toEqual({ type: "tentacle:startup-failed", reason: "port_in_use", detail: "3000" });
  });

  it("les codes de sortie et l'arrêt borné tiennent dans la grâce de l'hôte", () => {
    expect(SERVER_EXIT_CODES).toEqual({ STOPPED: 0, FAILED: 1, RESTART: 75 });
    expect(SHUTDOWN_TIMINGS.httpCloseMs + SHUTDOWN_TIMINGS.databaseCloseMs).toBeLessThan(SHUTDOWN_TIMINGS.hostGraceMs);
  });
});
