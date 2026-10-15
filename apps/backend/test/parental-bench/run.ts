/**
 * Banc du contrôle parental — Tentacle (et Vigie) ne montrent à un compte
 * restreint QUE ce que Jellyfin lui montre (docs/DROITS-UTILISATEURS.md § 9.5).
 * Jamais lancé par `pnpm test` : `pnpm --filter @tentacle-tv/backend bench:parental`
 * (variables et déroulé : README.md à côté).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDockerReady } from "../jellyfin-compat/docker";
import { JellyfinHttp } from "../jellyfin-compat/jellyfinHttp";
import { ADMIN_NAME, FILMS_ONLY_NAME, FREE_NAME, RESTRICTED_NAME } from "./catalog";
import { remoteFakeSeerr, startFakeSeerr } from "./fakeSeerr";
import { destroyContainer, ensureContainer, JF_PORT, login, provision, type JellyfinBench } from "./jellyfinBench";
import { startTentacle, type TentacleBench } from "./tentacleBench";

const log = (line: string) => console.log(`[banc] ${line}`);
const RUN = process.env.PARENTAL_RUN ?? join(tmpdir(), "tentacle-parental-bench");
const KEEP = process.env.PARENTAL_KEEP === "1";
const UP_ONLY = process.argv.includes("--up");
const CHECK_ONLY = process.argv.includes("--check");

/** `--check` : les vérifications contre un banc déjà en service (`--up`), sans rien relancer. */
async function checkRunning(): Promise<number> {
  const state = JSON.parse(readFileSync(join(RUN, "state.json"), "utf8")) as {
    tentacle: string; seerr: string; apiKey: string; libraries: JellyfinBench["libraries"];
  };
  const url = `http://127.0.0.1:${JF_PORT}`;
  const jf: JellyfinBench = {
    url, http: new JellyfinHttp(url), apiKey: state.apiKey, libraries: state.libraries,
    admin: await login(url, ADMIN_NAME), restricted: await login(url, RESTRICTED_NAME), free: await login(url, FREE_NAME),
    filmsOnly: await login(url, FILMS_ONLY_NAME),
  };
  const tentacle = { url: state.tentacle, vigie: Boolean(process.env.PARENTAL_VIGIE) } as TentacleBench;
  const { runChecks } = await import("./checks");
  return runChecks({ jf, tentacle, seerr: remoteFakeSeerr(state.seerr), runDir: RUN, log });
}

async function main(): Promise<number> {
  if (CHECK_ONLY) return checkRunning();
  assertDockerReady();
  mkdirSync(RUN, { recursive: true, mode: 0o700 });
  const rescan = ensureContainer(log);
  const jf = await provision(log, rescan);
  const seerr = await startFakeSeerr();
  const tentacle = await startTentacle(RUN, jf, { vigieRepo: process.env.PARENTAL_VIGIE, seerrUrl: seerr.url }, log);
  // L'état du passage (jetons compris) : 0600, jamais imprimé.
  writeFileSync(join(RUN, "state.json"), JSON.stringify({
    jellyfin: jf.url, tentacle: tentacle.url, seerr: seerr.url, apiKey: jf.apiKey, libraries: jf.libraries,
    accounts: { admin: jf.admin, restricted: jf.restricted, free: jf.free, filmsOnly: jf.filmsOnly },
  }, null, 2), { mode: 0o600 });
  if (UP_ONLY) {
    log(`Banc en service (état : ${join(RUN, "state.json")}). Ctrl+C pour l'arrêter.`);
    await new Promise<void>((stop) => process.once("SIGINT", () => stop()));
    await tentacle.backend.stop();
    await seerr.close();
    return 0;
  }
  try {
    const { runChecks } = await import("./checks");
    return await runChecks({ jf, tentacle, seerr, runDir: RUN, log });
  } finally {
    await tentacle.backend.stop();
    await seerr.close();
    if (!KEEP) destroyContainer();
  }
}

main().then(
  (failures) => process.exit(failures === 0 ? 0 : 1),
  (error) => {
    console.error(error);
    process.exit(2);
  },
);
