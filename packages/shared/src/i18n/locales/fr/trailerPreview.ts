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
  /** Le délai avant la première image de l'aperçu (web, bureau, téléviseurs : shared `previewDelay.ts`). */
  delayTitle: "Délai avant l'aperçu",
  delayDescription: "Le temps à laisser le pointeur sur une affiche avant que sa bande-annonce paraisse. 0,8\u00a0s par défaut.",
  delay_500: "0,5\u00a0s",
  delay_800: "0,8\u00a0s",
  delay_1200: "1,2\u00a0s",
  delay_2000: "2\u00a0s",

  // ── Le réglage des téléviseurs (Réglages › Lecture, Apple TV et Android TV) ──
  tvSettingTitle: "Aperçus au focus",
  tvSettingDescription: "Restez un instant sur une carte\u00a0: elle s'agrandit et sa bande-annonce se lance. Réglage propre à ce téléviseur.",
  tvSoundTitle: "Son des aperçus",
  tvSoundDescription: "Coupé, la bande-annonce se joue en silence.",
  tvDelayDescription: "Le temps à rester sur une carte avant que sa bande-annonce paraisse. 0,8\u00a0s par défaut.",

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
};
