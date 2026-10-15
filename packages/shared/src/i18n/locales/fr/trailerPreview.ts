/**
 * L'aperçu de bande-annonce au survol d'une carte (web et bureau) : son
 * réglage d'appareil et les mots de sa mini-carte. Le moteur vit dans
 * `apps/web/src/trailerPreview/`, la mini-carte dans
 * `apps/web/src/components/cards/preview/`.
 *
 * Espaces insécables (U+00A0) devant « : », « ? » et « ! ».
 */
export default {
  // ── Le réglage (Réglages › Apparence) ──────────────────────────────────
  settingSection: "Bandes-annonces",
  settingTitle: "Aperçus au survol",
  /** Le nom de l'interrupteur, pour les lecteurs d'écran (la ligne seule ne dit pas « bande-annonce »). */
  settingAccessibleName: "Aperçus de bande-annonce au survol",
  settingDescription: "Laissez le pointeur sur une affiche\u00a0: sa bande-annonce se lance, avec le son. Réglage propre à cet appareil.",

  // ── Le réglage des téléviseurs (Réglages › Lecture, Apple TV et Android TV) ──
  tvSettingTitle: "Aperçus au focus",
  tvSettingDescription: "Restez une seconde sur une carte\u00a0: elle s'agrandit et sa bande-annonce se lance. Réglage propre à ce téléviseur.",
  tvSoundTitle: "Son des aperçus",
  tvSoundDescription: "Coupé, la bande-annonce se joue en silence.",

  // ── La mini-carte ──────────────────────────────────────────────────────
  /** Le nom de la mini-carte, pour les lecteurs d'écran. */
  previewLabel: "Aperçu de la bande-annonce de {{title}}",
  previewLabelUntitled: "Aperçu de la bande-annonce",
  mute: "Couper le son",
  unmute: "Activer le son",
  volume: "Volume des aperçus",
  /** La classification du bandeau, pour les lecteurs d'écran (le badge seul dit « 12 »). */
  ratingLabel: "Classification\u00a0: {{rating}}",
  /** La progression d'un titre commencé, sous l'heure : « 54 sur 58 min ». */
  progressMinutes: "{{watched}} sur {{total}} min",
  /** Au-delà de l'heure, les durées du reste de l'app : « 1h 12min sur 2h 33min ». */
  progressTime: "{{watched}} sur {{total}}",

  // ── ESSAI (TV, lot du 16/10) : la carte en aperçu passe en tête ───────────
  // Le choix fait, ces clés partent avec le réglage d'essai.
  tvRowHeadEndLabel: "En bout de rangée (essai)",
  tvRowHeadEndStop: "Butée",
  tvRowHeadEndOverscroll: "Dépassement",
  tvRowHeadEndStopHint: "La rangée s'arrête à son bout\u00a0: l'aperçu des dernières cartes finit au bord droit.",
  tvRowHeadEndOverscrollHint: "La rangée défile au-delà de son bout\u00a0: l'aperçu est toujours en tête, du vide à sa droite.",
  tvRowHeadReleaseLabel: "Quand le focus quitte la rangée (essai)",
  tvRowHeadReleaseStay: "Elle reste",
  tvRowHeadReleaseReturn: "Elle revient",
  tvRowHeadReleaseStayHint: "La rangée reste où l'aperçu l'a laissée.",
  tvRowHeadReleaseReturnHint: "La rangée revient où elle était avant les aperçus.",
};
