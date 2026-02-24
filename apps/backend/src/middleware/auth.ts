import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface TokenPayload {
  userId: string;
  role: "admin" | "user";
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    if (payload.role !== "admin") {
      return reply.status(403).send({ message: "Forbidden" });
    }
    (request as any).user = payload;
  } catch {
    return reply.status(401).send({ message: "Invalid token" });
  }
}
