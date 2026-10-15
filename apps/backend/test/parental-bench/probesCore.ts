/**
 * Les routes du CŒUR qui rendent des titres à un compte (relevé du 2026-10-15,
 * docs/DROITS-UTILISATEURS.md § 7 et § 9.5) : Pour vous, Affiner, recherche,
 * sagas, héros, résolutions TMDB, bandes-annonces et aperçus (sans extraction
 * YouTube : seulement des titres interdits, refusés avant), notifications,
 * statistiques, téléchargements, Ma liste et j'aime par TMDB.
 */

import type { Door } from "./doors";
import { probe, type JudgeContext } from "./judge";

const q = encodeURIComponent;

/** Sagas TMDB : Toy Story (tous publics), The Dark Knight (12), Saw (16/18), Le Roi lion. */
const SAGAS = [10194, 263, 656, 94032];
/** Un titre extérieur classé R / « 12 » chez TMDB (jamais permis à 6 ans). */
const EXTERNAL_FORBIDDEN = { mediaType: "movie", tmdbId: 680 } as const;

async function untilReady(ctx: JudgeContext, door: Door, path: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${ctx.base}${path}`, { headers: { Authorization: `Bearer ${door.token}` } });
    if (res.status !== 503 && res.status !== 202) return;
    await new Promise((ok) => setTimeout(ok, 3000));
  }
}

export async function probeCore(ctx: JudgeContext, door: Door, otherUserId: string): Promise<void> {
  const { ref } = ctx;
  const forbiddenTitles = ref.forbidden.filter((i) => i.type === "Movie" || i.type === "Series");
  const forbiddenTmdb = [...ref.forbiddenTmdb].map((key) => {
    const [mediaType, id] = key.split(":");
    return { mediaType, tmdbId: Number(id) };
  });
  // Un titre extérieur interdit par sa classification : seulement pour un compte sous contrôle parental.
  const outside = ctx.oracle ? [EXTERNAL_FORBIDDEN] : [];

  // Pour vous : le réservoir se construit d'abord (TMDB réel).
  // Déclenchée sans être jugée : elle lit TMDB et peut dépasser la minute.
  await fetch(`${ctx.base}/api/reco/pool/generate`, {
    method: "POST", headers: { Authorization: `Bearer ${door.token}`, "Content-Type": "application/json" }, body: "{}",
    signal: AbortSignal.timeout(300_000),
  }).catch(() => undefined);
  await untilReady(ctx, door, "/api/reco/page");
  await probe(ctx, door, "GET", "/api/reco/page");
  const rows = await probe(ctx, door, "GET", "/api/reco/rows");
  for (const row of ((rows.json as { rows?: Array<{ key?: string }> } | null)?.rows ?? []).slice(0, 12)) {
    if (row.key) await probe(ctx, door, "GET", `/api/reco/rows/${q(row.key)}`);
  }
  for (const path of ["/api/reco/coldstart", "/api/reco/people/search?query=tom", "/api/reco/people/suggestions", "/api/reco/pool/debug"]) {
    await probe(ctx, door, "GET", path);
  }

  // Affiner : la pile, et le verso d'un titre caché (rien, pas même son titre).
  await probe(ctx, door, "GET", "/api/swipe/deck?limit=40&lang=fr");
  for (const t of [...forbiddenTmdb, ...outside]) {
    const res = await probe(ctx, door, "GET", `/api/swipe/details/${t.mediaType}/${t.tmdbId}?lang=fr`);
    ctx.rec.note((res.json as { title?: unknown } | null)?.title == null, `${door.label} · verso ${t.mediaType}:${t.tmdbId} vide`);
  }

  // Recherche : par le nom de chaque titre interdit, épisodes compris.
  for (const term of [...forbiddenTitles.map((t) => t.name.split(/[ ,:']/)[0]), "chute", "saut", "chiots", "asteroid", "toy"]) {
    await probe(ctx, door, "GET", `/api/search?q=${q(term)}&limit=20`);
    if (term.length >= 3) await probe(ctx, door, "GET", `/api/search/episodes?q=${q(term)}&limit=20`);
  }
  await probe(ctx, door, "GET", "/api/search/discover");

  // Sagas TMDB : les volets montrés (membres de la bibliothèque et volets à demander).
  for (const saga of SAGAS) {
    await untilReady(ctx, door, `/api/sagas/${saga}?lang=fr`);
    await probe(ctx, door, "GET", `/api/sagas/${saga}?lang=fr`);
  }

  // Résolutions et bandes-annonces par TMDB : rien pour un titre caché.
  for (const t of [...forbiddenTmdb, ...outside]) {
    const resolved = await probe(ctx, door, "GET", `/api/tmdb/resolve?tmdbId=${t.tmdbId}&mediaType=${t.mediaType}`);
    ctx.rec.note(!(resolved.json as { jellyfinId?: unknown } | null)?.jellyfinId, `${door.label} · résolution ${t.mediaType}:${t.tmdbId} sans id`);
    const trailers = await probe(ctx, door, "GET", `/api/tmdb/trailers?tmdbId=${t.tmdbId}&mediaType=${t.mediaType}`);
    ctx.rec.note(((trailers.json as { videos?: unknown[] } | null)?.videos ?? []).length === 0, `${door.label} · bandes-annonces ${t.mediaType}:${t.tmdbId} : aucune`);
    await probe(ctx, door, "GET", `/api/trailers/catalog?tmdbId=${t.tmdbId}&mediaType=${t.mediaType}`);
    await probe(ctx, door, "GET", `/api/trailers/preview?tmdbId=${t.tmdbId}&mediaType=${t.mediaType}&lang=fr`, { status: [403, 404] });
  }
  const warm = await probe(ctx, door, "POST", "/api/trailers/preview/warm", {}, {
    lang: "fr",
    subjects: [...forbiddenTitles.map((t) => ({ itemId: t.id })), ...[...forbiddenTmdb, ...outside].map((t) => ({ tmdbId: t.tmdbId, mediaType: t.mediaType }))],
  });
  ctx.rec.note(((warm.json as { ready?: unknown[] } | null)?.ready ?? []).length === 0, `${door.label} · aperçus préparés d'avance : aucun pour un titre caché`);

  // Par l'id d'un titre interdit : héros, catalogue d'aperçus, segments, téléchargements.
  for (const t of forbiddenTitles) {
    await probe(ctx, door, "GET", `/api/hero/artwork/${t.id}`, { status: [404] });
    await probe(ctx, door, "GET", `/api/trailers/catalog?itemId=${t.id}`);
    await probe(ctx, door, "GET", `/api/trailers/preview?itemId=${t.id}&lang=fr`, { status: [403, 404] });
    await probe(ctx, door, "GET", `/api/playback/segments/${t.id}`);
    await probe(ctx, door, "GET", `/api/downloads/original/${t.id}`, { status: [401, 403, 404] });
    await probe(ctx, door, "GET", `/api/downloads/light/${t.id}?preset=p720`, { status: [401, 403, 404] });
  }

  // Ce que le compte a gardé de lui : rien d'interdit ne doit revenir par là.
  for (const path of [
    "/api/preferences/home-layout", "/api/notifications?limit=50", "/api/stats/me?period=all&tz=Europe/Paris&lang=fr",
    "/api/likes", "/api/ratings", "/api/preferences/items", `/api/leaderboard/${otherUserId}/top-series`,
    "/api/watch-together/invites", "/api/watch-together/affinity",
  ]) {
    await probe(ctx, door, "GET", path);
  }
}
