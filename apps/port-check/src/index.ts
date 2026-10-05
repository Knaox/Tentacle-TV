import { readConfig } from "./config";
import { buildServer } from "./server";

/** Le point d'entrée du service (image distroless : `node dist/server.cjs`). */
const config = readConfig();
const app = buildServer({ config });

async function start(): Promise<void> {
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    // Un hôte sans IPv6 refuse « :: » : on se rabat sur IPv4 seule.
    if (config.host !== "::") throw err;
    await app.listen({ port: config.port, host: "0.0.0.0" });
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}

start().catch((err: unknown) => {
  console.error("[port-check] démarrage impossible :", err instanceof Error ? err.message : err);
  process.exit(1);
});
