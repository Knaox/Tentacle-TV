import { defineConfig } from "vitest/config";
import { TEST_DATA_DIR } from "./test/isolatedDataDir";

/**
 * Le seul écart aux défauts de vitest : le délai d'un test.
 *
 * Les bancs de sécurité de la Famille hachent et vérifient le PIN plusieurs fois
 * par test (fonction volontairement lente). Sur une machine chargée — crochet
 * pre-push à côté d'autres sessions — ils passaient les 5 s par défaut et
 * échouaient sans rien avoir vérifié. 20 s couvrent ce coût.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    // Jamais le vrai `apps/backend/data` (test/isolatedDataDir.ts).
    globalSetup: ["./test/isolatedDataDir.ts"],
    // Prisma Client charge `apps/backend/.env` dans `process.env` dès qu'il est
    // instancié (le client généré en garde le chemin), et il n'écrase jamais
    // une variable déjà posée. Sur un poste de dev, ce fichier porte de VRAIES
    // valeurs (clé TMDB, base de test distante) : posées vides ici, elles ne
    // peuvent pas entrer dans un test (audit du chantier SQLite). Un test qui
    // en veut une la pose lui-même (`vi.stubEnv`).
    env: Object.fromEntries(
      [
        "DATABASE_URL", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_PASSWORD_FILE",
        "TMDB_API_KEY", "JELLYFIN_URL", "JELLYFIN_ADMIN_API_KEY", "JWT_SECRET", "RELAY_ADMIN_SECRET",
      ].map((name) => [name, ""]).concat([["TENTACLE_DATA_DIR", TEST_DATA_DIR]]),
    ),
  },
});
