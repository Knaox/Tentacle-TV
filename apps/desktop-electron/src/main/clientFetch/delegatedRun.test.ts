import { describe, expect, it } from "vitest";
import { ClientFetchQuota } from "./clientFetchQuota";
import type { HopRequest } from "./clientFetchRunner";
import { runDelegated } from "./delegatedRun";

const manifest = { hosts: ["music.example.com"], mediaHosts: [] };

describe("requête déléguée (bureau) — aucun identifiant du compte vers l'hôte joint", () => {
  it("les en-têtes de la session ne servent qu'à lire le manifeste ; l'hôte joint ne reçoit que ceux de l'extension", async () => {
    const seen: HopRequest[] = [];
    const sessions: unknown[] = [];
    const out = await runDelegated(
      {
        serverOrigin: "https://tentacle.example",
        headers: { Authorization: "Bearer jeton-du-compte", "X-Emby-Token": "jeton-du-compte" },
        pluginId: "sillon",
        request: { method: "POST", url: "https://music.example.com/api", headers: { "Content-Type": "application/json", "User-Agent": "Navigateur" }, body: "{}" },
      },
      {
        manifests: { of: async (session) => (sessions.push(session), manifest) },
        quota: new ClientFetchQuota(),
        hop: async (r) => (seen.push(r), { kind: "response", status: 200, contentType: null, body: "ok" }),
      },
    );
    expect(out.ok).toBe(true);
    expect(sessions).toEqual([{ serverOrigin: "https://tentacle.example", headers: { Authorization: "Bearer jeton-du-compte", "X-Emby-Token": "jeton-du-compte" } }]);
    expect(seen[0]?.headers).toEqual({ "Content-Type": "application/json", "User-Agent": "Navigateur" });
    expect(JSON.stringify(seen[0])).not.toContain("jeton-du-compte");
  });

  it("sans manifeste déclaré par le serveur : refusée, rien ne part", async () => {
    let sent = 0;
    const out = await runDelegated(
      { serverOrigin: "https://tentacle.example", headers: {}, pluginId: "autre", request: { method: "GET", url: "https://music.example.com/" } },
      { manifests: { of: async () => null }, quota: new ClientFetchQuota(), hop: async () => (sent++, { kind: "failed", reason: "network" }) },
    );
    expect(out).toEqual({ ok: false, reason: "refused" });
    expect(sent).toBe(0);
  });
});
