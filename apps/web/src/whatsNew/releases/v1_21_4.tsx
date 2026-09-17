import type { WhatsNewRelease } from "../types";

/**
 * 1.21.4 — entrée VIDE, en connaissance de cause.
 *
 * La version rend le démarrage d'une lecture instantané sur le bureau Linux :
 * mpv reste au chaud entre deux épisodes, ne retient plus le thread principal,
 * et la fenêtre vidéo n'est plus recollée à chaque film. Ça se mesure — une
 * seconde de moins par épisode — mais ça ne se montre pas : une scène qui
 * mettrait en scène « c'est plus rapide » inventerait.
 *
 * L'entrée existe quand même : elle dit « rien à montrer », là où son absence
 * laisserait supposer un oubli (cf. registry.test.ts).
 */
export const RELEASE_1_21_4: WhatsNewRelease = {
  version: "1.21.4",
  features: [],
};
