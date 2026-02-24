import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { healthRoutes } from "./routes/health";
import { seerrRoutes } from "./routes/seerr";

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: CORS_ORIGIN });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(inviteRoutes, { prefix: "/api/invites" });
  await app.register(seerrRoutes, { prefix: "/api/seerr" });
  await app.register(healthRoutes, { prefix: "/api" });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Tentacle Backend running on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
