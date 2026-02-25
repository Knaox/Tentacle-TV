import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { healthRoutes } from "./routes/health";
import { seerrRoutes } from "./routes/seerr";
import { requestRoutes } from "./routes/requests";
import { preferenceRoutes } from "./routes/preferences";
import { updateRoutes } from "./routes/update";
import { ticketRoutes } from "./routes/tickets";
import { notificationRoutes } from "./routes/notifications";
import { configRoutes } from "./routes/config";
import { demoRoutes } from "./routes/demo";
import { startRequestWorker } from "./services/requestWorker";

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
  await app.register(requestRoutes, { prefix: "/api/requests" });
  await app.register(preferenceRoutes, { prefix: "/api/preferences" });
  await app.register(updateRoutes, { prefix: "/api/update" });
  await app.register(ticketRoutes, { prefix: "/api/tickets" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(configRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });
  await app.register(healthRoutes, { prefix: "/api" });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Tentacle Backend running on http://localhost:${PORT}`);

  // Start background worker for media request queue
  startRequestWorker();
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
