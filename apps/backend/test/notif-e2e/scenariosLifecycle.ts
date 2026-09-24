/**
 * Seconde moitié du banc : Jellyseerr rattrape son retard (lignes du plugin
 * dans la cloche, aucun second push, « en cours de téléchargement » jamais
 * poussé), l'épisode de la semaine suivante, la mise à niveau d'un fichier,
 * le retour d'un contenu parti, la suppression dans la cloche et la purge.
 */

import { apiAs, sleep, waitFor } from "./benchEnv";
import type { FakeUser } from "./fakeJellyfin";
import {
  ALICE, ARRIVAL, ARRIVAL_AGAIN, BEAR, BEAR_EPISODES, BOB, CAROL, DAVE, DUNE, DUNE_4K, EVE, TMDB,
} from "./fixtures";
import { ARRIVAL_TIMEOUT_MS, QUIET_MS, pushesTo, type Bench } from "./scenariosArrivals";

const DAY = 24 * 60 * 60_000;
const api = (b: Bench, u: FakeUser) => apiAs(b.backend.url, u.token);
const bell = (b: Bench, u: FakeUser) => b.prisma.notification.findMany({ where: { jellyfinUserId: u.Id }, orderBy: { createdAt: "asc" } });

export async function seerrCatchesUp(b: Bench): Promise<void> {
  b.checks.begin("Jellyseerr rattrape son retard : la cloche se remplit, aucun second push");
  const t = Date.now();
  // Une demande de plus, qui restera « en cours de téléchargement ».
  const res = await api(b, ALICE).post("/api/plugins/seer/requests", { mediaType: "movie", tmdbId: TMDB.interstellar, title: "Interstellar" });
  b.checks.that("Alice demande « Interstellar »", res.status === 201, res);
  await b.checks.step("« Interstellar » part chez Jellyseerr", () =>
    waitFor(() => b.seerr.requestsFor("movie", TMDB.interstellar).length === 1, 60_000, "demande Interstellar reçue"),
  );
  b.seerr.markDownloading("movie", TMDB.interstellar);
  b.seerr.markAvailable("tv", TMDB.bear, [1]);
  b.seerr.markAvailable("movie", TMDB.dune);
  b.seerr.markAvailable("movie", TMDB.inception);
  b.seerr.markAvailable("movie", TMDB.dune2);

  const bodies = async (u: FakeUser) => (await bell(b, u)).filter((n) => n.type === "request_status").map((n) => n.body ?? "");
  await b.checks.step("les lignes du plugin arrivent dans les cloches (synchro toutes les 2 min)", () =>
    waitFor(async () => {
      const [alice, dave, eve] = await Promise.all([bodies(ALICE), bodies(DAVE), bodies(EVE)]);
      return (
        alice.some((x) => x.includes("Dune") && x.includes("sur Tentacle TV")) &&
        alice.some((x) => x.startsWith("Saison 1")) &&
        alice.some((x) => x.includes("Interstellar") && x.includes("téléchargement")) &&
        dave.some((x) => x.includes("Inception")) &&
        eve.some((x) => x.includes("Dune: Part Two"))
      );
    }, 300_000, "lignes request_status d'Alice, Dave et Eve", 5000),
  );
  // Le worker de livraison passe toutes les 15 s : on lui laisse deux passages.
  await sleep(35_000);
  for (const u of [ALICE, DAVE, EVE]) {
    b.checks.that(`${u.Name} : aucun push de plus (déjà annoncé, ou préférence coupée)`, pushesTo(b, u, t).length === 0, pushesTo(b, u, t));
  }
  const pending = await b.prisma.notification.count({ where: { type: "request_status", pushedAt: null } });
  b.checks.that("toutes les lignes du plugin ont été balayées (pushedAt posé)", pending === 0, { pending });
  b.checks.that(
    "le journal dit « skip doublon » pour les disponibilités déjà annoncées",
    b.backend.grep(/\[NotifPush\] skip doublon/, t).length >= 2,
    b.backend.grep(/\[NotifPush\]/, t).map((l) => l.text),
  );
}

export async function weeklyEpisode(b: Bench): Promise<void> {
  b.checks.begin("Épisode de la semaine suivante, puis un second dans la foulée");
  // « Une semaine plus tard » : la dernière annonce de la saison vieillit de 7 jours.
  await b.prisma.announcedContent.updateMany({
    where: { contentKey: { startsWith: "s:" } },
    data: { notifiedAt: new Date(Date.now() - 7 * DAY) },
  });
  const t = Date.now();
  b.jf.addItems([BEAR_EPISODES[3]]);
  await b.checks.step("Alice et Bob sont prévenus de l'épisode 4", () =>
    waitFor(() => pushesTo(b, ALICE, t).length > 0 && pushesTo(b, BOB, t).length > 0, ARRIVAL_TIMEOUT_MS, "pushes épisode 4"),
  );
  const [alice, bob] = [pushesTo(b, ALICE, t), pushesTo(b, BOB, t)];
  b.checks.that(
    "Alice : « The Bear S01E04 — Dogs », sa demande",
    alice[0]?.title === "The Bear S01E04 — Dogs" && alice[0]?.body === "Votre demande est disponible sur Tentacle TV" && alice[0]?.data.refId === BEAR.Id,
    alice,
  );
  b.checks.that("Bob : l'épisode 4, une fois", bob.length === 1 && bob[0].body === "est sorti sur Tentacle TV", bob);

  const t2 = Date.now();
  b.jf.addItems([BEAR_EPISODES[4]]);
  await b.checks.step("l'épisode 5 est relâché", async () => {
    await b.backend.waitForLog(/\[LibNotif\] relâchés=1, nouveautés=1/, t2, ARRIVAL_TIMEOUT_MS, "relâche de l'épisode 5");
  });
  await sleep(QUIET_MS);
  b.checks.that("épisode 5, même saison, dans les 6 h : absorbé (aucun push)", b.expo.since(t2).length === 0, b.expo.since(t2));
}

export async function upgradedFile(b: Bench): Promise<void> {
  b.checks.begin("Mise à niveau : le fichier de « Dune » est remplacé (nouvel ID Jellyfin)");
  const t = Date.now();
  b.jf.removeItems([DUNE.Id]);
  b.jf.addItems([DUNE_4K]);
  await b.checks.step("le remplacement est reconnu", async () => {
    await b.backend.waitForLog(/\[LibNotif\] relâchés=1, nouveautés=0, déjà là=1/, t, ARRIVAL_TIMEOUT_MS, "relâche du remplacement");
  });
  await sleep(QUIET_MS);
  b.checks.that("personne n'est notifié d'un « Dune est sorti »", b.expo.since(t).length === 0, b.expo.since(t));
}

export async function contentComesBack(b: Bench): Promise<void> {
  b.checks.begin("Un contenu parti depuis plus de 24 h revient (demande refaite après suppression)");
  const t0 = Date.now();
  b.jf.removeItems([ARRIVAL.Id]);
  await b.checks.step("le départ est enregistré", async () => {
    await b.backend.waitForLog(/\[LibNotif\] diff\(\w+\): en attente=\d+, partis=1/, t0, 60_000, "départ d'Arrival");
  });
  // Deux jours ont passé depuis le départ, trois depuis l'annonce.
  await b.prisma.libraryKnownId.update({ where: { itemId: ARRIVAL.Id }, data: { removedAt: new Date(Date.now() - 2 * DAY) } });
  await b.prisma.announcedContent.updateMany({
    where: { contentKey: { in: [`m:t:${ARRIVAL.ProviderIds?.Tmdb}`, "m:n:arrival"] } },
    data: { notifiedAt: new Date(Date.now() - 3 * DAY) },
  });
  const t = Date.now();
  b.jf.addItems([ARRIVAL_AGAIN]);
  await b.checks.step("Bob est prévenu du retour", () =>
    waitFor(() => pushesTo(b, BOB, t).length > 0, ARRIVAL_TIMEOUT_MS, "push du retour d'Arrival"),
  );
  const bob = pushesTo(b, BOB, t);
  b.checks.that("Bob : « Arrival est sorti » de nouveau", bob[0]?.title === "Arrival" && bob[0]?.body === "est sorti sur Tentacle TV", bob);
}

export async function bellDeletion(b: Bench): Promise<void> {
  b.checks.begin("Cloche : suppression par l'utilisateur = suppression en base");
  const list = await api(b, ALICE).get<Array<{ id: string; body: string | null }>>("/api/notifications?limit=50");
  const target = list.json.find((n) => (n.body ?? "").includes("Dune"));
  b.checks.that("Alice voit sa notification « Dune » dans la cloche", !!target, list.json);
  if (target) {
    const del = await api(b, ALICE).del(`/api/notifications/${target.id}`);
    const row = await b.prisma.notification.findUnique({ where: { id: target.id } });
    b.checks.that("Alice la supprime : la ligne quitte la base", del.status === 200 && row === null, { del, row });
  }
  const daveRows = await bell(b, DAVE);
  const batch = await api(b, DAVE).del("/api/notifications/batch", { ids: daveRows.map((n) => n.id) });
  b.checks.that("Dave en supprime plusieurs d'un coup : parties", (await bell(b, DAVE)).length === 0, batch);
  const all = await api(b, EVE).del("/api/notifications/all");
  b.checks.that("Eve vide sa cloche : plus rien en base", (await bell(b, EVE)).length === 0, all);
  const intruder = await api(b, CAROL).del(`/api/notifications/${(await bell(b, ALICE))[0]?.id ?? "x"}`);
  b.checks.that("Carol ne peut pas supprimer une notification d'Alice", intruder.status === 404, intruder);
}

export async function purgeAfter30Days(b: Bench): Promise<void> {
  b.checks.begin("Cloche : purge au-delà de 30 jours");
  const rows = await bell(b, CAROL);
  b.checks.that("la notification de 40 jours a été purgée", !rows.some((n) => n.title === "Vieux ticket"), rows.map((n) => n.title));
  b.checks.that("celle de 10 jours est toujours là", rows.some((n) => n.title === "Ticket récent"), rows.map((n) => n.title));
  b.checks.that("le journal le dit", b.backend.grep(/\[Notifications\] purge : 1 notification/).length === 1);
}
