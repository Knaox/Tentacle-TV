/**
 * POST /api/preferences/resolve — quelles pistes audio et de sous-titres lancer ?
 *
 * Extrait de `preferences.ts` (limite de 300 lignes) avec ses fonctions
 * d'appariement de langues (`preferences.lang.ts`).
 *
 * # Ordre de priorité, du plus précis au plus large
 *
 *   1. le CONTENU lui-même (`itemId`) — ce que l'utilisateur a choisi la dernière
 *      fois qu'il a regardé CE film ou CET épisode, enregistré automatiquement ;
 *   2. la saison, puis la série, puis les ancêtres (`libraryIds`, dans l'ordre
 *      d'envoi par le client) ;
 *   3. la bibliothèque ;
 *   4. à défaut, la piste marquée par défaut dans le conteneur.
 *
 * Le premier niveau trouvé gagne et l'on s'arrête là. `itemId` est OPTIONNEL :
 * les clients mobile et TV ne l'envoient pas encore, et continuent donc de se
 * comporter exactement comme avant.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import { ALIAS_MAP, isForcedTrack, langMatches, parseVariant, variantMatchesTitle } from "./preferences.lang";

const resolveSchema = z.object({
  libraryId: z.string().min(1),
  libraryIds: z.array(z.string()).optional(),
  /** Contenu en cours — sa préférence propre bat toutes les autres. */
  itemId: z.string().max(255).optional(),
  audioTracks: z.array(z.object({
    index: z.number(),
    language: z.string().optional(),
    isDefault: z.boolean().optional(),
    title: z.string().optional(),
  })).default([]),
  subtitleTracks: z.array(z.object({
    index: z.number(),
    language: z.string().optional(),
    isForced: z.boolean().optional(),
    title: z.string().optional(),
  })).default([]),
});

type ResolveBody = z.infer<typeof resolveSchema>;

/** Ce que les deux tables ont en commun — tout ce dont la résolution a besoin. */
interface TrackPreference {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: string;
}

export function registerResolveRoute(app: FastifyInstance): void {
  app.post("/resolve", async (request, reply) => {
    let body: ResolveBody;
    try {
      body = resolveSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ message: "Invalid request body", error: String(err) });
    }
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    let pref: TrackPreference | null = null;

    // 1) Le contenu lui-même.
    if (body.itemId) {
      pref = await prisma.itemTrackPreference.findUnique({
        where: { jellyfinUserId_itemId: { jellyfinUserId: user.userId, itemId: body.itemId } },
      });
      if (pref) app.log.info({ itemId: body.itemId }, "[resolve] préférence propre au contenu");
    }

    // 2) Saison, série, ancêtres, bibliothèque — le premier trouvé gagne. Pas de
    // repli au-delà : le client envoie tous les ancêtres, donc une préférence
    // existante est forcément dans la liste.
    if (!pref) {
      for (const lid of [body.libraryId, ...(body.libraryIds ?? [])].filter(Boolean)) {
        pref = await prisma.libraryPreference.findUnique({
          where: { jellyfinUserId_libraryId: { jellyfinUserId: user.userId, libraryId: lid } },
        });
        if (pref) break;
      }
    }

    if (!pref) {
      return {
        audioIndex: body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null,
        subtitleIndex: null,
      };
    }

    // L'audio d'abord : le mode « forcés » retombe sur SA langue quand aucune
    // langue de sous-titres n'est exprimée.
    const audioIndex = resolveAudio(app, body, pref);
    return { audioIndex, subtitleIndex: resolveSubtitle(app, body, pref, audioIndex) };
  });
}

/**
 * Piste audio : la langue préférée d'abord, la piste par défaut ensuite.
 * Gère les codes à variante (« fre-vff », « fre-vfq ») et le repli sur le titre,
 * certains serveurs laissant le champ de langue vide.
 */
function resolveAudio(app: FastifyInstance, body: ResolveBody, pref: TrackPreference): number | null {
  let audioIndex = body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null;
  if (!pref.audioLang) return audioIndex;

  const [baseLang, variant] = parseVariant(pref.audioLang);
  const langGroup = ALIAS_MAP.get(baseLang.toLowerCase());
  const allAliases = langGroup ? [...langGroup] : [baseLang.toLowerCase()];

  let langCandidates = body.audioTracks.filter((t) => langMatches(t.language, baseLang));
  if (langCandidates.length === 0) {
    langCandidates = body.audioTracks.filter((t) =>
      t.title && allAliases.some((alias) => t.title!.toLowerCase().includes(alias)),
    );
  }

  app.log.info({
    baseLang, variant, prefAudioLang: pref.audioLang,
    candidates: langCandidates.map((t) => ({ idx: t.index, lang: t.language, title: t.title })),
  }, "[resolve] audio matching");

  if (variant && langCandidates.length > 0) {
    const variantMatch = langCandidates.find((t) => variantMatchesTitle(t.title, variant));
    app.log.info({
      variant, matchedIndex: variantMatch?.index ?? null, fallbackIndex: langCandidates[0].index,
    }, "[resolve] variant match");
    audioIndex = variantMatch?.index ?? langCandidates[0].index;
  } else if (langCandidates.length > 0) {
    audioIndex = langCandidates[0].index;
  }
  return audioIndex;
}

/**
 * Sous-titre, selon le mode.
 *  • `-1` = désactiver explicitement (Jellyfin ne doit pas en choisir un) ;
 *  • `null` = aucune préférence exprimée.
 */
function resolveSubtitle(
  app: FastifyInstance,
  body: ResolveBody,
  pref: TrackPreference,
  audioIndex: number | null,
): number | null {
  if (pref.subtitleMode === "none") return -1;

  if (pref.subtitleMode === "forced") {
    // Langue de sous-titres préférée → langue de la piste audio retenue →
    // n'importe quelle forcée. (Auparavant : la seule langue préférée, donc
    // presque jamais de sélection quand `subtitleLang` était absent.)
    const inPrefLang = pref.subtitleLang
      ? body.subtitleTracks.filter((t) => isForcedTrack(t) && langMatches(t.language, pref.subtitleLang!))
      : [];
    const audioLang = body.audioTracks.find((t) => t.index === audioIndex)?.language;
    const inAudioLang = audioLang
      ? body.subtitleTracks.filter((t) => isForcedTrack(t) && langMatches(t.language, audioLang))
      : [];
    const anyForced = body.subtitleTracks.filter(isForcedTrack);
    const pick = inPrefLang[0] ?? inAudioLang[0] ?? anyForced[0];
    app.log.info({
      inPrefLang: inPrefLang.length, inAudioLang: inAudioLang.length,
      anyForced: anyForced.length, picked: pick ? pick.index : -1,
    }, "[resolve] forced subtitles");
    return pick ? pick.index : -1;
  }

  if (!pref.subtitleLang) return null;

  const subLangGroup = ALIAS_MAP.get(pref.subtitleLang.toLowerCase());
  const subAliases = subLangGroup ? [...subLangGroup] : [pref.subtitleLang.toLowerCase()];
  let subs = body.subtitleTracks.filter((t) => langMatches(t.language, pref.subtitleLang!));
  if (subs.length === 0) {
    subs = body.subtitleTracks.filter((t) =>
      t.title && subAliases.some((alias) => t.title!.toLowerCase().includes(alias)),
    );
  }
  const nonForced = subs.filter((t) => !isForcedTrack(t));
  const forced = subs.filter(isForcedTrack);

  if (pref.subtitleMode === "signs") {
    const signs = subs.find((t) =>
      t.title?.toLowerCase().includes("sign") || t.title?.toLowerCase().includes("songs"),
    );
    if (signs) return signs.index;
    return forced.length > 0 ? forced[0].index : -1;
  }

  if (pref.subtitleMode === "always") {
    // La piste complète d'abord ; la forcée seulement en dernier recours.
    if (nonForced.length > 0) return nonForced[0].index;
    return forced.length > 0 ? forced[0].index : -1;
  }

  return null;
}
