/**
 * La surcouche de mise à jour de la coquille CEF (`apps/desktop-cef/web/shim/update-overlay.js`),
 * chargée TELLE QUELLE dans le banc avec une fausse coquille (`window.__shell`) : le natif
 * l'injecte dans la page de la même façon, sa feuille glissée dans le jeton `__UPDATE_CSS__`.
 * `?cef=<état>` choisit l'instantané ; « Redémarrer » y lance une installation factice.
 */

import overlayCss from "../../../desktop-cef/web/shim/update-overlay.css?raw";
import overlaySource from "../../../desktop-cef/web/shim/update-overlay.js?raw";

type Snapshot = Record<string, unknown>;

const UPDATE = {
  version: "1.43.0", severity: "major", mandatory: false, install: true,
  notes: { fr: "• Le lecteur en deux capsules\n• « Garder pour toute la série »\n• Regarder ensemble, plus lisible", en: "• The player in two capsules" },
  notesUrl: "https://tentacle.tv/nouveautes",
};
const BASE = { enabled: true, current: "1.42.0", canMute: true, error: "", rolledBack: "", update: UPDATE };

const SNAPSHOTS: Record<string, Snapshot> = {
  telechargement: { ...BASE, prompt: "toast", phase: "downloading", progress: 0.42 },
  prete: { ...BASE, prompt: "toast", phase: "ready", progress: 1 },
  installation: { ...BASE, prompt: "toast", phase: "applying", progress: 1 },
  securite: {
    ...BASE, prompt: "blocking", phase: "downloading", progress: 0.42, canMute: false,
    update: { ...UPDATE, mandatory: true, why: { fr: "Cette version a une faille de sécurité, corrigée dans la 1.43.0. Il faut l'installer pour continuer.", en: "Security fix." } },
  },
  "securite-prete": { ...BASE, prompt: "blocking", phase: "ready", progress: 1, canMute: false, update: { ...UPDATE, mandatory: true } },
  retour: { ...BASE, prompt: "none", phase: "idle", rolledBack: "1.43.0" },
};

export function installCefOverlay(state: string): void {
  let snapshot = SNAPSHOTS[state] ?? SNAPSHOTS.prete;
  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  const emit = (channel: string, payload: unknown) => handlers.get(channel)?.forEach((handler) => handler(payload));
  (window as unknown as Record<string, unknown>).__shell = {
    on: (channel: string, handler: (payload: unknown) => void) => {
      handlers.set(channel, [...(handlers.get(channel) ?? []), handler]);
    },
    invoke: async (channel: string) => {
      if (channel === "update.state") return snapshot;
      if (channel === "update.restart") {
        snapshot = { ...snapshot, phase: "applying" };
        emit("update.state", snapshot);
      }
      return {};
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- le natif injecte ce script de la même façon
  new Function(overlaySource.replace("__UPDATE_CSS__", overlayCss)).call(window);
}
