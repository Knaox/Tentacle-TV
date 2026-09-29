import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { BACKEND_VERSION } from "../version";
import { compareJellyfinVersions, isValidJellyfinVersion } from "./compatManifest";
import type { CompatVersionView, InstalledFailure, InstalledJellyfin, JellyfinCompatReport, LatestJellyfin } from "./compatReport";
import { resolveCompat, type CompatResolution } from "./compatVerdict";
import { getLatestJellyfin, refreshLatestJellyfin } from "./jellyfinReleases";
import { getCompatManifestState, refreshCompatManifest } from "./manifestStore";
import { probeFeature, readEndpointIndex } from "./openApiProbe";

/**
 * Le rapport de compatibilité que lit l'administration : la version de
 * Jellyfin installée et la dernière publiée, jugées par le manifeste, et ce
 * que le serveur connecté publie vraiment.
 *
 * Les relectures distantes (manifeste, GitHub) partent à chaque demande si
 * elles ont vieilli, mais on ne les attend que quelques secondes : au-delà,
 * on répond avec ce qu'on sait, et la relecture continue en arrière-plan.
 * « Revérifier » (`force`) les attend jusqu'au bout.
 */

const STALE_WAIT_MS = 4000;

function toView(resolution: CompatResolution, index: ReadonlySet<string> | null): CompatVersionView {
  const { version, status, reason, basis, line, minTentacle, tentacleTooOld } = resolution;
  return {
    version,
    status,
    reason,
    basis,
    line,
    minTentacle,
    tentacleTooOld,
    features: resolution.features.map((feature) => ({ ...feature, probe: index ? probeFeature(feature.endpoints, index) : null })),
  };
}

type InstalledRead = { version: string; serverName: string | null } | { failure: InstalledFailure };

async function readInstalled(): Promise<InstalledRead> {
  const res = await jellyfinAdminFetch<{ Version?: unknown; ServerName?: unknown }>("/System/Info");
  if (!res.ok) return { failure: res.failure };
  const version = res.data?.Version;
  if (!isValidJellyfinVersion(version)) return { failure: "invalid" };
  const name = res.data.ServerName;
  return { version, serverName: typeof name === "string" && name.trim() !== "" ? name : null };
}

/** Attend `work`, mais pas plus de `ms` : ce qui n'est pas arrivé attendra la prochaine lecture. */
async function waitAtMost(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([work, new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  clearTimeout(timer);
}

export async function buildCompatReport(force = false): Promise<JellyfinCompatReport> {
  const refreshes = Promise.all([refreshCompatManifest(force), refreshLatestJellyfin(force)]);
  const [read] = await Promise.all([readInstalled(), force ? refreshes : waitAtMost(refreshes, STALE_WAIT_MS)]);

  const manifestState = getCompatManifestState();
  const manifest = manifestState.manifest;

  let installed: InstalledJellyfin | null = null;
  if (!("failure" in read)) {
    const index = await readEndpointIndex(read.version);
    installed = {
      ...toView(resolveCompat(manifest, read.version, BACKEND_VERSION), index),
      serverName: read.serverName,
      probes: index ? "ok" : "unavailable",
    };
  }

  const latestState = getLatestJellyfin();
  const release = latestState.release;
  const latest: LatestJellyfin | null = release
    ? {
        // Une version qu'on ne fait pas tourner ne se sonde pas.
        ...toView(resolveCompat(manifest, release.version, BACKEND_VERSION), null),
        tag: release.tag,
        publishedAt: release.publishedAt,
        url: release.url,
        newer: installed !== null && compareJellyfinVersions(release.version, installed.version) > 0,
        checkedAt: latestState.checkedAt,
      }
    : null;

  return {
    checkedAt: new Date().toISOString(),
    tentacleServer: BACKEND_VERSION,
    manifest: manifest && manifestState.source
      ? {
          revision: manifest.revision,
          generatedAt: manifest.generatedAt,
          source: manifestState.source,
          remoteCheckedAt: manifestState.remoteCheckedAt,
          remoteError: manifestState.remoteError,
          testedVersions: manifest.versions.map((entry) => entry.version),
        }
      : null,
    installed,
    installedError: "failure" in read ? read.failure : null,
    latest,
    latestError: release ? null : latestState.error,
  };
}
