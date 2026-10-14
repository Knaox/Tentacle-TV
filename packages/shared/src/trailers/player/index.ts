/**
 * Les règles du LECTEUR de bande-annonce, communes à tous : la réponse de
 * `resolve`, les choix (sous-titres, qualité), la mémoire des sous-titres et
 * la file du lecteur complet (web, bureau). tv-core les réexporte : il n'en
 * reste qu'une copie.
 */

export * from "./trailerStream";
export * from "./trailerChoices";
export * from "./trailerSubtitleMemory";
export * from "./trailerQueue";
