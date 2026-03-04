/**
 * IP classification utilities for direct streaming routing.
 * Determines if a client IP is on a private network (RFC 1918, loopback, IPv6 link-local).
 */

/** Check if an IPv4 address falls within a CIDR block. */
function ipv4InCidr(ip: string, cidr: string): boolean {
  const [cidrIp, bits] = cidr.split("/");
  const mask = ~((1 << (32 - Number(bits))) - 1) >>> 0;
  const ipNum = ipv4ToNumber(ip);
  const cidrNum = ipv4ToNumber(cidrIp);
  return (ipNum & mask) === (cidrNum & mask);
}

function ipv4ToNumber(ip: string): number {
  const parts = ip.split(".");
  return ((Number(parts[0]) << 24) | (Number(parts[1]) << 16) | (Number(parts[2]) << 8) | Number(parts[3])) >>> 0;
}

const PRIVATE_CIDRS = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
];

/**
 * Classify an IP as private (LAN) or public (WAN).
 * Handles IPv4, IPv4-mapped IPv6, and native IPv6 private ranges.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:192.168.1.1)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalizedIp = v4Mapped ? v4Mapped[1] : ip;

  // IPv4 check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalizedIp)) {
    return PRIVATE_CIDRS.some((cidr) => ipv4InCidr(normalizedIp, cidr));
  }

  // IPv6 loopback
  if (normalizedIp === "::1") return true;

  // IPv6 Unique Local (fc00::/7 → fc** or fd**)
  const lower = normalizedIp.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  // IPv6 Link-Local (fe80::/10)
  if (lower.startsWith("fe80")) return true;

  return false;
}

/**
 * Extract the real client IP from a Fastify request.
 * Priority: CF-Connecting-IP (Cloudflare) → X-Real-IP (nginx) → request.ip
 */
export function getRealClientIp(request: { ip: string; headers: Record<string, string | string[] | undefined> }): string {
  const cf = request.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf;
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp) return realIp;
  return request.ip;
}
