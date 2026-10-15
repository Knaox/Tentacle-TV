import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { onContentPolicyInvalidated } from "../contentPolicy";

/**
 * Les champs de LECTURE de la politique Jellyfin d'un compte
 * (docs/DROITS-UTILISATEURS.md § 9.2), relus par la clé d'administration
 * (`GET /Users/{id}`), gardés 30 s, oubliés à chaque écriture de politique
 * faite par Tentacle (`onContentPolicyInvalidated`).
 *
 * Une politique ILLISIBLE (Jellyfin muet, compte inconnu) rend `null` : le
 * serveur Tentacle ne refuse alors rien de lui-même et Jellyfin décide, comme
 * avant — le titre, lui, reste gardé par sa visibilité (fermée à l'échec).
 */

export interface AccountPlaybackPolicy {
  enableMediaPlayback: boolean;
  enableVideoPlaybackTranscoding: boolean;
  enableAudioPlaybackTranscoding: boolean;
  enablePlaybackRemuxing: boolean;
  /** Bits/s ; 0 : celui du serveur s'applique (`RemoteClientBitrateLimit` de Jellyfin). */
  remoteClientBitrateLimit: number;
}

const TTL_MS = 30_000;
const UNREADABLE_TTL_MS = 5_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { policy: AccountPlaybackPolicy | null; expiresAt: number }>();
const inflight = new Map<string, Promise<AccountPlaybackPolicy | null>>();

const keyOf = (userId: string) => userId.replace(/-/g, "").toLowerCase();

/** Règle pure : la politique Jellyfin → ses champs de lecture (un champ absent : les défauts de Jellyfin). */
export function playbackPolicyFromJellyfin(policy: Record<string, unknown>): AccountPlaybackPolicy {
  const flag = (value: unknown) => value !== false;
  const limit = policy.RemoteClientBitrateLimit;
  return {
    enableMediaPlayback: flag(policy.EnableMediaPlayback),
    enableVideoPlaybackTranscoding: flag(policy.EnableVideoPlaybackTranscoding),
    enableAudioPlaybackTranscoding: flag(policy.EnableAudioPlaybackTranscoding),
    enablePlaybackRemuxing: flag(policy.EnablePlaybackRemuxing),
    remoteClientBitrateLimit: typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0,
  };
}

async function readPolicy(userId: string): Promise<AccountPlaybackPolicy | null> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) return null;
  const result = await jellyfinAdminFetch<{ Policy?: Record<string, unknown> }>(`/Users/${encodeURIComponent(userId)}`);
  if (!result.ok || !result.data?.Policy || typeof result.data.Policy !== "object") return null;
  return playbackPolicyFromJellyfin(result.data.Policy);
}

/** La politique de lecture d'un compte, ou `null` si elle est illisible — jamais une exception. */
export async function getAccountPlaybackPolicy(userId: string): Promise<AccountPlaybackPolicy | null> {
  const key = keyOf(userId);
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.policy;
  const running = inflight.get(key);
  if (running) return running;
  const pending = readPolicy(userId).catch(() => null);
  inflight.set(key, pending);
  const policy = await pending;
  if (inflight.get(key) === pending) {
    inflight.delete(key);
    cache.set(key, { policy, expiresAt: Date.now() + (policy ? TTL_MS : UNREADABLE_TTL_MS) });
    if (cache.size > MAX_ENTRIES) {
      const now = Date.now();
      for (const [entry, value] of cache) if (now >= value.expiresAt) cache.delete(entry);
    }
  }
  return policy;
}

/** Oublie un compte (`null` : tous) — une écriture de politique vient d'avoir lieu. */
export function forgetAccountPlaybackPolicy(userId: string | null): void {
  if (userId === null) {
    cache.clear();
    inflight.clear();
    return;
  }
  cache.delete(keyOf(userId));
  inflight.delete(keyOf(userId));
}

let watching = false;

/** Branché une fois au démarrage : une écriture de politique faite par Tentacle se voit aussitôt. */
export function watchPlaybackPolicyWrites(): void {
  if (watching) return;
  watching = true;
  onContentPolicyInvalidated(forgetAccountPlaybackPolicy);
}
