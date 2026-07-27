import type { FastifyPluginAsync } from "fastify";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export const demoRoutes: FastifyPluginAsync = async (app) => {
  if (!DEMO_MODE) return;

  app.post("/auth/demo", async (_req, reply) => {
    const demoUser = {
      userId: "demo-user-001",
      username: "Demo",
      isAdmin: false,
      token: "demo-token-tentacle",
    };

    reply.setCookie("tentacle_token", demoUser.token, {
      httpOnly: true,
      // `auto` plutôt que `NODE_ENV` : le drapeau Secure suit alors le PROTOCOLE
        // réel de la requête (Fastify tourne en `trustProxy`, donc
        // `X-Forwarded-Proto` est honoré). `NODE_ENV` n'était posé nulle part —
        // ni Dockerfile, ni docker-compose, ni entrypoint — ce cookie de session
        // partait donc SANS Secure en production.
        secure: "auto",
      sameSite: "strict",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });

    return reply.send({
      token: demoUser.token,
      user: {
        Id: demoUser.userId,
        Name: demoUser.username,
        Policy: { IsAdministrator: false },
      },
    });
  });
};
