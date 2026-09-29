import { getDirectStreamingConfig, getJellyfinUrl } from "../configStore";
import type { JellyfinSetupReport } from "../jellyfinCompat/setupContract";
import { evaluateSetup } from "./setupChecks";
import { readSetupSnapshot } from "./setupSnapshot";

/**
 * Les réglages recommandés de Jellyfin, tels que les lit l'administration : un
 * instantané du serveur connecté, jugé réglage par réglage. Relu à chaque
 * demande — c'est l'état d'aujourd'hui qu'on vient y chercher, et un geste en
 * un clic doit se voir aussitôt.
 */

/**
 * La racine du tableau de bord pour le NAVIGATEUR de l'administrateur :
 * l'adresse publique de Jellyfin si elle est posée (celle de la lecture
 * directe) — l'adresse que joint le serveur Tentacle peut n'exister que dans
 * son réseau Docker.
 */
export function dashboardUrl(): string | null {
  const raw = getDirectStreamingConfig().publicUrl || getJellyfinUrl() || "";
  return raw.trim().replace(/\/+$/, "") || null;
}

export async function buildSetupReport(): Promise<JellyfinSetupReport> {
  const read = await readSetupSnapshot();
  const checkedAt = new Date().toISOString();
  if (!read.ok) {
    return { checkedAt, jellyfinVersion: null, dashboardUrl: dashboardUrl(), restartPending: false, error: read.failure, checks: [] };
  }
  return {
    checkedAt,
    jellyfinVersion: read.snapshot.version,
    dashboardUrl: dashboardUrl(),
    restartPending: read.snapshot.restartPending,
    error: null,
    checks: evaluateSetup(read.snapshot),
  };
}
