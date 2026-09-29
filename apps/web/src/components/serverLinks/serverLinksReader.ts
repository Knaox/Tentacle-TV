import type { LinkProbe, LinkProbeResult, ServerLinksReport } from "@tentacle-tv/shared";

/**
 * La réponse de `/api/admin/server-links`, lue champ par champ. Sans `fetch`
 * ni import de l'application : ce module se teste seul.
 */

export type Json = Record<string, unknown>;
export const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
export const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const RESULTS: readonly LinkProbeResult[] = ["ok", "other-server", "unexpected", "http-error", "unreachable", "timeout"];

function readProbe(raw: unknown): LinkProbe | null {
  if (!isRecord(raw) || !RESULTS.includes(raw.result as LinkProbeResult)) return null;
  return {
    result: raw.result as LinkProbeResult,
    httpStatus: typeof raw.httpStatus === "number" ? raw.httpStatus : null,
    version: str(raw.version),
    cors: typeof raw.cors === "boolean" ? raw.cors : null,
    detail: str(raw.detail),
  };
}

/** La réponse lue champ par champ : un champ inconnu vaut « non sondé », jamais une page qui tombe. */
export function readServerLinksReport(raw: unknown): ServerLinksReport | null {
  if (!isRecord(raw) || !isRecord(raw.tentacle) || !isRecord(raw.direct)) return null;
  const { tentacle, direct } = raw;
  return {
    checkedAt: str(raw.checkedAt) ?? "",
    tentacle: {
      url: str(tentacle.url),
      source: tentacle.source === "config" || tentacle.source === "env" ? tentacle.source : null,
      probe: readProbe(tentacle.probe),
    },
    direct: {
      enabled: direct.enabled === true,
      publicUrl: str(direct.publicUrl),
      privateUrl: str(direct.privateUrl),
      publicProbe: readProbe(direct.publicProbe),
      privateProbe: readProbe(direct.privateProbe),
    },
    legacyClientsRelayed: typeof raw.legacyClientsRelayed === "boolean" ? raw.legacyClientsRelayed : null,
    jellyfinUrl: str(raw.jellyfinUrl),
  };
}
