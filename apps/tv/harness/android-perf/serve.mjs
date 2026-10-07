#!/usr/bin/env node
// Le faux backend nav-golden et le relais d'images, tenus jusqu'au signal —
// pour les passes `--external` de `baseline.mjs` (un faux backend NEUF sert
// son premier catalogue en plus de 10 s : on le lance une fois, avant).
//
//   PERF_PORT=3203 PERF_BACKEND_PORT=3201 node serve.mjs
import path from "node:path";
import { CACHE, startBackend } from "./lib/benchSetup.mjs";
import { startImageProxy } from "./lib/imageProxy.mjs";

const PORT = Number(process.env.PERF_PORT ?? 3111);
const BACKEND = Number(process.env.PERF_BACKEND_PORT ?? PORT + 10);
const backend = await startBackend(BACKEND);
const proxy = await startImageProxy({ port: PORT, target: BACKEND, cacheDir: path.join(CACHE, "images"), resize: true, log: () => {} });
console.log(`prêt : relais ${PORT}, faux backend ${BACKEND}`);
const stop = async () => {
  backend.kill();
  await proxy.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
