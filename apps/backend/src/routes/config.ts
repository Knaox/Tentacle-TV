import type { FastifyPluginAsync } from "fastify";
import { getSeerrUrl, getSeerrApiKey } from "../services/configStore";

const DEMO_MODE = process.env.DEMO_MODE === "true";

async function isSeerrAvailable(): Promise<boolean> {
  const url = getSeerrUrl();
  const key = getSeerrApiKey();
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/api/v1/status`, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
      version: process.env.npm_package_version || "0.5.0",
      brandName: "Tentacle",
      features: {
        seerr: seerrEnabled,
        requests: seerrEnabled,
        discover: seerrEnabled,
        downloads: false,
        demo: DEMO_MODE,
      },
    };
  });
};
