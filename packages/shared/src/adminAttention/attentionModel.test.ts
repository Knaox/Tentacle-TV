import { describe, expect, it } from "vitest";
import { DISMISSIBLE_HINTS } from "../help/dismissibleHints";
import type { LinkCheck } from "../serverLinks/serverLinksVerdict";
import { RECOMMENDATION_HINTS, buildAdminAttention, type AttentionSources } from "./attentionModel";

const done = (id: LinkCheck["id"]): LinkCheck => ({ id, state: "done", endpoints: [], notes: [] });

/** Un serveur où tout va bien, toutes sources lues, rien de masqué. */
const healthy: AttentionSources = {
  jellyfin: { state: "connected" },
  adminKey: "ok",
  databaseDown: false,
  tmdbConfigured: true,
  links: [done("publicUrl"), done("directPlay")],
  jellyfinSetup: { restartPending: false, checks: [{ id: "trickplay", level: "recommended", state: "done" }] },
  jellyfinVersion: "compatible",
  serverUpdate: "up-to-date",
  dismissed: { publicUrl: false, tmdbKey: false, jellyfin: false, directPlay: false },
};

const httpOnly: LinkCheck = {
  id: "publicUrl",
  state: "attention",
  endpoints: [{ role: "tentacle", url: "http://tv.example.com", probe: null, tone: "warning", issues: ["not-https"] }],
  notes: [],
};

describe("ce qui demande l'attention de l'administrateur", () => {
  it("rien : tout fonctionne, et on peut le dire", () => {
    expect(buildAdminAttention(healthy)).toEqual({ settled: true, blocking: [], recommendations: [], hidden: [] });
  });

  it("tant qu'une source n'a pas répondu, l'état ne se dit pas", () => {
    expect(buildAdminAttention({ ...healthy, links: undefined }).settled).toBe(false);
    expect(buildAdminAttention({ ...healthy, links: null }).settled).toBe(true);
  });

  it("chaque recommandation se masque par un rappel de la liste fermée", () => {
    for (const hint of Object.values(RECOMMENDATION_HINTS)) expect(DISMISSIBLE_HINTS).toContain(hint);
    expect(new Set(Object.values(RECOMMENDATION_HINTS)).size).toBe(4);
  });

  it("HTTP seulement : une recommandation, avec son souci", () => {
    const attention = buildAdminAttention({ ...healthy, links: [httpOnly, done("directPlay")] });
    expect(attention.recommendations).toEqual([
      { id: "publicUrl", hint: "adminPublicUrl", variant: "not-https", items: ["tentacle:not-https"] },
    ]);
  });

  it("masquée : elle quitte la liste et passe sous « masquées »", () => {
    const attention = buildAdminAttention({ ...healthy, links: [httpOnly, done("directPlay")], dismissed: { ...healthy.dismissed, publicUrl: true } });
    expect(attention.recommendations).toEqual([]);
    expect(attention.hidden.map((entry) => entry.id)).toEqual(["publicUrl"]);
  });

  it("l'état du masquage pas encore lu : la recommandation attend, sans clignoter", () => {
    const attention = buildAdminAttention({ ...healthy, tmdbConfigured: false, dismissed: {} });
    expect(attention).toMatchObject({ settled: false, recommendations: [], hidden: [] });
  });

  it("clé d'administration absente : UNE entrée à régler, et ce qui dépend de Jellyfin se tait", () => {
    const attention = buildAdminAttention({
      ...healthy,
      jellyfin: { state: "not-configured", missing: ["key"] },
      adminKey: "missing",
      jellyfinSetup: { restartPending: true, checks: [{ id: "trickplay", level: "recommended", state: "todo" }] },
      links: [done("publicUrl"), { id: "directPlay", state: "todo", endpoints: [], notes: ["direct-disabled"] }],
      tmdbConfigured: false,
    });
    expect(attention.blocking).toEqual([{ id: "jellyfinNotConfigured", variant: "key" }]);
    // La clé TMDB ne dépend pas de Jellyfin : elle reste ; les réglages et la lecture directe attendent.
    expect(attention.recommendations.map((entry) => entry.id)).toEqual(["tmdbKey"]);
  });

  it("clé refusée, Jellyfin injoignable, adresse et clé absentes : la cause précise", () => {
    expect(buildAdminAttention({ ...healthy, adminKey: "no-rights" }).blocking).toEqual([{ id: "jellyfinKeyRejected", variant: "no-rights" }]);
    expect(buildAdminAttention({ ...healthy, jellyfin: { state: "rejected", reason: "revoked" } }).blocking)
      .toEqual([{ id: "jellyfinKeyRejected", variant: "revoked" }]);
    expect(buildAdminAttention({ ...healthy, jellyfin: { state: "unreachable" } }).blocking).toEqual([{ id: "jellyfinUnreachable", variant: null }]);
    expect(buildAdminAttention({ ...healthy, jellyfin: { state: "not-configured", missing: ["url", "key"] } }).blocking)
      .toEqual([{ id: "jellyfinNotConfigured", variant: "both" }]);
  });

  it("les réglages de Jellyfin : UNE entrée groupée, l'essentiel en tête de ses variantes", () => {
    const attention = buildAdminAttention({
      ...healthy,
      jellyfinVersion: "partial",
      jellyfinSetup: {
        restartPending: true,
        checks: [
          { id: "metadataTmdb", level: "essential", state: "todo" },
          { id: "trickplay", level: "recommended", state: "todo" },
          { id: "hardwareAcceleration", level: "optional", state: "todo" },
          { id: "realtimeMonitor", level: "recommended", state: "done" },
        ],
      },
    });
    expect(attention.recommendations).toEqual([
      { id: "jellyfin", hint: "adminJellyfin", variant: "essential", items: ["setup:metadataTmdb", "setup:trickplay", "restart", "partial"] },
    ]);
  });

  it("un réglage en attente de redémarrage se dit, même sans redémarrage signalé par Jellyfin", () => {
    const attention = buildAdminAttention({
      ...healthy,
      jellyfinSetup: { restartPending: false, checks: [{ id: "segmentsProvider", level: "recommended", state: "pending-restart" }] },
    });
    expect(attention.recommendations).toEqual([{ id: "jellyfin", hint: "adminJellyfin", variant: null, items: ["restart"] }]);
  });

  it("six entrées à la fois : à régler d'abord, puis les recommandations dans leur ordre", () => {
    const attention = buildAdminAttention({
      ...healthy,
      databaseDown: true,
      jellyfinVersion: "incompatible",
      serverUpdate: "mandatory",
      tmdbConfigured: false,
      links: [httpOnly, { id: "directPlay", state: "todo", endpoints: [], notes: ["direct-disabled"] }],
    });
    expect(attention.blocking.map((entry) => entry.id)).toEqual(["databaseDown", "jellyfinIncompatible", "serverUpdateRequired"]);
    expect(attention.recommendations.map((entry) => `${entry.id}:${String(entry.variant)}`)).toEqual([
      "publicUrl:not-https", "tmdbKey:null", "directPlay:off",
    ]);
  });

  it("lecture directe bloquée par le navigateur : le souci le plus grave donne le titre", () => {
    const attention = buildAdminAttention({
      ...healthy,
      links: [done("publicUrl"), {
        id: "directPlay",
        state: "attention",
        endpoints: [
          { role: "jellyfinPublic", url: "http://jf.example.com", probe: null, tone: "warning", issues: ["cors-missing", "mixed-content"] },
          { role: "jellyfinPrivate", url: "http://192.168.1.2:8096", probe: null, tone: "neutral", issues: [] },
        ],
        notes: [],
      }],
    });
    expect(attention.recommendations[0]).toMatchObject({ id: "directPlay", variant: "mixed-content" });
  });
});
