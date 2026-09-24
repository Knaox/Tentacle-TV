import type { FastifyPluginAsync } from "fastify";
import { getDirectStreamingConfig, getJellyfinUrl, getPublicUrl } from "../services/configStore";
import { getMaxResumePct } from "../services/jellyfinSystemConfig";
import { requireAuth } from "../middleware/auth";
import { verifyDeviceToken } from "../services/jwt";
import { resolvePairedDeviceToken } from "../services/deviceTokenHealth";
import { pairedJellyfinDeviceId } from "../services/deviceSessions/deviceAuth";
import { isPrivateIp, getRealClientIp } from "../services/networkUtils";
import { BACKEND_VERSION } from "../services/version";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => {
    return {
      version: BACKEND_VERSION,
      brandName: "Tentacle TV",
      features: {
        downloads: false,
        demo: DEMO_MODE,
      },
      // URL publique canonique du serveur (domaine fronté par le worker Cloudflare).
      // Utilisée au jumelage TV pour ne PAS graver l'adresse locale/interne du
      // confirmateur (window.location.origin = tauri.localhost sur desktop, ou URL
      // LAN/DNS privé) qui n'est joignable que depuis le réseau interne.
      publicUrl: getPublicUrl(),
    };
  });

  /**
   * GET /api/config/autoplay — Seuil « vu » de l'auto-play, POLLÉ par les
   * lecteurs pendant une lecture active : le MaxResumePct de Jellyfin (cache
   * serveur 30 s → une mise à jour dans Jellyfin est prise en compte en
   * ≤ ~60 s sans spammer son API). Il n'y a plus d'interrupteur serveur : le
   * déclenchement lui-même est un réglage PAR COMPTE (/api/preferences/playback).
   */
  app.get("/config/autoplay", async () => {
    return { maxResumePct: await getMaxResumePct() };
  });

  /** GET /api/config/streaming — Client-specific streaming config (IP-aware). */
  app.get("/config/streaming", { preHandler: [requireAuth] }, async (request) => {
    const cfg = getDirectStreamingConfig();
    if (!cfg.enabled || !cfg.publicUrl || !cfg.privateUrl) {
      return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
    }

    const clientIp = getRealClientIp(request);
    const mediaBaseUrl = isPrivateIp(clientIp) ? cfg.privateUrl : cfg.publicUrl;

    // Server-side health check: verify Jellyfin is running.
    // Use the internal Jellyfin URL (not mediaBaseUrl) because the backend may
    // not be able to reach the public URL from Docker (hairpin NAT / DNS).
    const jellyfinHealthUrl = getJellyfinUrl();
    if (jellyfinHealthUrl) {
      try {
        const hc = await fetch(`${jellyfinHealthUrl}/System/Info/Public`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!hc.ok) {
          request.log.warn({ jellyfinHealthUrl, status: hc.status }, "Direct streaming health check failed");
          return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
        }
      } catch (err) {
        request.log.warn({ jellyfinHealthUrl, err }, "Direct streaming health check unreachable");
        return { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null } };
      }
    }

    // Extract bearer token and determine type
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isPairedDevice = bearerToken?.includes(".") && bearerToken.split(".").length === 3;

    let jellyfinToken: string | null = null;
    let tokenExpired = false;
    // L'identifiant Jellyfin qu'un appareil jumelé doit adopter : celui que le
    // canal de session présente pour lui (`deviceSessions/deviceAuth.ts`).
    // Adopté, ses propres requêtes et le canal touchent la MÊME session —
    // c'est elle que le tableau de bord pilote.
    let deviceId: string | null = null;

    if (isPairedDevice && bearerToken) {
      // Appareil jumelé : son jeton Jellyfin est en base — rendu seulement s'il
      // appartient à SON compte (cf. `resolvePairedDeviceToken`), sinon un
      // appareil frère du même compte prend le relais. `purged` sans
      // remplaçant : la TV doit oublier le jeton qu'elle tenait.
      const payload = await verifyDeviceToken(bearerToken);
      if (payload) {
        const resolved = await resolvePairedDeviceToken(bearerToken, payload.userId);
        jellyfinToken = resolved.token;
        tokenExpired = resolved.purged;
        deviceId = await pairedJellyfinDeviceId(bearerToken).catch(() => null);
        if (resolved.purged) {
          request.log.warn("Paired device jellyfinAccessToken invalide ou d'un autre compte — retiré, aucun appareil frère");
        }
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
        ...(deviceId && { deviceId }),
        ...(tokenExpired && { tokenExpired: true }),
      },
    };
  });
};
