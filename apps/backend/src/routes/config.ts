import type { FastifyPluginAsync } from "fastify";
import { getConfigValue, getDirectStreamingConfig } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { verifyDeviceToken, hashToken } from "../services/jwt";
import { isPrivateIp, getRealClientIp } from "../services/networkUtils";
import { getPrisma } from "../services/db";
import { BACKEND_VERSION } from "../services/version";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => {
    const creditsMin = getConfigValue("autoplay_credits_minutes");
    return {
      version: BACKEND_VERSION,
      brandName: "Tentacle TV",
      features: {
        downloads: false,
        demo: DEMO_MODE,
        sharedWatchlists: true,
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

    const clientIp = getRealClientIp(request);
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

    // Extract bearer token and determine type
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isPairedDevice = bearerToken?.includes(".") && bearerToken.split(".").length === 3;

    let jellyfinToken: string | null = null;

    if (isPairedDevice && bearerToken) {
      // Paired device: look up stored Jellyfin token from PairedDevice record
      const payload = await verifyDeviceToken(bearerToken);
      if (payload) {
        const prisma = getPrisma();
        const device = await prisma.pairedDevice.findUnique({
          where: { tokenHash: hashToken(bearerToken) },
          select: { jellyfinAccessToken: true },
        });
        jellyfinToken = device?.jellyfinAccessToken ?? null;
      }
    } else {
      // Web user: their bearer token IS the Jellyfin token
      jellyfinToken = bearerToken;
    }

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
