import type { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";

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
    return {
      version: APP_VERSION,
      brandName: "Tentacle TV",
      features: {
        downloads: false,
        demo: DEMO_MODE,
      },
    };
  });
};
