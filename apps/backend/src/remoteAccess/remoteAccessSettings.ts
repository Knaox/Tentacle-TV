import { z } from "zod";
import { deleteConfigValue, getConfigValue, getDirectStreamingConfig, getPublicUrl, setConfigValue } from "../services/configStore";
import type { RemoteAccessSettings, RemoteAccessSettingsPatch, RemoteCheckReport, ReverseProxyKind } from "./remoteAccessContract";

/**
 * Les réglages de l'accès à distance, dans `server_config` (clés
 * `remote_access_*`), et le dernier rapport du test — pour que la section le
 * montre encore au retour, sans relancer de test.
 */
const KEYS = {
  proxy: "remote_access_proxy",
  localUrl: "remote_access_local_url",
  routerId: "remote_access_router",
  lastCheck: "remote_access_last_check",
} as const;

const PROXIES: readonly ReverseProxyKind[] = ["caddy", "traefik", "other", "none"];

/**
 * `enabled` n'est plus un réglage : il CONSTATE qu'une adresse publique est
 * réglée (`exposure.ts` publie ce qui l'est). Gardé pour les pages
 * d'administration qui le lisaient encore ; l'ancienne clé
 * `remote_access_enabled` n'est plus lue.
 */
export function readRemoteAccessSettings(): RemoteAccessSettings {
  const proxy = getConfigValue(KEYS.proxy) as ReverseProxyKind | undefined;
  const direct = getDirectStreamingConfig();
  return {
    enabled: getPublicUrl() !== null || (direct.enabled && !!direct.publicUrl),
    proxy: proxy && PROXIES.includes(proxy) ? proxy : "none",
    localUrl: getConfigValue(KEYS.localUrl) || null,
    routerId: getConfigValue(KEYS.routerId) || null,
  };
}

async function writeOptional(key: string, value: string | null): Promise<void> {
  if (value === null || value === "") await deleteConfigValue(key);
  else await setConfigValue(key, value);
}

/** `enabled` est accepté (pages d'avant) mais ignoré : ce qui est réglé est publié. */
export async function saveRemoteAccessSettings(patch: RemoteAccessSettingsPatch): Promise<RemoteAccessSettings> {
  if (patch.proxy !== undefined) await setConfigValue(KEYS.proxy, patch.proxy);
  if (patch.localUrl !== undefined) await writeOptional(KEYS.localUrl, patch.localUrl);
  if (patch.routerId !== undefined) await writeOptional(KEYS.routerId, patch.routerId);
  return readRemoteAccessSettings();
}

const verdicts = [
  "open", "redirect", "wrong_service", "http_error", "timeout", "refused", "unreachable", "tls_self_signed",
  "tls_expired", "tls_name_mismatch", "tls_untrusted", "tls_error", "dns_mismatch", "dns_error", "not_testable",
] as const;

/** Le rapport tel qu'enregistré — relu sans confiance : un rapport illisible vaut « pas de test ». */
const reportSchema = z.object({
  checkedAt: z.string().max(40),
  outcome: z.enum(["done", "service_unavailable", "service_disabled", "rate_limited", "nothing_to_check"]),
  publicIp: z.object({ v4: z.string().max(64).nullable(), v6: z.string().max(64).nullable() }),
  items: z
    .array(
      z.object({
        service: z.enum(["tentacle", "jellyfin"]),
        scheme: z.enum(["http", "https"]),
        port: z.number().int(),
        host: z.string().max(253).nullable(),
        family: z.union([z.literal(4), z.literal(6)]),
        verdict: z.enum(verdicts),
        httpStatus: z.number().int().nullable(),
        certificateExpires: z.string().max(40).nullable(),
      }),
    )
    .max(16),
});

export function readLastCheck(): RemoteCheckReport | null {
  const raw = getConfigValue(KEYS.lastCheck);
  if (!raw) return null;
  try {
    const parsed = reportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveLastCheck(report: RemoteCheckReport): Promise<void> {
  await setConfigValue(KEYS.lastCheck, JSON.stringify(report));
}
