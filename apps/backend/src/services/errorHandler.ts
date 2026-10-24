import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

/**
 * Le gestionnaire d'erreurs global : rien de l'intérieur ne sort sur une 5xx
 * (ni message, ni pile — seulement le journal), une 4xx garde son message, et
 * une `ZodError` devient un 400 « Validation error » avec ses chemins. Sorti
 * d'`index.ts` pour être éprouvé (`security/errorLeak.test.ts`).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Validation error",
        errors: error.issues,
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(statusCode).send({ message: "Internal server error" });
    }

    return reply.status(statusCode).send({
      message: (error as Error).message || "Error",
    });
  });
}
