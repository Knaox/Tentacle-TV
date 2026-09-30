// La session de l'instantané : un jeton d'appareil (`paired_device`) du compte
// de test Knaoxtest, sur le backend de DÉVELOPPEMENT. Aucun mot de passe : le
// jeton arrive par l'environnement (`TENTACLE_BENCH_TOKEN`, `TENTACLE_BENCH_SERVER`)
// ou par `snapshot/session.json` (`{ "server", "token" }`, ignoré par git).
// Tout autre compte, tout serveur hors du réseau local : refus, sans appel.
import fs from "node:fs";
import path from "node:path";

const ACCOUNT = "knaoxtest";

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Le backend de dev tourne sur la machine ou le réseau local ; la
 *  production, jamais. */
function isLocalServer(server) {
  let host;
  try {
    host = new URL(server).hostname;
  } catch {
    return false;
  }
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "[::1]"
    || host.endsWith(".local")
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

export function loadSession(snapshotDir) {
  let server = process.env.TENTACLE_BENCH_SERVER;
  let token = process.env.TENTACLE_BENCH_TOKEN;
  const file = path.join(snapshotDir, "session.json");
  if ((!server || !token) && fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    server ??= saved.server;
    token ??= saved.token;
  }
  if (!token) {
    throw new Error("aucune session : jeton d'appareil Knaoxtest attendu dans TENTACLE_BENCH_TOKEN ou snapshot/session.json (voir README)");
  }
  server = (server ?? "http://localhost:3001").replace(/\/+$/, "");
  if (!isLocalServer(server)) throw new Error(`serveur ${server} refusé : backend de développement local seulement`);
  const payload = decodeJwtPayload(token);
  if (payload?.type !== "paired_device") throw new Error("ce jeton n'est pas un jeton d'appareil (paired_device)");
  if (String(payload.username ?? "").toLowerCase() !== ACCOUNT) {
    throw new Error(`compte « ${payload.username} » refusé : l'instantané ne se tire que sur Knaoxtest`);
  }
  if (!payload.userId) throw new Error("jeton sans userId");
  return { server, token, userId: String(payload.userId), username: String(payload.username) };
}
