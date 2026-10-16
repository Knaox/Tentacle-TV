/**
 * L'aperçu de bande-annonce au survol d'une carte — le modèle PUR, sans DOM :
 * ses temps (une seule source), son sujet (ce qu'on demande au serveur), sa
 * machine d'états et l'arbitre « un seul à la fois ». Le crochet, la lecture
 * et les réglages vivent dans `apps/web/src/trailerPreview/`.
 */
export * from "./previewTiming";
export * from "./previewDelay";
export * from "./previewSubject";
export * from "./previewMachine";
export * from "./previewArbiter";
