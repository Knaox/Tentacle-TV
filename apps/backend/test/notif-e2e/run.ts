/**
 * Banc de bout en bout des notifications, sans rien toucher de réel :
 *
 *   demande (route du plugin Vigie) → faux Jellyseerr → revendication →
 *   arrivée dans le faux Jellyfin (WebSocket LibraryChanged) → vrai backend →
 *   push capté par le faux Expo → Jellyseerr rattrape → cloche → suppression
 *   → purge → et, pour finir, la coupure des push en dev.
 *
 * Lancer depuis apps/backend :  pnpm exec tsx test/notif-e2e/run.ts
 * Prérequis : MySQL local (root sans mot de passe, ou BENCH_MYSQL_ADMIN_URL),
 * plugin Vigie déployé dans data/plugins/seer. Compter une quinzaine de
 * minutes : les délais sont les vrais (attente de calme, synchro du plugin).
 * La base `tentacle_notif_bench` est recréée à chaque passage ; le journal du
 * backend reste dans $BENCH_DIR/backend.log pour l'enquête.
 */

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { BENCH_DB_URL, BackendProcess, prepareDataDir, resetDatabase, seedConfig, waitFor } from "./benchEnv";
import { Checks } from "./checks";
import { FakeExpo } from "./fakeExpo";
import { ADMIN_API_KEY, FakeJellyfin } from "./fakeJellyfin";
import { FakeSeerr, SEERR_API_KEY } from "./fakeSeerr";
import { BASELINE, BOB, CAROL, OPPENHEIMER, SEERR_USERS, USERS } from "./fixtures";
import {
  ARRIVAL_TIMEOUT_MS, arrivalMovies, arrivalSeasonInTwoWaves, createRequests, pushesTo, registerDevices, type Bench,
} from "./scenariosArrivals";
import { bellDeletion, contentComesBack, purgeAfter30Days, seerrCatchesUp, upgradedFile, weeklyEpisode } from "./scenariosLifecycle";

const DAY = 24 * 60 * 60_000;
const PORT = Number(process.env.BENCH_PORT ?? 3099);

async function main(): Promise<void> {
  const benchDir = process.env.BENCH_DIR ?? join(tmpdir(), "tentacle-notif-bench");
  mkdirSync(benchDir, { recursive: true });
  const checks = new Checks();

  const jf = new FakeJellyfin(USERS);
  const seerr = new FakeSeerr(SEERR_USERS);
  const expo = new FakeExpo();
  const [jfUrl, seerrUrl, expoUrl] = await Promise.all([jf.start(), seerr.start(), expo.start()]);
  for (const it of BASELINE) jf.items.set(it.Id, it);

  console.log(`Banc : Jellyfin ${jfUrl} · Jellyseerr ${seerrUrl} · Expo ${expoUrl} · backend :${PORT}`);
  await resetDatabase();
  const prisma = new PrismaClient({ datasourceUrl: BENCH_DB_URL });
  await seedConfig(prisma, jfUrl, ADMIN_API_KEY);
  // La cloche de Carol : une notification de 40 jours (à purger), une de 10 (à garder).
  for (const [title, age] of [["Vieux ticket", 40], ["Ticket récent", 10]] as const) {
    await prisma.notification.create({
      data: { jellyfinUserId: CAROL.Id, type: "ticket_status", title, body: "resolved", createdAt: new Date(Date.now() - age * DAY), pushedAt: new Date() },
    });
  }
  prepareDataDir(join(benchDir, "data"), seerrUrl, SEERR_API_KEY);

  const env: Record<string, string> = {
    DATABASE_URL: BENCH_DB_URL,
    JWT_SECRET: "banc-notifications-secret-de-test-0123456789",
    TENTACLE_DATA_DIR: join(benchDir, "data"),
    TENTACLE_DEV_PUSH: "1",
    EXPO_BASE_URL: expoUrl,
    JELLYFIN_URL: jfUrl,
    JELLYFIN_ADMIN_API_KEY: ADMIN_API_KEY,
    CORS_ORIGIN: "http://localhost",
    RELAY_ADMIN_SECRET: "banc",
    // Rien ne sort du banc : ni le relais de jumelage réel, ni TMDB.
    PAIRING_RELAY_URL: "http://127.0.0.1:9",
    TMDB_API_KEY: "",
    NODE_ENV: "development",
  };
  const backend = new BackendProcess(PORT, join(benchDir, "backend.log"));
  const bench: Bench = { jf, seerr, expo, backend, prisma, checks };

  try {
    checks.begin("Démarrage du vrai backend sur le banc");
    await backend.start(env);
    await checks.step("instantané de départ de la bibliothèque", async () => {
      await backend.waitForLog(/\[LibNotif\] baseline/, 0, 60_000, "baseline");
    });
    await checks.step("WebSocket Jellyfin branché", () => waitFor(() => jf.wsClients > 0, 60_000, "socket Jellyfin"));
    await checks.step("plugin Vigie chargé", async () => {
      await backend.waitForLog(/\[SeerWorker\] Started/, 0, 60_000, "worker du plugin");
    });

    await registerDevices(bench);
    await createRequests(bench);
    await arrivalSeasonInTwoWaves(bench);
    await arrivalMovies(bench);
    await seerrCatchesUp(bench);
    await weeklyEpisode(bench);
    await upgradedFile(bench);
    await contentComesBack(bench);
    await bellDeletion(bench);
    await purgeAfter30Days(bench);
    await devGuard(bench, env);
  } finally {
    await backend.stop();
    await Promise.all([jf.stop(), seerr.stop(), expo.stop()]);
    await prisma.$disconnect();
  }

  console.log("\nAppels non simulés (diagnostic) :");
  console.log("  Jellyfin :", Object.fromEntries(jf.unknown));
  console.log("  Jellyseerr :", Object.fromEntries(seerr.unknown));
  console.log(`\n${checks.summary()} — journal : ${join(benchDir, "backend.log")}`);
  for (const f of checks.failed) console.log(`  ✗ [${f.phase}] ${f.name}`);
  process.exit(checks.failed.length === 0 ? 0 : 1);
}

/** Même backend relancé SANS TENTACLE_DEV_PUSH : un ajout ne doit plus rien envoyer. */
async function devGuard(b: Bench, env: Record<string, string>): Promise<void> {
  b.checks.begin("Coupure des push en dev (backend relancé sans TENTACLE_DEV_PUSH)");
  await b.backend.stop();
  const devEnv = { ...env };
  delete devEnv.TENTACLE_DEV_PUSH;
  const restartedAt = Date.now();
  await b.backend.start(devEnv);
  await b.checks.step("WebSocket Jellyfin rebranché", () => waitFor(() => b.jf.wsClients > 0, 60_000, "socket Jellyfin"));
  await b.checks.step("instantané rechargé", async () => {
    await b.backend.waitForLog(/\[LibNotif\] instantané chargé/, restartedAt, 60_000, "instantané");
  });
  const t = Date.now();
  b.jf.addItems([OPPENHEIMER]);
  await b.checks.step("l'envoi est coupé et le journal le dit", async () => {
    await b.backend.waitForLog(/\[Push\] dev : envoi coupé — « Oppenheimer »/, t, ARRIVAL_TIMEOUT_MS, "coupure dev");
  });
  b.checks.that("rien n'est parti vers Expo", b.expo.since(t).length === 0 && pushesTo(b, BOB, t).length === 0, b.expo.since(t));
}

main().catch((err) => {
  console.error("Banc interrompu :", err);
  process.exit(2);
});
