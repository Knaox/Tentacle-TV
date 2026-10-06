import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import { homeRowCatalog, isKnownHomeRowKey, serverHomeRowCapabilities } from "../services/homeRowCatalog";
import type { HomeRowDescriptor } from "../services/homeRowCatalog";
import { notifyPreferencesUpdate } from "./preferences.notify";
import { isFixedHeroItemVisible } from "../services/fixedHeroItem";

// Clés de rangées admises : celles du catalogue — TOUTES, quel que soit l'état
// des capacités du moment — et les bibliothèques dynamiques (`library:<guid>`).
const rowKeySchema = z.string().max(80).refine(isKnownHomeRowKey, { message: "unknown row key" });

const layoutSchema = z.object({
  heroMode: z.enum(["resume", "random", "reco", "fixed"]),
  heroFixedItemId: z.string().max(64).nullish(),
  rows: z.array(z.object({ key: rowKeySchema, enabled: z.boolean() })).max(60),
  cardDensity: z.enum(["compact", "normal", "large"]),
});

export type HomeLayoutPayload = z.infer<typeof layoutSchema>;

/**
 * Défaut = l'accueil RECOMMANDÉ : héros « Sélectionné pour vous » et les
 * rangées du catalogue dans leur état par défaut — « Pour vous » active avec
 * une clé TMDB, les deux rangées génériques à sa place sans. Ne concerne que
 * les comptes SANS mise en page stockée — une ligne existante garde le choix
 * de l'utilisateur, au champ près. Les bibliothèques sont dynamiques : le
 * client les réconcilie (ancrées avant « Déjà visionné » sur ce défaut,
 * ajoutées en fin sur un layout stocké). Le client retombe sur la bannière de
 * reprise tant que la reco n'a rien à montrer.
 */
export function defaultHomeLayout(catalog: HomeRowDescriptor[]): HomeLayoutPayload {
  return { heroMode: "reco", heroFixedItemId: null, rows: catalog, cardDensity: "normal" };
}

/** GET /home-layout — jamais 404 : défauts servis (`stored: false`), et le
 *  CATALOGUE des rangées que ce serveur sait afficher (l'éditeur ne propose
 *  que lui, l'accueil n'en rend pas d'autre).
 *  PUT /home-layout — remplace la mise en page entière (elle est UNE donnée). */
export function registerHomeLayoutRoutes(app: FastifyInstance): void {
  app.get("/home-layout", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const catalog = homeRowCatalog(serverHomeRowCapabilities());
    const row = await prisma.homeLayout.findUnique({ where: { jellyfinUserId: user.userId } });
    if (!row) return { stored: false, layout: defaultHomeLayout(catalog), catalog };
    let rows: HomeLayoutPayload["rows"] = catalog;
    try {
      rows = JSON.parse(row.rows) as HomeLayoutPayload["rows"];
    } catch {
      // JSON illisible : le catalogue — la prochaine sauvegarde réécrit proprement.
    }
    // Titre fixe effacé de Jellyfin ou caché au compte : le héros est servi en
    // « reprise ». Les clients livrés (le bureau, l'app du Microsoft Store)
    // rendaient sinon une bannière NOIRE, sans titre ni bouton. Rien n'est
    // réécrit : le titre revenu (bibliothèque rouverte), le choix revient.
    const fixedMissing =
      row.heroMode === "fixed" &&
      !!row.heroFixedItemId &&
      (await isFixedHeroItemVisible(user.userId, row.heroFixedItemId)) === false;
    return {
      stored: true,
      layout: {
        heroMode: fixedMissing ? "resume" : row.heroMode,
        heroFixedItemId: row.heroFixedItemId,
        rows,
        cardDensity: row.cardDensity,
      },
      ...(fixedMissing ? { heroFixedMissing: true } : {}),
      catalog,
    };
  });

  app.put("/home-layout", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const layout = layoutSchema.parse(request.body);
    const prisma = getPrisma();
    const data = {
      heroMode: layout.heroMode,
      heroFixedItemId: layout.heroFixedItemId ?? null,
      rows: JSON.stringify(layout.rows),
      cardDensity: layout.cardDensity,
    };
    await prisma.homeLayout.upsert({
      where: { jellyfinUserId: user.userId },
      create: { jellyfinUserId: user.userId, ...data },
      update: data,
    });
    // Les autres appareils du compte relisent l'accueil en direct.
    notifyPreferencesUpdate(request, user.userId, "home-layout");
    return { ok: true };
  });
}
