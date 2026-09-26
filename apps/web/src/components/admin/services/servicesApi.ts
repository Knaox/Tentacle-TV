import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { readAdminKeyHealth } from "../../../lib/adminKeyHealth";
import {
  AdminApiError,
  asRecord,
  readAudioAnalysis,
  readDirectStreaming,
  readDirectStreamingTest,
  readPublicUrl,
  readServices,
  text,
  type DatabaseFields,
  type DirectStreamingConfig,
} from "./servicesModel";

/** Les appels de la page « Services » — tous sous `/api/admin`. */

async function call<T>(path: string, read: (raw: unknown) => T, method = "GET", body?: object): Promise<T> {
  const headers = hdrs();
  // Un POST sans corps mais typé JSON, Fastify le refuse : pas de corps, pas d'en-tête.
  if (body === undefined) delete headers["Content-Type"];
  const res = await fetch(`${BACKEND}/api/admin${path}`, {
    method,
    headers,
    credentials: creds(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const payload = asRecord(raw);
    const httpStatus = typeof payload.httpStatus === "number" ? payload.httpStatus : null;
    throw new AdminApiError(res.status, text(payload.error) || null, httpStatus, text(payload.message) || `HTTP ${res.status}`);
  }
  return read(raw);
}

const ignore = () => undefined;

export const servicesApi = {
  status: () => call("/services", readServices),
  publicUrl: () => call("/public-url", readPublicUrl),
  directStreaming: () => call("/direct-streaming", readDirectStreaming),
  audioAnalysis: () => call("/audio-analysis", readAudioAnalysis),
  /** `force` : le serveur garde son verdict cinq minutes, « Revérifier » le refait. */
  keyHealth: (force = false) => call(`/jellyfin-key${force ? "?refresh=1" : ""}`, readAdminKeyHealth),

  testJellyfin: (body: { url: string; apiKey?: string }) =>
    call("/test-jellyfin", (raw) => ({ version: text(asRecord(raw).version), serverName: text(asRecord(raw).serverName) }), "POST", body),
  saveJellyfin: (body: { url: string; apiKey?: string }) => call("/jellyfin", ignore, "PUT", body),
  saveDatabase: (body: DatabaseFields & { password: string }) => call("/database", ignore, "PUT", body),
  savePublicUrl: (publicUrl: string) => call("/public-url", ignore, "PUT", { publicUrl }),
  saveDirectStreaming: (body: DirectStreamingConfig) => call("/direct-streaming", ignore, "PUT", body),
  testDirectStreaming: (body: { publicUrl: string; privateUrl: string }) =>
    call("/test-direct-streaming", readDirectStreamingTest, "POST", body),
  setAudioAnalysis: (enabled: boolean) => call("/audio-analysis", ignore, "PUT", { enabled }),
  resetServer: () => call("/reset-server", ignore, "POST", {}),
};
