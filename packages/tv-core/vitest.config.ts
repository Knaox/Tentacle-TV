import { defineConfig } from "vitest/config";

/** Rien à configurer : ce paquet n'a ni DOM, ni alias, ni greffon. C'est tout
 * l'intérêt — ses tests tournent en quelques millisecondes, et ils servent de
 * filet aux trois cibles téléviseur. */
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
