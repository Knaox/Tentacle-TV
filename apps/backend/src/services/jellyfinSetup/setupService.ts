import { getDirectStreamingConfig, getJellyfinUrl } from "../configStore";
import { resolveCompat } from "../jellyfinCompat/compatVerdict";
import { getCompatManifestState } from "../jellyfinCompat/manifestStore";
import type { JellyfinSetupReport } from "../jellyfinCompat/setupContract";
import { getSeerrConfig } from "../seerConfig";
import { BACKEND_VERSION } from "../version";
import { evaluateSetup, type SetupContext } from "./setupChecks";
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

/** La zone du manifeste qui parle des bonus et bandes-annonces (cf. `compat/README.md`). */
const EXTRAS_AREA = "extras";

/**
 * Hors de Jellyfin : Jellyseerr branché par Vigie (la source des vidéos de
 * `/api/tmdb/trailers`), et ce que la compatibilité de la version installée
 * dit des bonus et bandes-annonces.
 */
export function setupContext(version: string): SetupContext {
  const compat = resolveCompat(getCompatManifestState().manifest, version, BACKEND_VERSION);
  return {
    jellyseerr: getSeerrConfig() !== null,
    compatGaps: compat.gaps
      .filter((gap) => gap.area === EXTRAS_AREA)
      .map((gap) => ({ label: gap.label, note: gap.note })),
  };
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
    checks: evaluateSetup(read.snapshot, setupContext(read.snapshot.version)),
  };
}
