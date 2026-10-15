/**
 * Vigie, installée depuis son dépôt, devant le faux Jellyseerr du banc (titres
 * aux VRAIS identifiants TMDB, classifications réelles relues par le cœur) :
 * découverte, tendances, recherche, fiche, semblables, saga, filmographie,
 * contrat `titles` des cartes et de la TV, demandes. Un compte restreint n'y voit
 * aucun titre que l'oracle refuse et ne peut pas en demander un ; le compte
 * libre (témoin) reçoit les listes entières.
 */

import { EXTERNALS } from "./catalog";
import type { Door } from "./doors";
import type { FakeSeerr } from "./fakeSeerr";
import { probe, type JudgeContext } from "./judge";

const S = "/api/plugins/seer";
const q = encodeURIComponent;

export async function probeVigie(ctx: JudgeContext, door: Door, seerr: FakeSeerr, witness = false): Promise<void> {
  const expect = witness ? { witness: true } : {};
  const libraryKeys = ctx.ref.all.flatMap((i) => (i.tmdbKey ? [i.tmdbKey] : []));
  const allKeys = [...new Set([...libraryKeys, ...EXTERNALS.map((e) => `${e.mediaType}:${e.tmdbId}`)])];
  // Pulp Fiction et Game of Thrones : interdits par leur classification, sous contrôle parental seulement.
  const refused = allKeys.filter((key) => ctx.ref.forbiddenTmdb.has(key)).concat(ctx.oracle ? ["movie:680", "tv:1399"] : []);

  for (const path of [
    "/seerr/api/v1/discover/movies?page=1&_lang=fr", "/seerr/api/v1/discover/movies?page=2&_lang=fr",
    "/seerr/api/v1/discover/tv?page=1&_lang=fr", "/seerr/api/v1/discover/trending?page=1&_lang=fr",
    "/seerr/api/v1/movie/862/similar?page=1&_lang=fr", "/seerr/api/v1/tv/82728/similar?page=1&_lang=fr",
    "/seerr/api/v1/collection/10194?_lang=fr", "/seerr/api/v1/person/1/combined_credits?_lang=fr",
    ...["a", "e", "pulp", "fight", "prince", "patrouille", "game"].flatMap((term) => [
      `/seerr/api/v1/search?query=${q(term)}&page=1&_lang=fr`, `/search?q=${q(term)}&lang=fr`, `/search/provider?q=${q(term)}&lang=fr`,
    ]),
    "/search/collection?tmdb=10194&lang=fr",
    `/titles/gaps?keys=${q(allKeys.filter((k) => k.startsWith("tv:")).join(","))}&lang=fr`,
    "/titles/mine", "/requests", "/requests/progress", "/calendar/personal", "/calendar/personal?everyone=1",
  ]) {
    await probe(ctx, door, "GET", `${S}${path}`, expect);
  }
  if (witness) return;

  // La fiche, les saisons et la pastille d'un titre interdit : rien.
  for (const key of refused) {
    const [mediaType, id] = key.split(":");
    await probe(ctx, door, "GET", `${S}/seerr/api/v1/${mediaType}/${id}?_lang=fr`, { status: [403, 404] });
    if (mediaType === "tv") {
      await probe(ctx, door, "GET", `${S}/seerr/api/v1/tv/${id}/season/1?_lang=fr`, { status: [403, 404] });
      const seasons = await probe(ctx, door, "GET", `${S}/titles/seasons?key=${key}&lang=fr`);
      ctx.rec.note(!JSON.stringify(seasons.json ?? {}).includes("seasonNumber"), `${door.label} · saisons de ${key} : aucune`);
    }
  }
  const state = await probe(ctx, door, "GET", `${S}/titles/state?keys=${q(allKeys.join(","))}&lang=fr`);
  const items = (state.json as { items?: Record<string, { badge?: unknown; request?: unknown; page?: unknown }> } | null)?.items ?? {};
  const shown = refused.filter((key) => items[key] && (items[key].badge || items[key].request || items[key].page));
  ctx.rec.note(shown.length === 0, `${door.label} · pastilles et gestes des titres interdits : ${shown.length ? `FUITE ${shown.join(", ")}` : "aucun"}`);

  // Demander un titre interdit : refusé par Vigie, rien n'arrive chez Jellyseerr.
  const before = await seerr.requestCount();
  for (const key of refused) {
    const [mediaType, id] = key.split(":");
    const card = await probe(ctx, door, "POST", `${S}/titles/request`, {}, { mediaType, tmdbId: Number(id), lang: "fr", seasons: mediaType === "tv" ? [1] : undefined });
    ctx.rec.note((card.json as { ok?: boolean } | null)?.ok !== true, `${door.label} · demande (carte) de ${key} refusée`);
    await probe(ctx, door, "POST", `${S}/requests`, { status: [400, 403] }, { mediaType, tmdbId: Number(id), title: key, seasons: mediaType === "tv" ? [1] : undefined });
  }
  const sent = (await seerr.requestCount()) - before;
  ctx.rec.note(sent === 0, `${door.label} · aucune demande d'un titre interdit chez Jellyseerr (${sent})`);
}
