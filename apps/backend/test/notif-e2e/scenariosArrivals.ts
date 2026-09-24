/**
 * Première moitié du banc : les comptes s'inscrivent comme l'app mobile, les
 * demandes partent par la VRAIE route du plugin Vigie jusqu'au faux
 * Jellyseerr, puis les contenus arrivent dans Jellyfin — et on regarde qui
 * reçoit quoi, avant que Jellyseerr ne les ait vus. Enfin Jellyseerr rattrape
 * son retard : les lignes du plugin arrivent dans la cloche, sans second push.
 */

import type { PrismaClient } from "@prisma/client";
import { apiAs, sleep, waitFor, type BackendProcess } from "./benchEnv";
import type { Checks } from "./checks";
import type { FakeExpo, PushMessage } from "./fakeExpo";
import type { FakeJellyfin, FakeUser } from "./fakeJellyfin";
import type { FakeSeerr } from "./fakeSeerr";
import {
  ALICE, BEAR, BEAR_EPISODES, BOB, CAROL, DAVE, DUNE, DUNE2, EVE, INCEPTION, ARRIVAL, TMDB, WITH_DEVICE, deviceOf,
} from "./fixtures";

export interface Bench {
  jf: FakeJellyfin;
  seerr: FakeSeerr;
  expo: FakeExpo;
  backend: BackendProcess;
  prisma: PrismaClient;
  checks: Checks;
}

/** Après les pushes attendus, un temps de silence : un doublon aurait le temps d'arriver. */
export const QUIET_MS = 20_000;
/** WS (8 s) + attente de calme (45 s) + marge. */
export const ARRIVAL_TIMEOUT_MS = 150_000;

export const pushesTo = (b: Bench, u: FakeUser, since: number): PushMessage[] => b.expo.to(deviceOf(u), since);
const api = (b: Bench, u: FakeUser) => apiAs(b.backend.url, u.token);

export async function registerDevices(b: Bench): Promise<void> {
  b.checks.begin("Inscription des appareils et des préférences (comme l'app mobile)");
  for (const u of WITH_DEVICE) {
    const res = await api(b, u).post("/api/push/register", { token: deviceOf(u), platform: "ios" });
    b.checks.that(`${u.Name} inscrit son appareil`, res.status === 200, res);
  }
  const bob = await api(b, BOB).put<{ libraryAdded: boolean }>("/api/push/preferences", { libraryAdded: true });
  b.checks.that("Bob coche « Ajouts en bibliothèque »", bob.json.libraryAdded === true, bob);
  const dave = await api(b, DAVE).put<{ seerAvailable: boolean }>("/api/push/preferences", { seerAvailable: false });
  b.checks.that("Dave décoche « Contenu demandé disponible »", dave.json.seerAvailable === false, dave);
  const carol = await api(b, CAROL).get<Record<string, boolean>>("/api/push/preferences");
  b.checks.that(
    "Carol, sans réglage : demandes oui, tous les ajouts non (défauts)",
    carol.json.seerAvailable === true && carol.json.libraryAdded === false,
    carol.json,
  );
  const eve = await api(b, EVE).put("/api/preferences/language", { language: "en" });
  b.checks.that("Eve passe son interface en anglais", eve.status === 200, eve);
}

export async function createRequests(b: Bench): Promise<void> {
  b.checks.begin("Demandes créées par la route du plugin Vigie, envoyées à Jellyseerr");
  const asks: Array<[FakeUser, Record<string, unknown>]> = [
    [ALICE, { mediaType: "tv", tmdbId: TMDB.bear, title: "The Bear", seasons: [1] }],
    [ALICE, { mediaType: "movie", tmdbId: TMDB.dune, title: "Dune" }],
    [DAVE, { mediaType: "movie", tmdbId: TMDB.inception, title: "Inception" }],
    [EVE, { mediaType: "movie", tmdbId: TMDB.dune2, title: "Dune: Part Two" }],
  ];
  for (const [u, body] of asks) {
    const res = await api(b, u).post("/api/plugins/seer/requests", body);
    b.checks.that(`${u.Name} demande « ${String(body.title)} »`, res.status === 201, res);
  }
  await b.checks.step("les quatre demandes arrivent chez Jellyseerr", () =>
    waitFor(
      () =>
        b.seerr.requestsFor("tv", TMDB.bear).length === 1 &&
        b.seerr.requestsFor("movie", TMDB.dune).length === 1 &&
        b.seerr.requestsFor("movie", TMDB.inception).length === 1 &&
        b.seerr.requestsFor("movie", TMDB.dune2).length === 1,
      60_000,
      "demandes reçues par le faux Jellyseerr",
    ),
  );
  const claims = await b.prisma.contentClaim.findMany({ where: { expiresAt: { gt: new Date() } } });
  const has = (u: FakeUser, tmdb: number) => claims.some((c) => c.jellyfinUserId === u.Id && c.tmdbId === tmdb);
  b.checks.that(
    "chaque demandeur est revendiqué sur son contenu (content_claims)",
    has(ALICE, TMDB.bear) && has(ALICE, TMDB.dune) && has(DAVE, TMDB.inception) && has(EVE, TMDB.dune2),
    claims.map((c) => `${c.jellyfinUserId.slice(0, 4)}:${c.tmdbId}`),
  );
}

export async function arrivalSeasonInTwoWaves(b: Bench): Promise<void> {
  b.checks.begin("Arrivée d'une saison en deux vagues (The Bear S1, demandée par Alice)");
  const t = Date.now();
  b.jf.addItems([BEAR, BEAR_EPISODES[0], BEAR_EPISODES[1]]);
  await sleep(20_000);
  b.jf.addItems([BEAR_EPISODES[2]]);
  await b.checks.step("Alice et Bob sont prévenus", () =>
    waitFor(() => pushesTo(b, ALICE, t).length > 0 && pushesTo(b, BOB, t).length > 0, ARRIVAL_TIMEOUT_MS, "pushes d'Alice et Bob"),
  );
  await sleep(QUIET_MS);
  const alice = pushesTo(b, ALICE, t);
  const bob = pushesTo(b, BOB, t);
  b.checks.that("Alice : une seule annonce pour la saison entière", alice.length === 1, alice);
  b.checks.that(
    "Alice : « Votre demande est disponible », les 3 épisodes regroupés",
    alice[0]?.title === "The Bear — Saison 1 (3 épisodes)" && alice[0]?.body === "Votre demande est disponible sur Tentacle TV",
    alice[0],
  );
  b.checks.that("Alice : le tap ouvre la série", alice[0]?.data.refId === BEAR.Id && alice[0]?.data.type === "library_added", alice[0]?.data);
  b.checks.that("Alice : n'a pas attendu Jellyseerr (demande encore « en cours » chez lui)", (b.seerr.media.get(`tv:${TMDB.bear}`)?.status ?? 0) < 5);
  b.checks.that(
    "Bob (abonné à tout) : la demande d'Alice lui est annoncée aussi, une fois",
    bob.length === 1 && bob[0].title === "The Bear — Saison 1 (3 épisodes)" && bob[0].body === "est sortie sur Tentacle TV",
    bob,
  );
  for (const u of [CAROL, DAVE, EVE]) b.checks.that(`${u.Name} : rien`, pushesTo(b, u, t).length === 0, pushesTo(b, u, t));
}

export async function arrivalMovies(b: Bench): Promise<void> {
  b.checks.begin("Arrivée de quatre films (trois demandés, un non)");
  const t = Date.now();
  b.jf.addItems([DUNE, INCEPTION, DUNE2, ARRIVAL]);
  await b.checks.step("Alice, Eve et Bob sont prévenus", () =>
    waitFor(
      () => [ALICE, EVE, BOB].every((u) => pushesTo(b, u, t).length > 0),
      ARRIVAL_TIMEOUT_MS,
      "pushes d'Alice, Eve et Bob",
    ),
  );
  await sleep(QUIET_MS);
  const [alice, eve, bob] = [ALICE, EVE, BOB].map((u) => pushesTo(b, u, t));
  b.checks.that(
    "Alice : « Dune », sa demande, et le tap ouvre le film",
    alice.length === 1 && alice[0].title === "Dune" && alice[0].body === "Votre demande est disponible sur Tentacle TV" && alice[0].data.refId === DUNE.Id,
    alice,
  );
  b.checks.that(
    "Eve : sa demande, en anglais",
    eve.length === 1 && eve[0].title === "Dune: Part Two" && eve[0].body === "Your request is now on Tentacle TV",
    eve,
  );
  b.checks.that(
    "Bob : une seule annonce pour les quatre, demandes des autres comprises",
    bob.length === 1 && bob[0].title === "4 nouveautés sur Tentacle TV" && bob[0].body === "Dune · Inception · Dune: Part Two +1",
    bob,
  );
  b.checks.that("Dave : rien (« Contenu demandé disponible » décoché)", pushesTo(b, DAVE, t).length === 0, pushesTo(b, DAVE, t));
  b.checks.that("Carol : rien", pushesTo(b, CAROL, t).length === 0, pushesTo(b, CAROL, t));
}
