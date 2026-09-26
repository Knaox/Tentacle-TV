import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readAdminKeyHealth } from "./adminKeyHealth";

/**
 * Le contrat de `GET /api/admin/jellyfin-key`, tenu des deux côtés : le
 * lecteur du web lit les champs que le serveur DÉCLARE. Un renommage d'un
 * seul côté éteignait le bandeau d'alerte sans qu'aucun test ne bronche.
 */

const SERVER = fileURLToPath(new URL("../../../backend/src/services/jellyfinKeyHealth.ts", import.meta.url));

describe("la santé de la clé admin Jellyfin", () => {
  it("lit les champs que le serveur envoie vraiment", () => {
    expect(readAdminKeyHealth({ etat: "revoquee", verifieA: "2026-09-26T22:02:30.496Z" }))
      .toEqual({ state: "revoquee", checkedAt: "2026-09-26T22:02:30.496Z" });
  });

  it("ce sont bien ceux que déclare le serveur", () => {
    const declaration = readFileSync(SERVER, "utf8").match(/export interface AdminKeyHealth \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(declaration).toMatch(/\betat: AdminKeyState;/);
    expect(declaration).toMatch(/\bverifieA: string;/);
    expect(readFileSync(SERVER, "utf8")).toContain('"ok" | "revoquee" | "sansDroits" | "absente" | "injoignable"');
  });

  it("une réponse illisible ne déclenche rien", () => {
    expect(readAdminKeyHealth({ state: "revoquee" }).state).toBeNull();
    expect(readAdminKeyHealth(null)).toEqual({ state: null, checkedAt: "" });
  });
});
