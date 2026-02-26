import type { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { getSeerrUrl, getSeerrApiKey } from "../services/configStore";

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
      version: APP_VERSION,
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
