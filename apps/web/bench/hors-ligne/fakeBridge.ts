/**
 * Le PONT FACTICE du banc : ce que la coquille du bureau présenterait à la page (`window.tentacle`),
 * réduit à ce que les écrans du hors ligne lui demandent, et répondant depuis la machine factice du
 * labo (`labStore`). Posé AVANT le chargement de l'application — la détection de la coquille est
 * figée au premier import. Avec lui, un « serveur » : `fetch` vers `/api/…` et vers le disque local.
 */

import { LAB_BRIDGE_MARK, labMachine } from "../../src/dev/horsLigneLab/labStore";

const CAPS = { downloads: true, lightDownloads: true, remuxDownloads: true, audioConversion: true };

type Args = Record<string, unknown> | undefined;

const commands: Record<string, (args: Args) => unknown> = {
  downloads_list: () => labMachine.entries,
  downloads_disk_free: () => labMachine.freeBytes,
  downloads_disk_usage: () => labMachine.usedBytes,
  downloads_get_root: () => "/home/lab/Tentacle",
  downloads_asset_base: () => ({ base: `${window.location.origin}/disk`, token: "lab" }),
  downloads_state_for_item: (args) => {
    const all = labMachine.entries.filter((entry) => entry.itemId === args?.itemId);
    return all.find((entry) => entry.status === "complete") ?? all[0] ?? null;
  },
  downloads_enqueue: (args) => {
    const items = (args?.items as unknown[] | undefined) ?? [];
    return labMachine.refuseEnqueue === null
      ? { accepted: true, neededBytes: 0, freeBytes: labMachine.freeBytes, fileIds: items.map((_, index) => 9500 + index) }
      : { accepted: false, neededBytes: labMachine.refuseEnqueue, freeBytes: labMachine.freeBytes, fileIds: [] };
  },
  session_cache_get: () => ({ expired: false, profileJson: localStorage.getItem("tentacle_user"), policyJson: JSON.stringify(CAPS) }),
  session_cache_set: () => undefined,
  downloads_pause: () => undefined,
  downloads_resume: () => undefined,
  downloads_cancel: () => undefined,
  downloads_delete: () => ({ deleted: true }),
  downloads_set_auto_delete: () => undefined,
  downloads_purge_due: () => 0,
  downloads_engine_start: () => undefined,
};

/** Ce que le « serveur » du banc répond. `offline` : il ne répond plus (le passage hors ligne). */
const server = { offline: new URLSearchParams(window.location.search).get("reseau") === "coupe" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function installServer(): void {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const snapshot = /^\/disk\/meta\/([^/]+)\/(item|series)\.json$/.exec(url.pathname);
    if (snapshot) {
      const found = labMachine.snapshots[snapshot[1] as string]?.[snapshot[2] as "item" | "series"];
      return found ? json(found) : json({}, 404);
    }
    if (!url.pathname.startsWith("/api/")) return real(input, init);
    if (server.offline) throw new TypeError("Failed to fetch");
    if (url.pathname === "/api/health") return json({ status: "ok" });
    if (url.pathname === "/api/downloads/capabilities") return json(CAPS);
    if (url.pathname === "/api/config") return json({});
    if (url.pathname.endsWith("/System/Info/Public")) return json({ Id: "lab" });
    return json({}, 404);
  };
}

export function installFakeBridge(): void {
  localStorage.setItem("tentacle_user", JSON.stringify({ Id: "lab-user", Name: "Knaoxtest" }));
  localStorage.setItem("tentacle_token", "lab");
  // Le serveur a déjà dit que ce compte peut garder des titres (le dernier mot fait foi).
  localStorage.setItem("tentacle_offline_keep_right", JSON.stringify({ "labuser": true }));
  installServer();
  (window as unknown as { tentacle: unknown }).tentacle = {
    [LAB_BRIDGE_MARK]: true,
    version: "lab",
    platform: "linux",
    capabilities: Object.keys(commands),
    invoke: async (command: string, args?: Record<string, unknown>) => {
      const handler = commands[command];
      if (!handler) throw new Error(`commande inconnue du pont factice : ${command}`);
      return handler(args);
    },
    on: () => () => undefined,
    relaunch: async () => undefined,
    openExternal: async () => undefined,
    pickFolder: async () => null,
  };
}
