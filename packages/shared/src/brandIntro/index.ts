/**
 * L'ouverture du logo — le pur, partagé par toutes les plateformes : courbes,
 * géométrie tirée des constantes générées du logo, caméra, chorégraphie,
 * attente et partition du son. La synthèse Web Audio vit à part
 * (`@tentacle-tv/shared/brandIntro/synth`) : seuls le web et le script de
 * rendu du fichier son la chargent. Carnet : `docs/OUVERTURE.md`.
 */
export * from "./easing";
export * from "./introGeometry";
export * from "./introCamera";
export * from "./introPose";
export * from "./introTimeline";
export * from "./introHold";
export * from "./introScore";
