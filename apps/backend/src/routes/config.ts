import type { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { getConfigValue, getDirectStreamingConfig } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { isPrivateIp } from "../services/networkUtils";

// Read version from package.json at startup (works in both dev/tsx and compiled CJS)
const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const DEMO_MODE = process.env.DEMO_MODE === "true";

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => {
    const creditsMin = getConfigValue("autoplay_credits_minutes");
    return {
      version: APP_VERSION,
      brandName: "Tentacle TV",
      features: {
        downloads: false,
        demo: DEMO_MODE,
      },
      autoplayCreditsMinutes: creditsMin != null ? Number(creditsMin) : 2,
    };
  });

  /** GET /api/config/streaming — Client-specific streaming config (IP-aware). */
  app.get("/config/streaming", { preHandler: [requireAuth] }, async (request) => {
    const cfg = getDirectStreamingConfig();
    if (!cfg.enabled || !cfg.publicUrl || !cfg.privateUrl) {
      return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
    }

    const clientIp = request.ip;
    const mediaBaseUrl = isPrivateIp(clientIp) ? cfg.privateUrl : cfg.publicUrl;

    // Server-side health check: verify Jellyfin is reachable from backend
    try {
      const hc = await fetch(`${mediaBaseUrl}/System/Info/Public`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!hc.ok) {
        request.log.warn({ mediaBaseUrl, status: hc.status }, "Direct streaming health check failed");
        return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
      }
    } catch (err) {
      request.log.warn({ mediaBaseUrl, err }, "Direct streaming health check unreachable");
      return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
    }

    // The user's own Jellyfin token (from Bearer header) — safe for direct media access.
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // Paired device JWTs are dot-separated (3 parts); Jellyfin tokens are opaque hex strings.
    const isPairedDevice = bearerToken?.includes(".") && bearerToken.split(".").length === 3;
    const jellyfinToken = isPairedDevice ? null : bearerToken;

    request.log.info({ clientIp, private: isPrivateIp(clientIp), mediaBaseUrl }, "Direct streaming active");

    return {
      directStreaming: {
        enabled: true,
        mediaBaseUrl,
        jellyfinToken,
      },
    };
  });
};
