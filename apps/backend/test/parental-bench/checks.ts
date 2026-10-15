/**
 * Le déroulé des vérifications du banc : un historique « d'avant la
 * restriction » posé au compte restreint (vus, en cours, favoris sur des titres
 * qui lui sont interdits), les références lues chez Jellyfin, puis chaque porte
 * du compte restreint passée au crible (bibliothèque, cœur, Vigie), et le
 * compte libre en témoin : les mêmes routes lui montrent bien ces titres.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCKED_TAG, RESTRICTED_MAX_RATING } from "./catalog";
import { doorsFor, guestProfileDoor, pairedTvToken, personalToken, type Door } from "./doors";
import { ExternalOracle } from "./externalOracle";
import type { FakeSeerr } from "./fakeSeerr";
import type { JellyfinBench } from "./jellyfinBench";
import { itemIdsOf, probe, Recorder, type JudgeContext } from "./judge";
import { probeAffinity } from "./probesAffinity";
import { probeCore } from "./probesCore";
import { probeRestrictionChange } from "./probesFreshness";
import { probeLibrary } from "./probesLibrary";
import { probeVigie } from "./probesVigie";
import { HISTORY_WITNESSES, seedJellyfinHistory } from "./historySeed";
import { buildReference } from "./reference";
import { tmdbKey, type TentacleBench } from "./tentacleBench";

export interface CheckInput {
  jf: JellyfinBench;
  tentacle: TentacleBench;
  seerr: FakeSeerr;
  runDir: string;
  log: (line: string) => void;
}

export async function runChecks(input: CheckInput): Promise<number> {
  const { jf, tentacle, seerr, runDir, log } = input;
  const rec = new Recorder();
  const restrictedRef = await buildReference(jf, jf.restricted);
  await seedJellyfinHistory(jf, jf.restricted);
  const freeRef = await buildReference(jf, jf.free);
  const key = tmdbKey();
  const oracle = key ? await ExternalOracle.create(jf, key, RESTRICTED_MAX_RATING) : null;
  log(`Référence : ${jf.restricted.name} voit ${restrictedRef.visible.size} éléments, ${restrictedRef.forbidden.length} lui sont interdits ; ${jf.free.name} en voit ${freeRef.visible.size}`);

  const adminPersonal = await personalToken(tentacle.url, jf.admin.name);
  const restrictedDoors = await doorsFor(tentacle.url, jf.restricted.name, jf.restricted.id, adminPersonal);
  const ctx: JudgeContext = { base: tentacle.url, ref: restrictedRef, oracle, rec };
  for (const door of restrictedDoors) {
    rec.section(`${jf.restricted.name} — porte « ${door.label} » : bibliothèque (proxy Jellyfin)`);
    await probeLibrary(ctx, door, jf.libraries);
    rec.section(`${jf.restricted.name} — porte « ${door.label} » : routes du cœur`);
    await probeCore(ctx, door, jf.free.id);
    if (tentacle.vigie) {
      rec.section(`${jf.restricted.name} — porte « ${door.label} » : Vigie`);
      await probeVigie(ctx, door, seerr);
    }
  }
  // Watch Together : le compte restreint entre dans un salon après les matchs de l'affinité.
  rec.section(`${jf.restricted.name} — Watch Together : affinité d'un salon mixte`);
  await probeAffinity(ctx, restrictedDoors[0], jf);

  // Une restriction posée par Tentacle vaut sur-le-champ (Vigie compris).
  rec.section(`${jf.restricted.name} — fraîcheur : restriction levée puis remise par la fiche des droits`);
  await probeRestrictionChange(ctx, restrictedDoors[0], adminPersonal, tentacle.vigie);

  // Le passé posé par le banc (historySeed) : les pages l'ont bien lu — les témoins permis y sont.
  const [personal] = restrictedDoors;
  const stats = await probe(ctx, personal, "GET", "/api/stats/me?period=all&tz=Europe/Paris&lang=fr&refresh=1");
  rec.note(HISTORY_WITNESSES.every((name) => stats.text.includes(name)), `${personal.label} · statistiques : les témoins ${HISTORY_WITNESSES.join(", ")} y sont`);
  const notes = await probe(ctx, personal, "GET", "/api/notifications?limit=50");
  rec.note(notes.text.includes("Toy Story est arrivé"), `${personal.label} · notifications : l'avis témoin y est`);

  // Les bibliothèques seules (aucun contrôle parental) : rien de « Séries » ni des « Réservée ».
  const filmsRef = await buildReference(jf, jf.filmsOnly);
  const filmsPersonal = await personalToken(tentacle.url, jf.filmsOnly.name);
  const filmsCtx: JudgeContext = { base: tentacle.url, ref: filmsRef, oracle: null, rec };
  for (const door of [
    { label: `${jf.filmsOnly.name} · personnelle`, token: filmsPersonal },
    { label: `${jf.filmsOnly.name} · TV jumelée`, token: await pairedTvToken(tentacle.url, filmsPersonal, "Apple TV du banc (filmsseuls)") },
  ]) {
    rec.section(`${jf.filmsOnly.name} — porte « ${door.label} »`);
    await probeLibrary(filmsCtx, door, jf.libraries);
    await probeCore(filmsCtx, door, jf.free.id);
    if (tentacle.vigie) await probeVigie(filmsCtx, door, seerr);
  }

  // Un invité de la Famille de `libre`, contrôle parental « 6 ans », ouvert sur une Apple TV.
  const guest = await guestProfileDoor(tentacle.url, { id: jf.free.id, personal: await personalToken(tentacle.url, jf.free.name) }, adminPersonal, {
    maxParentalRating: RESTRICTED_MAX_RATING,
    blockUnratedItems: ["Movie", "Trailer", "Series", "Music", "Book", "LiveTvChannel", "LiveTvProgram", "ChannelContent", "Other"],
    blockedTags: [BLOCKED_TAG],
  });
  // Sans mot de passe, l'invité se lit par la clé d'API, à SON nom : la vue que Jellyfin lui applique.
  const guestRef = await buildReference(jf, { name: "Petit", id: guest.guestId, token: jf.apiKey });
  const guestCtx: JudgeContext = { base: tentacle.url, ref: guestRef, oracle, rec };
  rec.section(`invité « Petit » (≤ ${RESTRICTED_MAX_RATING}) — porte « ${guest.label} »`);
  await probeLibrary(guestCtx, guest, jf.libraries);
  await probeCore(guestCtx, guest, jf.free.id);
  if (tentacle.vigie) await probeVigie(guestCtx, guest, seerr);

  // Témoin : le compte libre voit bien, par les mêmes routes, ce que l'autre ne voit pas.
  rec.section(`${jf.free.name} (témoin)`);
  const free: Door = { label: `${jf.free.name} · personnelle`, token: await personalToken(tentacle.url, jf.free.name) };
  const freeCtx: JudgeContext = { base: tentacle.url, ref: freeRef, oracle: null, rec };
  const all = await probe(freeCtx, free, "GET", `/api/jellyfin/Users/${jf.free.id}/Items?Recursive=true&IncludeItemTypes=Movie,Series`);
  rec.note(itemIdsOf(all.json).length === freeRef.all.filter((i) => i.type === "Movie" || i.type === "Series").length, `${jf.free.name} voit toute la bibliothèque (${itemIdsOf(all.json).length})`);
  await probe(freeCtx, free, "GET", "/api/reco/page", { witness: true });
  await probe(freeCtx, free, "GET", "/api/swipe/deck?limit=40&lang=fr", { witness: true });
  const fight = await probe(freeCtx, free, "GET", "/api/search?q=fight&limit=20", { witness: true });
  rec.note(fight.text.includes("Fight Club"), `${jf.free.name} trouve « Fight Club »`);
  if (tentacle.vigie) await probeVigie(freeCtx, free, seerr, true);

  writeFileSync(join(runDir, "report.txt"), rec.lines.join("\n"));
  log(`${rec.failures === 0 ? "AUCUNE FUITE" : `${rec.failures} ÉCHEC(S)`} — relevé : ${join(runDir, "report.txt")}`);
  return rec.failures;
}
