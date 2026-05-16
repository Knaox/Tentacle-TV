/** Headers to skip when proxying (hop-by-hop). */
export const SKIP_REQUEST_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
  // Fastify parses then re-serializes JSON bodies — Content-Length may change.
  // Let Node.js fetch recalculate it from the actual body.
  "content-length",
]);

export const SKIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding", "connection", "keep-alive",
]);

/** Extra headers to strip for non-media (API/JSON) responses.
 *  Node fetch auto-decompresses gzipped JSON — content-length/encoding change.
 *  Media streams pass through raw bytes, so these headers stay accurate. */
export const SKIP_API_RESPONSE_HEADERS = new Set([
  "content-encoding", "content-length",
]);

/** Build the headers to forward to Jellyfin, swapping the X-Emby auth fields
 *  to use the admin API key when the incoming request carries a verified
 *  device JWT. */
export function buildForwardHeaders(
  incoming: Record<string, string | string[] | undefined>,
  apiKeyOverride: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== "string") continue;
    if (SKIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    const lower = key.toLowerCase();
    if (apiKeyOverride) {
      if (lower === "x-emby-token") {
        headers[key] = apiKeyOverride;
        continue;
      }
      if (lower === "x-emby-authorization") {
        headers[key] = value.replace(/Token="[^"]*"/, `Token="${apiKeyOverride}"`);
        continue;
      }
    }
    headers[key] = value;
  }
  return headers;
}
