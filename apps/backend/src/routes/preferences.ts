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

  // POST /api/preferences/resolve — Resolve best tracks for a media item
  app.post("/resolve", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const body = request.body as {
      libraryId: string;
      libraryIds?: string[];
      audioTracks: Array<{ index: number; language?: string; isDefault?: boolean }>;
      subtitleTracks: Array<{ index: number; language?: string; isForced?: boolean; title?: string }>;
    };

    // Try exact match first, then any of the provided IDs, then any user preference
    const candidates = [body.libraryId, ...(body.libraryIds ?? [])].filter(Boolean);
    let pref = null;

    for (const lid of candidates) {
      pref = await prisma.libraryPreference.findUnique({
        where: { jellyfinUserId_libraryId: { jellyfinUserId: user.userId, libraryId: lid } },
      });
      if (pref) break;
    }

    // Fallback: use any preference the user has set
    if (!pref) {
      pref = await prisma.libraryPreference.findFirst({
        where: { jellyfinUserId: user.userId },
      });
    }

    // No preference set — use defaults
    if (!pref) {
      return {
        audioIndex: body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null,
        subtitleIndex: null,
      };
    }

    // Resolve audio: prefer matching language, fallback to default
    let audioIndex = body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null;
    if (pref.audioLang) {
      const match = body.audioTracks.find((t) => langMatches(t.language, pref.audioLang!));
      if (match) audioIndex = match.index;
    }

    // Resolve subtitle based on mode
    // -1 = explicitly disable subtitles (tells Jellyfin not to auto-select)
    // null = no preference set
    let subtitleIndex: number | null = null;
    if (pref.subtitleMode === "none") {
      subtitleIndex = -1;
    } else if (pref.subtitleLang) {
      const subs = body.subtitleTracks.filter((t) => langMatches(t.language, pref.subtitleLang!));
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
