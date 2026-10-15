/**
 * La fraîcheur : une restriction posée par Tentacle (fiche des droits de
 * l'administration) vaut SUR-LE-CHAMP — sans attendre la relecture de 30 s.
 * Le compte, un temps libre, demande Pulp Fiction et Game of Thrones par Vigie
 * et lit un verso ; la restriction revient ; plus rien n'en paraît : « Mes
 * demandes », titres attendus, avancement, calendrier, verso, avis.
 */

import { call, type Door } from "./doors";
import { BLOCKED_TAG, RESTRICTED_MAX_RATING } from "./catalog";
import { probe, type JudgeContext } from "./judge";

const S = "/api/plugins/seer";
const ALL_UNRATED = ["Movie", "Trailer", "Series", "Music", "Book", "LiveTvChannel", "LiveTvProgram", "ChannelContent", "Other"];

export async function probeRestrictionChange(ctx: JudgeContext, door: Door, adminPersonal: string, vigie: boolean): Promise<void> {
  const rights = `/api/admin/users/${ctx.ref.account.id}/rights`;
  const lifted = await call(ctx.base, adminPersonal, "PATCH", rights, { maxParentalRating: null, blockUnratedItems: [], blockedTags: [] });
  ctx.rec.note(lifted.status === 200, `restriction levée par la fiche des droits → ${lifted.status}`);
  try {
    const verso = await call(ctx.base, door.token, "GET", "/api/swipe/details/movie/680?lang=fr");
    ctx.rec.note((verso.json as { title?: unknown } | null)?.title != null, `${door.label} · libre un temps : le verso de Pulp Fiction se lit`);
    if (vigie) {
      const movie = await call(ctx.base, door.token, "POST", `${S}/requests`, { mediaType: "movie", tmdbId: 680, title: "Pulp Fiction" });
      const tv = await call(ctx.base, door.token, "POST", `${S}/titles/request`, { mediaType: "tv", tmdbId: 1399, lang: "fr", seasons: [1] });
      ctx.rec.note(movie.status < 300 && (tv.json as { ok?: boolean } | null)?.ok === true,
        `${door.label} · libre un temps : demandes de Pulp Fiction (${movie.status}) et Game of Thrones acceptées`);
      // Le témoin : « Mes demandes » les montre bien tant que le compte est libre.
      const mine = await call(ctx.base, door.token, "GET", `${S}/requests`);
      ctx.rec.note(/"tmdbId":\s*680\b/.test(mine.text), `${door.label} · libre un temps : « Mes demandes » montre Pulp Fiction`);
    }
  } finally {
    const restored = await call(ctx.base, adminPersonal, "PATCH", rights, {
      maxParentalRating: RESTRICTED_MAX_RATING, blockUnratedItems: ALL_UNRATED, blockedTags: [BLOCKED_TAG],
    });
    ctx.rec.note(restored.status === 200, `restriction remise par la fiche des droits → ${restored.status}`);
  }
  // Aussitôt, sans attendre : plus rien de ces titres.
  const verso = await probe(ctx, door, "GET", "/api/swipe/details/movie/680?lang=fr");
  ctx.rec.note((verso.json as { title?: unknown } | null)?.title == null, `${door.label} · restriction remise : le verso de Pulp Fiction est vide AUSSITÔT`);
  if (!vigie) return;
  for (const path of ["/requests", "/titles/mine", "/titles/mine?origin=tv", "/requests/progress", "/calendar/personal", "/requests/stats"]) {
    const res = await probe(ctx, door, "GET", `${S}${path}`);
    ctx.rec.note(!/"tmdbId":\s*(680|1399)\b|Pulp Fiction|Game of Thrones/.test(res.text), `${door.label} · ${path} : ni Pulp Fiction ni Game of Thrones`);
  }
}
