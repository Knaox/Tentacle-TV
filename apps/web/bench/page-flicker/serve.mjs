#!/usr/bin/env node
/**
 * Sert un build de production d'`apps/web` devant une vraie instance (voir `lib/server.mjs`).
 *
 *   node bench/page-flicker/serve.mjs --dist <dossier du build> --api http://127.0.0.1:3412 \
 *        --port 5412 [--memory <dossier hors dépôt>]
 */
import { resolve } from "node:path";
import { startServer } from "./lib/server.mjs";

const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const dist = resolve(args.get("--dist") ?? "dist");
const server = await startServer({ dist, api: args.get("--api") ?? "http://127.0.0.1:3001", port: Number(args.get("--port") ?? 0), memory: args.get("--memory") });
console.log(`banc : ${server.url} ← ${dist}${args.get("--memory") ? ` (mémoire : ${args.get("--memory")})` : ""}`);
setInterval(() => console.log(`mémoire : ${server.stats.hits} servies, ${server.stats.misses} apprises, ${server.stats.relayed} relayées`), 30000).unref();
process.on("SIGTERM", () => void server.close().then(() => process.exit(0)));
process.on("SIGINT", () => void server.close().then(() => process.exit(0)));
setInterval(() => undefined, 1 << 30);
