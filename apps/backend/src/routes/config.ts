import type { FastifyPluginAsync } from "fastify";

const SEERR_URL = process.env.SEERR_URL || "";
const SEERR_API_KEY = process.env.SEERR_API_KEY || "";
const DEMO_MODE = process.env.DEMO_MODE === "true";

/** Check if Seerr/Overseerr is reachable. */
async function isSeerrAvailable(): Promise<boolean> {
  if (!SEERR_URL || !SEERR_API_KEY) return false;
  try {
    const res = await fetch(`${SEERR_URL}/api/v1/status`, {
      headers: { "X-Api-Key": SEERR_API_KEY },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Cache Seerr status for 60 seconds
let seerrCache: { available: boolean; ts: number } = { available: false, ts: 0 };

async function getSeerrStatus(): Promise<boolean> {
  if (Date.now() - seerrCache.ts < 60_000) return seerrCache.available;
  const available = await isSeerrAvailable();
  seerrCache = { available, ts: Date.now() };
  return available;
}

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async () => {
    const seerrEnabled = await getSeerrStatus();

    return {
      version: process.env.npm_package_version || "0.3.0",
      brandName: "Tentacle",
      features: {
        seerr: seerrEnabled,
        requests: seerrEnabled,
        discover: seerrEnabled,
        downloads: false, // future feature
        demo: DEMO_MODE,
      },
    };
  });
};
