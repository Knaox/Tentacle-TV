/**
 * Le banc des pannes de Jellyfin, en UNE commande (depuis apps/backend) :
 *
 *   pnpm bench:jellyfin-outage            (--keep : garde la base ; --run-dir <dossier>)
 *
 * Le VRAI backend Tentacle (tsx, MariaDB 11 jetable) face à un FAUX Jellyfin
 * qui rejoue les pannes mesurées sur Jellyfin 10.11.11 (`fakeJellyfin.ts`),
 * trois faux lecteurs qui parlent le canal de session comme les applications,
 * et un lecteur qui passe par le vrai code client d'`api-client`. Chaque délai
 * est mesuré et comparé à son seuil ; le rapport JSON garde les mesures.
 * Rien ne sort de la machine : ni le relais de jumelage, ni TMDB, ni push.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Checks } from "../notif-e2e/checks";
import { API_KEY, sleep, type FakeUser } from "./fakeJellyfin";
import { FakePlayer } from "./players";
import { RealClient } from "./realClient";
import { apiRestart, dockerKill, dockerRestart, dockerStop, socketBlip, type Bench } from "./scenarios";
import { startStack } from "./stack";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const runDirArg = args[args.indexOf("--run-dir") + 1];
const runDir = args.includes("--run-dir") && runDirArg ? runDirArg : join(tmpdir(), `tentacle-panne-${Date.now()}`);
const DB = { name: "tentacle-panne-db", port: 18199 };
const FAKE_PORT = 18196;
const BACKEND_PORT = 3196;
const ITEM = "e04e04e04e04e04e04e04e04e04e04e0";

const USERS: FakeUser[] = ["bureau", "web", "mobile", "client-reel", "retardataire", "inconnu"].map((name, i) => ({
  Id: `0000000000000000000000000000000${i}`,
  Name: name,
  token: `jeton-${name}`,
}));

async function main(): Promise<number> {
  mkdirSync(runDir, { recursive: true });
  const log = (line: string): void => console.log(`[panne] ${line}`);
  const stack = await startStack({ users: USERS, runDir, fakePort: FAKE_PORT, backendPort: BACKEND_PORT, db: DB, keep, log });
  const { fake, backend } = stack;
  const checks = new Checks();
  const measures: Bench["measures"] = {};
  const players = USERS.slice(0, 3).map((u) => new FakePlayer(u.Name, u.token, backend.url, ITEM));
  const client = new RealClient(backend.url, USERS[3].token);
  // Le retardataire s'est déjà connecté (son jeton est connu du backend) ;
  // l'inconnu se présente pour la première fois en pleine panne.
  const joiner = new FakePlayer(USERS[4].Name, USERS[4].token, backend.url, ITEM);
  const stranger = new FakePlayer(USERS[5].Name, USERS[5].token, backend.url, ITEM);
  try {
    checks.begin("Mise en place");
    await waitFor(() => fake.socketsOpened.some((o) => o.token === API_KEY), 30_000);
    checks.that("le backend tient sa socket Jellyfin (clé d'API)", true);
    for (const p of players) await p.connect();
    await joiner.connect();
    joiner.close();
    client.start();
    for (const p of players) p.play();
    await waitFor(() => players.every((p) => fake.hits.some((h) => h.token === p.token && h.path === "/Sessions/Playing")), 15_000);
    checks.that("trois lectures directes annoncées à Jellyfin par le canal", true);
    await sleep(2_000);
    const bench: Bench = { fake, players, client, checks, backendUrl: backend.url, measures };
    await socketBlip(bench);
    await apiRestart(bench);
    await dockerRestart(bench);
    await dockerStop(bench, joiner, stranger);
    await dockerKill(bench);
    const byPhase = fake.probes.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.phase]: (acc[p.phase] ?? 0) + 1 }), {});
    measures.probes = JSON.stringify(byPhase);
    log(`sondes reçues par phase : ${JSON.stringify(byPhase)}`);
  } catch (err) {
    checks.that("le banc a tourné jusqu'au bout", false, err instanceof Error ? err.message : String(err));
  } finally {
    for (const p of [...players, joiner, stranger]) p.close();
    client.stop();
    await stack.stop();
  }
  const report = { at: new Date().toISOString(), measures, results: checks.results };
  writeFileSync(join(runDir, "rapport.json"), JSON.stringify(report, null, 2));
  const failed = checks.results.filter((r) => !r.ok);
  console.log(`\n${checks.results.length - failed.length}/${checks.results.length} vérifications réussies — rapport : ${join(runDir, "rapport.json")}`);
  return failed.length === 0 ? 0 : 1;
}

async function waitFor(test: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!test()) {
    if (Date.now() > deadline) throw new Error("délai dépassé à la mise en place");
    await sleep(100);
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(err);
  process.exit(1);
});
