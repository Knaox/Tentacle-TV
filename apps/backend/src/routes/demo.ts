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
