import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";

const upsertSchema = z.object({
  libraryId: z.string().min(1),
  audioLang: z.string().max(10).nullable().optional(),
  subtitleLang: z.string().max(10).nullable().optional(),
  subtitleMode: z.enum(["none", "always", "forced", "signs"]).default("none"),
});

// Language alias groups — ISO 639-1 (2-letter), ISO 639-2/B and /T (3-letter), display names.
// Jellyfin uses inconsistent language codes; this ensures robust matching.
const LANG_GROUPS: string[][] = [
  ["fr", "fre", "fra", "french", "français", "francais"],
  ["en", "eng", "english"],
  ["ja", "jp", "jpn", "jap", "japanese", "japonais"],
  ["de", "ger", "deu", "german", "allemand"],
  ["es", "spa", "spanish", "espagnol"],
  ["it", "ita", "italian", "italien"],
  ["pt", "por", "portuguese", "portugais"],
  ["ru", "rus", "russian", "russe"],
  ["ko", "kor", "korean", "coréen"],
  ["zh", "chi", "zho", "chinese", "chinois"],
  ["ar", "ara", "arabic", "arabe"],
  ["pl", "pol", "polish", "polonais"],
  ["nl", "dut", "nld", "dutch", "néerlandais"],
  ["cs", "cze", "ces", "czech", "tchèque"],
  ["hi", "hin", "hindi"],
  ["th", "tha", "thai"],
  ["sv", "swe", "swedish", "suédois"],
  ["no", "nor", "nob", "nno", "norwegian", "norvégien"],
  ["fi", "fin", "finnish", "finnois"],
  ["tr", "tur", "turkish", "turc"],
  ["hu", "hun", "hungarian", "hongrois"],
  ["ro", "ron", "rum", "romanian", "roumain"],
  ["el", "gre", "ell", "greek", "grec"],
  ["da", "dan", "danish", "danois"],
  ["he", "heb", "hebrew", "hébreu"],
  ["vi", "vie", "vietnamese", "vietnamien"],
  ["id", "ind", "indonesian", "indonésien"],
  ["ms", "may", "msa", "malay", "malais"],
  ["uk", "ukr", "ukrainian", "ukrainien"],
  ["bg", "bul", "bulgarian", "bulgare"],
  ["hr", "hrv", "croatian", "croate"],
  ["sr", "srp", "scc", "serbian", "serbe"],
  ["ca", "cat", "catalan"],
  ["ta", "tam", "tamil", "tamoul"],
  ["te", "tel", "telugu", "télougou"],
  ["fa", "per", "fas", "persian", "persan"],
  ["sk", "slo", "slk", "slovak", "slovaque"],
  ["sl", "slv", "slovenian", "slovène"],
  ["lt", "lit", "lithuanian", "lituanien"],
  ["lv", "lav", "latvian", "letton"],
  ["et", "est", "estonian", "estonien"],
  ["ml", "mal", "malayalam"],
  ["bn", "ben", "bengali"],
  ["ur", "urd", "urdu"],
  ["tl", "fil", "tagalog", "filipino"],
];

const ALIAS_MAP = new Map<string, Set<string>>();
for (const group of LANG_GROUPS) {
  const s = new Set(group);
  for (const code of group) ALIAS_MAP.set(code, s);
}

function langMatches(trackLang: string | undefined, prefLang: string): boolean {
  if (!trackLang) return false;
  const tl = trackLang.toLowerCase();
  const pl = prefLang.toLowerCase();
  if (tl === pl) return true;
  const group = ALIAS_MAP.get(pl);
  return group?.has(tl) ?? false;
}

/** Split a variant-aware language code: "fre-vff" → ["fre", "vff"], "jpn" → ["jpn", null]. */
function parseVariant(code: string): [string, string | null] {
  const idx = code.indexOf("-");
  if (idx < 0) return [code, null];
  return [code.substring(0, idx), code.substring(idx + 1)];
}

/**
 * Variant alias patterns — matches variant tags against common title patterns.
 * Jellyfin track titles may use full names ("Français (France)") instead of tags ("VFF").
 */
const VARIANT_ALIASES: Record<string, string[]> = {
  vff: ["vff", "france", "français (france)", "french (france)", "vf "],
  vfq: ["vfq", "québec", "quebec", "québécois", "quebecois", "canada", "canadien", "français (canada)", "french (canada)"],
  vfi: ["vfi", "international"],
  vf: ["vf"],
};

function variantMatchesTitle(title: string | undefined, variant: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  const aliases = VARIANT_ALIASES[variant.toLowerCase()];
  if (aliases) {
    return aliases.some((alias) => lower.includes(alias));
  }
  return lower.includes(variant.toLowerCase());
}

export const preferenceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/preferences — List all user preferences
  app.get("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const prefs = await prisma.libraryPreference.findMany({
      where: { jellyfinUserId: user.userId },
    });

    return prefs;
  });

  // GET /api/preferences/:libraryId — Get preference for a specific library
  app.get("/:libraryId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { libraryId } = request.params as { libraryId: string };

    const pref = await prisma.libraryPreference.findUnique({
      where: {
        jellyfinUserId_libraryId: {
          jellyfinUserId: user.userId,
          libraryId,
        },
      },
    });

    if (!pref) {
      return reply.status(404).send({ message: "No preference found" });
    }

    return pref;
  });

  // PUT /api/preferences — Upsert a library preference
  app.put("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const body = upsertSchema.parse(request.body);

    const pref = await prisma.libraryPreference.upsert({
      where: {
        jellyfinUserId_libraryId: {
          jellyfinUserId: user.userId,
          libraryId: body.libraryId,
        },
      },
      create: {
        jellyfinUserId: user.userId,
        libraryId: body.libraryId,
        audioLang: body.audioLang ?? null,
        subtitleLang: body.subtitleLang ?? null,
        subtitleMode: body.subtitleMode,
      },
      update: {
        audioLang: body.audioLang ?? null,
        subtitleLang: body.subtitleLang ?? null,
        subtitleMode: body.subtitleMode,
      },
    });

    return pref;
  });

  // DELETE /api/preferences/:libraryId — Delete a library preference
  app.delete("/:libraryId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { libraryId } = request.params as { libraryId: string };

    try {
      await prisma.libraryPreference.delete({
        where: {
          jellyfinUserId_libraryId: {
            jellyfinUserId: user.userId,
            libraryId,
          },
        },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({ message: "Preference not found" });
    }
  });

  // GET /api/preferences/language — Get user's interface language
  app.get("/language", async (request, reply) => {
    try {
      const prisma = getPrisma();
      const user = (request as any).user as JellyfinUser;
      const key = `user_lang_${user.userId}`;

      const row = await prisma.serverConfig.findUnique({ where: { key } });
      return { language: row?.value ?? null };
    } catch (err) {
      app.log.error(err, "[preferences/language] Error fetching user language");
      return reply.status(500).send({ message: "Failed to fetch language preference" });
    }
  });

  // PUT /api/preferences/language — Set user's interface language
  app.put("/language", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { language } = z.object({ language: z.string().max(5) }).parse(request.body);
    const key = `user_lang_${user.userId}`;

    await prisma.serverConfig.upsert({
      where: { key },
      create: { key, value: language },
      update: { value: language },
    });

    return { language };
  });

  // POST /api/preferences/resolve — Resolve best tracks for a media item
  const resolveSchema = z.object({
    libraryId: z.string().min(1),
    libraryIds: z.array(z.string()).optional(),
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

  app.post("/resolve", async (request, reply) => {
    let body: z.infer<typeof resolveSchema>;
    try {
      body = resolveSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ message: "Invalid request body", error: String(err) });
    }
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    // Try exact match first, then any of the provided IDs, then any user preference
    const candidates = [body.libraryId, ...(body.libraryIds ?? [])].filter(Boolean);
    let pref = null;

    for (const lid of candidates) {
      pref = await prisma.libraryPreference.findUnique({
        where: { jellyfinUserId_libraryId: { jellyfinUserId: user.userId, libraryId: lid } },
      });
      if (pref) break;
    }

    // No fallback — if none of the candidate IDs match a stored preference,
    // return defaults. The frontend now sends all ancestor IDs, so a match
    // should always occur if the user has set preferences for that library.

    // No preference set — use defaults
    if (!pref) {
      return {
        audioIndex: body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null,
        subtitleIndex: null,
      };
    }

    // Resolve audio: prefer matching language, fallback to default.
    // Supports variant codes like "fre-vff" or "fre-vfq" — splits into base lang + variant tag.
    let audioIndex = body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null;
    if (pref.audioLang) {
      const [baseLang, variant] = parseVariant(pref.audioLang);
      // Match by language code first, then by title (some servers have empty Language field)
      const langGroup = ALIAS_MAP.get(baseLang.toLowerCase());
      const allAliases = langGroup ? [...langGroup] : [baseLang.toLowerCase()];
      let langCandidates = body.audioTracks.filter((t) => langMatches(t.language, baseLang));
      if (langCandidates.length === 0) {
        // Fallback: match language aliases in track title
        langCandidates = body.audioTracks.filter((t) =>
          t.title && allAliases.some((alias) => t.title!.toLowerCase().includes(alias))
        );
      }
      app.log.info({ baseLang, variant, prefAudioLang: pref.audioLang,
        candidates: langCandidates.map((t) => ({ idx: t.index, lang: t.language, title: t.title })),
      }, "[resolve] audio matching");
      if (variant && langCandidates.length > 0) {
        const variantMatch = langCandidates.find((t) => variantMatchesTitle(t.title, variant));
        app.log.info({ variant, matchedIndex: variantMatch?.index ?? null, fallbackIndex: langCandidates[0].index }, "[resolve] variant match");
        audioIndex = variantMatch?.index ?? langCandidates[0].index;
      } else if (langCandidates.length > 0) {
        audioIndex = langCandidates[0].index;
      }
    }

    // Resolve subtitle based on mode
    // -1 = explicitly disable subtitles (tells Jellyfin not to auto-select)
    // null = no preference set
    let subtitleIndex: number | null = null;
    if (pref.subtitleMode === "none") {
      subtitleIndex = -1;
    } else if (pref.subtitleLang) {
      const subLangGroup = ALIAS_MAP.get(pref.subtitleLang.toLowerCase());
      const subAliases = subLangGroup ? [...subLangGroup] : [pref.subtitleLang.toLowerCase()];
      let subs = body.subtitleTracks.filter((t) => langMatches(t.language, pref.subtitleLang!));
      if (subs.length === 0) {
        subs = body.subtitleTracks.filter((t) =>
          t.title && subAliases.some((alias) => t.title!.toLowerCase().includes(alias))
        );
      }
      const nonForced = subs.filter((t) => !t.isForced);
      const forced = subs.filter((t) => !!t.isForced);

      if (pref.subtitleMode === "forced") {
        // ONLY forced subs — if none exist, explicitly disable (never fallback to non-forced)
        subtitleIndex = forced.length > 0 ? forced[0].index : -1;
      } else if (pref.subtitleMode === "signs") {
        const signs = subs.find((t) =>
          t.title?.toLowerCase().includes("sign") ||
          t.title?.toLowerCase().includes("songs")
        );
        if (signs) subtitleIndex = signs.index;
        else if (forced.length > 0) subtitleIndex = forced[0].index;
        else subtitleIndex = -1;
      } else if (pref.subtitleMode === "always") {
        // Prefer non-forced (full) subs; only use forced as last resort
        if (nonForced.length > 0) subtitleIndex = nonForced[0].index;
        else if (forced.length > 0) subtitleIndex = forced[0].index;
        else subtitleIndex = -1;
      }
    }

    return { audioIndex, subtitleIndex };
  });
};
