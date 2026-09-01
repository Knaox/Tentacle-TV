import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";

// Clés de rangées admises : les quatre historiques, les rangées de
// recommandation, et les bibliothèques dynamiques (`library:<guid>`).
const rowKeySchema = z
  .string()
  .max(80)
  .regex(/^(resume|nextUp|watchlist|watched|reco:(forYou|inLibrary|discover|community|exploration)|library:[A-Za-z0-9-]+)$/);

const layoutSchema = z.object({
  heroMode: z.enum(["resume", "random", "reco", "fixed"]),
  heroFixedItemId: z.string().max(64).nullish(),
  rows: z.array(z.object({ key: rowKeySchema, enabled: z.boolean() })).max(60),
  cardDensity: z.enum(["compact", "normal", "large"]),
});

export type HomeLayoutPayload = z.infer<typeof layoutSchema>;

/**
 * Défaut = l'accueil RECOMMANDÉ : héros « Sélectionné pour vous » et rangée
 * « Pour vous » actifs d'entrée. Ne concerne que les comptes SANS mise en page
 * stockée — une ligne existante garde le choix de l'utilisateur, au champ
 * près. Les bibliothèques sont dynamiques : le client les réconcilie (ancrées
 * avant « Déjà visionné » sur ce défaut, ajoutées en fin sur un layout
 * stocké). Le client retombe sur la bannière de reprise tant que la reco n'a
 * rien à montrer — un serveur sans clé TMDB sert donc l'accueil historique.
 */
export const DEFAULT_HOME_LAYOUT: HomeLayoutPayload = {
  heroMode: "reco",
  heroFixedItemId: null,
  rows: [
    { key: "resume", enabled: true },
    { key: "nextUp", enabled: true },
    { key: "reco:forYou", enabled: true },
    { key: "watched", enabled: true },
    { key: "watchlist", enabled: true },
    { key: "reco:inLibrary", enabled: false },
    { key: "reco:discover", enabled: false },
    { key: "reco:community", enabled: false },
    { key: "reco:exploration", enabled: false },
  ],
  cardDensity: "normal",
};

/** GET /home-layout — jamais 404 : défauts servis (`stored: false`).
 *  PUT /home-layout — remplace la mise en page entière (elle est UNE donnée). */
export function registerHomeLayoutRoutes(app: FastifyInstance): void {
  app.get("/home-layout", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const row = await prisma.homeLayout.findUnique({ where: { jellyfinUserId: user.userId } });
    if (!row) return { stored: false, layout: DEFAULT_HOME_LAYOUT };
    let rows: HomeLayoutPayload["rows"] = DEFAULT_HOME_LAYOUT.rows;
    try {
      rows = JSON.parse(row.rows) as HomeLayoutPayload["rows"];
    } catch {
      // JSON illisible : défauts — la prochaine sauvegarde réécrit proprement.
    }
    return {
      stored: true,
      layout: {
        heroMode: row.heroMode,
        heroFixedItemId: row.heroFixedItemId,
        rows,
        cardDensity: row.cardDensity,
      },
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
    return { ok: true };
  });
}
