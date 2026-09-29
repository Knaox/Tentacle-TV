import { getJellyfinUrl } from "../configStore";
import type { SetupLibrary, TrailerReadiness, TrailerReadinessReason } from "../jellyfinCompat/setupContract";
import { evaluateSetup, isVideoLibrary, tmdbPluginActive } from "./setupChecks";
import { isRefreshing } from "./setupService";
import { readSetupSnapshot, type SetupSnapshot } from "./setupSnapshot";

/**
 * Le diagnostic des bandes-annonces, résumé pour les clients : prêt, mal réglé
 * (et pourquoi), ou inconnu — ni nom de bibliothèque, ni adresse, ni compte.
 * Les mêmes mesures que la vue d'ensemble (greffon TMDb, fournisseurs des
 * bibliothèques, titres comptés), mais un seuil plus FRANC : une fiche ne dit
 * « le serveur est mal réglé » que quand c'est net — moins d'un titre sur
 * cinq connus de TMDB avec une bande-annonce, sur vingt titres au moins.
 * L'administration, elle, s'en inquiète dès la moitié (`trailersCheck.ts`).
 *
 * Jellyseerr et la version de Jellyfin restent dans le détail de
 * l'administration : à eux seuls, ils n'expliquent pas une absence.
 *
 * Gardé dix minutes par serveur, un seul calcul en vol : une fiche qui le
 * demande à chaque ouverture ne relance pas la lecture de Jellyfin.
 */

export const READINESS_LOW_COVERAGE = 0.2;
export const READINESS_MIN_TITLES = 20;
const TTL_MS = 10 * 60_000;

let cached: { key: string; value: TrailerReadiness; at: number } | null = null;
let inFlight: Promise<TrailerReadiness> | null = null;

/** Les bibliothèques vidéo qui ont écarté TheMovieDb de leurs fournisseurs. */
function fetcherDisabled(libraries: SetupLibrary[]): boolean {
  return libraries.some((library) => !library.enabled);
}

/** La règle, en logique pure : du relevé de Jellyfin au résumé. */
export function summarizeReadiness(snapshot: SetupSnapshot, tmdbLibraries: SetupLibrary[] | null, checkedAt: string): TrailerReadiness {
  const unknown: TrailerReadiness = { state: "unknown", reasons: [], coverage: null, checkedAt };
  const videos = snapshot.libraries?.filter(isVideoLibrary) ?? null;
  const counts = snapshot.trailers;
  if (!videos || videos.length === 0 || !counts || counts.titles === 0 || !tmdbLibraries) return unknown;
  const pluginActive = tmdbPluginActive(snapshot.plugins);
  if (pluginActive === null) return unknown;

  const coverage = counts.withTmdb > 0 ? counts.withTrailer / counts.withTmdb : 0;
  const reasons: TrailerReadinessReason[] = [];
  if (!pluginActive) reasons.push("tmdb-plugin-disabled");
  if (fetcherDisabled(tmdbLibraries)) reasons.push("tmdb-fetcher-disabled");
  if (counts.titles >= READINESS_MIN_TITLES && coverage < READINESS_LOW_COVERAGE) reasons.push("few-trailers");
  return { state: reasons.length > 0 ? "misconfigured" : "ready", reasons, coverage, checkedAt };
}

/** Le résumé, et s'il peut être gardé : pas pendant qu'une bibliothèque s'actualise. */
async function compute(): Promise<{ value: TrailerReadiness; keep: boolean }> {
  const checkedAt = new Date().toISOString();
  const read = await readSetupSnapshot();
  if (!read.ok) return { value: { state: "unknown", reasons: [], coverage: null, checkedAt }, keep: true };
  // Les fournisseurs par bibliothèque, lus par la même règle que la vue d'ensemble.
  const tmdb = evaluateSetup(read.snapshot).find((check) => check.id === "metadataTmdb");
  return { value: summarizeReadiness(read.snapshot, tmdb?.libraries ?? null, checkedAt), keep: !isRefreshing(read.snapshot) };
}

export async function readTrailerReadiness(): Promise<TrailerReadiness> {
  const key = getJellyfinUrl() ?? "";
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.value;
  inFlight ??= compute()
    .then(({ value, keep }) => {
      cached = keep ? { key, value, at: Date.now() } : null;
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Un réglage appliqué depuis l'administration : la prochaine lecture refait le diagnostic. */
export function forgetTrailerReadiness(): void {
  cached = null;
}
