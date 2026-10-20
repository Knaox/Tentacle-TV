/**
 * Les requêtes PROPRES à l'app mobile (lot du 20/10, « mobile = bureau ») : le
 * verdict des titres gardés hors ligne (`/api/library/visibility` — un titre
 * interdit n'y est jamais « visible », même gardé avant la restriction), les
 * droits que lit l'app pour ne pas proposer un geste refusé (partage public,
 * Watch Together, lecture, accès du compte, extensions), et les notes TMDB des
 * épisodes d'une série interdite. Le juge lit chaque réponse : aucun nom
 * d'un titre interdit ; un identifiant n'est permis qu'en écho de la requête.
 */

import type { Door } from "./doors";
import { probe, type JudgeContext } from "./judge";
import { norm } from "./reference";

/** Au plus autant d'ids par demande (`LIBRARY_VISIBILITY_MAX_ITEMS`). */
const CHUNK = 200;

export async function probeMobile(ctx: JudgeContext, door: Door): Promise<void> {
  const { ref } = ctx;
  // Ce qu'un appareil aurait pu garder AVANT la restriction : films et épisodes interdits, et des permis.
  const forbidden = ref.forbidden.filter((i) => i.type === "Movie" || i.type === "Episode").map((i) => i.id);
  const allowed = ref.all.filter((i) => (i.type === "Movie" || i.type === "Episode") && ref.visible.has(norm(i.id))).map((i) => i.id);
  const kept = [...forbidden, ...allowed.slice(0, 20)].slice(0, CHUNK);
  const verdict = await probe(ctx, door, "POST", "/api/library/visibility", { status: [200] }, { itemIds: kept });
  const visible = new Set(((verdict.json as { visible?: string[] } | null)?.visible ?? []).map(norm));
  const wrongly = forbidden.filter((id) => visible.has(norm(id)));
  ctx.rec.note(wrongly.length === 0, `${door.label} · titres gardés : aucun titre interdit jugé lisible (${forbidden.length} interdits, ${wrongly.length} lisibles)`);
  const witnesses = allowed.slice(0, 20);
  ctx.rec.note(witnesses.every((id) => visible.has(norm(id))), `${door.label} · titres gardés : les ${witnesses.length} titres permis restent lisibles`);

  // Ce que l'app lit pour ne pas proposer un geste refusé (statuts seulement, et rien d'interdit dedans).
  for (const path of ["/api/share/access", "/api/watch-together/access", "/api/playback/rights", "/api/account/access", "/api/plugins/active"]) {
    await probe(ctx, door, "GET", path, { status: [200, 403] });
  }

  // Les notes TMDB des épisodes d'une série interdite : jamais un nom.
  const series = ref.forbidden.find((i) => i.type === "Series" && i.tmdbKey);
  if (series?.tmdbKey) {
    await probe(ctx, door, "GET", `/api/tmdb/tv/${series.tmdbKey.split(":")[1]}/season/1/episodes`);
  }
}
