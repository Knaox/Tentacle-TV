/**
 * L'aperçu de bande-annonce au survol d'une carte, en anglais — le pendant de
 * `fr/trailerPreview.ts` (mêmes clés).
 */
export default {
  // ── Le réglage (Réglages › Apparence) ──────────────────────────────────
  settingSection: "Trailers",
  settingTitle: "Previews on hover",
  /** Le nom de l'interrupteur, pour les lecteurs d'écran (la ligne seule ne dit pas « bande-annonce »). */
  settingAccessibleName: "Trailer previews on hover",
  settingDescription: "Rest the pointer on a poster and its trailer starts, with sound. This setting applies to this device only.",

  // ── Le réglage des téléviseurs (Réglages › Lecture, Apple TV et Android TV) ──
  tvSettingTitle: "Previews on focus",
  tvSettingDescription: "Stay on a card for a second: it grows and its trailer starts. This setting applies to this TV only.",
  tvSoundTitle: "Preview sound",
  tvSoundDescription: "When off, trailers play silently.",

  // ── La mini-carte ──────────────────────────────────────────────────────
  previewLabel: "Trailer preview for {{title}}",
  previewLabelUntitled: "Trailer preview",
  mute: "Mute",
  unmute: "Unmute",
  volume: "Preview volume",
  ratingLabel: "Rated {{rating}}",
  progressMinutes: "{{watched}} of {{total}} min",
  progressTime: "{{watched}} of {{total}}",
};
