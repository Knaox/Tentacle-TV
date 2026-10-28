/**
 * Octave (mobile) — le flux DIRECT d'un titre que le téléphone a résolu lui-même (requêtes déléguées) : l'URL
 * de YouTube ne vaut que depuis la connexion qui l'a obtenue, le serveur ne peut pas la relayer. Le natif la lit
 * donc en direct, SANS les en-têtes du serveur (`open: "direct"`), et garde le flux du serveur en repli
 * (`fallbackUrl`, marqué `direct=failed` : l'extension y oublie la source du téléphone) — la même règle que la
 * coquille du bureau (`directSources.ts`, `directRelay.ts`), sans relais local : mpv et Media3 n'envoient les
 * en-têtes qu'au serveur (`AudioDeck.swift`, `SourcePolicy.kt`).
 *
 * Adopté seulement si : le module natif sait le faire (`directStreams`), l'hôte du flux est dans les
 * `mediaHosts` que l'extension DÉCLARE, en https, et l'URL vit encore 30 s au moins. Sinon `direct` est retiré :
 * le serveur joue, comme avant.
 */

import { allowedUrl } from "@tentacle-tv/shared/pluginClientFetch";

const SOURCE_COMMANDS = new Set(["audio_play", "audio_set_next", "audio_swap_source"]);
const MIN_LIFE_MS = 30_000;

export interface DirectSourceDeps {
  /** Le module natif lit-il un flux direct ? (constante `directStreams` du module) */
  supported: () => boolean;
  /** Les `mediaHosts` déclarés par cette extension (cache des manifestes). */
  mediaHosts: (pluginId: string) => Promise<readonly string[]>;
  now?: () => number;
}

interface DirectCapable extends Record<string, unknown> {
  url: string;
  origin?: string;
  direct?: { url: string; expiresAt: number | null };
}

/** `ext:<extension>:<identifiant>` → l'extension ; `null` pour la bibliothèque. */
export function pluginOfTrack(trackKey: string): string | null {
  return /^ext:([a-zA-Z0-9._-]{1,64}):/.exec(trackKey)?.[1] ?? null;
}

/** Le signal d'échec du flux direct (contrat `PlaybackSource.direct`) sur l'adresse du serveur. */
export function withDirectFailed(url: string): string {
  const u = new URL(url);
  u.searchParams.set("direct", "failed");
  return u.href;
}

function trackKeyOf(command: string, args: Record<string, unknown>): string | null {
  if (command === "audio_swap_source") return typeof args.trackKey === "string" ? args.trackKey : null;
  const track = args.track as { trackKey?: unknown } | null | undefined;
  return typeof track?.trackKey === "string" ? track.trackKey : null;
}

/** Les arguments, la source passée en flux direct quand il est adopté ; `direct` retiré dans tous les cas. */
export async function withDirectSource(command: string, args: Record<string, unknown>, deps: DirectSourceDeps): Promise<Record<string, unknown>> {
  if (!SOURCE_COMMANDS.has(command)) return args;
  const source = args.source as DirectCapable | null | undefined;
  if (!source?.direct) return args;
  const { direct, ...rest } = source;
  const key = trackKeyOf(command, args);
  const pluginId = key ? pluginOfTrack(key) : null;
  const now = (deps.now ?? Date.now)();
  const fresh = direct.expiresAt === null || direct.expiresAt > now + MIN_LIFE_MS;
  if (!deps.supported() || rest.origin !== "plugin" || pluginId === null || !fresh || !/^https?:\/\//i.test(rest.url)) {
    return { ...args, source: rest };
  }
  const hosts = await deps.mediaHosts(pluginId).catch(() => [] as readonly string[]);
  if (!allowedUrl(direct.url, hosts)) return { ...args, source: rest };
  return { ...args, source: { ...rest, url: direct.url, open: "direct", fallbackUrl: withDirectFailed(rest.url) } };
}
