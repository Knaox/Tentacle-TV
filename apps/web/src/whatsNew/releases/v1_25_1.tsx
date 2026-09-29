import type { WhatsNewRelease } from "../types";

/**
 * 1.25.1 — entrée VIDE, en connaissance de cause, comme la 1.21.4.
 *
 * La version rend le démarrage d'une lecture instantané sous Linux dès le
 * premier titre : mpv est préchauffé à l'ouverture de l'application et le reste
 * d'un titre à l'autre (`apps/desktop-electron/src/main/ipc/videoPrewarm.ts`).
 * Ça se mesure — environ une seconde de moins par titre neuf — mais ça ne se
 * montre pas : une scène qui mettrait en scène « c'est plus rapide » inventerait.
 */
export const RELEASE_1_25_1: WhatsNewRelease = {
  version: "1.25.1",
  features: [],
};
